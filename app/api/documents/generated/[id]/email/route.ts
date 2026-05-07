import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { resolveStoredFilePath } from "@/lib/file-storage";
import { sendDocumentEmail } from "@/lib/documents/email";
import { verifyDownloadToken } from "@/lib/documents/token";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { isBlobsPath, getBlob } from "@/lib/documents/blob-storage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = getClientIp(req);

  const rl = checkRateLimit(`email:${ip}`, { windowMs: 60_000, max: 3 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop d'envois, réessayez plus tard" },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { to, token, consent } = body || {};
  if (!to || typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Email destinataire invalide" }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json(
      { error: "Consentement requis pour l'envoi par email" },
      { status: 400 }
    );
  }

  const generated = await prisma.generatedDocument.findUnique({
    where: { id },
    include: { outputFile: true, template: true },
  });
  if (!generated) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }
  if (generated.expiresAt < new Date()) {
    return NextResponse.json({ error: "Document expiré" }, { status: 410 });
  }

  // Auth: token OU propriétaire connecté
  let allowed = false;
  if (token && verifyDownloadToken(id, token)) allowed = true;
  if (!allowed) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && session.user.id === generated.userId) allowed = true;
  }
  if (!allowed) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!generated.outputFile?.filePath) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 404 });
  }

  let content: Buffer;
  if (isBlobsPath(generated.outputFile.filePath)) {
    const buf = await getBlob(generated.outputFile.filePath);
    if (!buf) {
      return NextResponse.json({ error: "Fichier introuvable dans le stockage" }, { status: 404 });
    }
    content = buf;
  } else {
    const fullPath = resolveStoredFilePath(generated.outputFile.filePath);
    if (!fullPath || !existsSync(fullPath)) {
      return NextResponse.json({ error: "Fichier absent du disque" }, { status: 404 });
    }
    content = await readFile(fullPath);
  }

  try {
    await sendDocumentEmail({
      to,
      subject: `Votre document : ${generated.outputFile.name}`,
      text: `Bonjour,\n\nVeuillez trouver en pièce jointe le document généré via beldoc.\n\nCe lien expire le ${generated.expiresAt.toLocaleString("fr-BE")}.\n\nCordialement,\nbeldoc`,
      filename: generated.outputFile.name,
      attachment: content,
    });
  } catch (err) {
    console.error("sendDocumentEmail error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Échec d'envoi" },
      { status: 500 }
    );
  }

  await prisma.generatedDocument.update({
    where: { id },
    data: { emailSentTo: to },
  });

  return NextResponse.json({ ok: true });
}
