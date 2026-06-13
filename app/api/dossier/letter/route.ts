import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";
import {
  buildReclamationLetterPdf,
  type LetterResponsibility,
  type LetterSender,
} from "@/lib/letters/reclamation";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// Slug "sûr" pour le nom de fichier (évite les injections d'en-tête et les
/// caractères exotiques dans le Content-Disposition).
function safeSlug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return cleaned || "document";
}

/// Date française du jour (ex. « le 13 juin 2026 »). Côté serveur uniquement.
function frenchDateLabel(d: Date): string {
  const formatted = new Intl.DateTimeFormat("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return `le ${formatted}`;
}

/// POST — génère un courrier de réclamation PDF pour un document à fournir
/// par un tiers. AUCUN stockage (RGPD) ; aucune PII en log.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`dossier-letter:${ip}`, { windowMs: 60_000, max: 10 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes, réessayez plus tard" },
      { status: 429, headers: json }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  const runId = typeof body.runId === "string" ? body.runId : null;
  const docSlug = typeof body.docSlug === "string" ? body.docSlug.trim() : "";
  const docTitle = typeof body.docTitle === "string" ? body.docTitle.trim() : "";
  const responsibility =
    body.responsibility === "employer" || body.responsibility === "external"
      ? (body.responsibility as LetterResponsibility)
      : null;

  if (!docSlug || !docTitle || !responsibility) {
    return NextResponse.json(
      { error: "Paramètres manquants ou invalides" },
      { status: 400, headers: json }
    );
  }

  // Identité du citoyen (best-effort). On privilégie l'utilisateur de la
  // session quand elle existe ; sinon on remonte depuis le run.
  let sender: LetterSender = {};
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    let profileUserId: string | null = session?.user?.id ?? null;

    // Si pas d'utilisateur en session mais un runId fourni, on récupère
    // l'éventuel userId attaché au run.
    if (!profileUserId && runId) {
      const run = await prisma.bundleRun.findUnique({
        where: { id: runId },
        select: { userId: true },
      });
      profileUserId = run?.userId ?? null;
    }

    if (profileUserId) {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: profileUserId },
        select: {
          firstName: true,
          lastName: true,
          street: true,
          streetNum: true,
          postalCode: true,
          city: true,
        },
      });
      if (profile) sender = profile;
    }
  } catch {
    // Identité non résolue : le courrier reste utile avec des lignes vierges.
    sender = {};
  }

  let pdfBytes: Buffer;
  try {
    pdfBytes = await buildReclamationLetterPdf({
      sender,
      docTitle,
      responsibility,
      dateLabel: frenchDateLabel(new Date()),
    });
  } catch (err) {
    console.error("[dossier-letter] generation error:", err);
    return NextResponse.json({ error: "Échec de génération" }, { status: 500, headers: json });
  }

  const filename = `courrier-${safeSlug(docSlug)}.pdf`;
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
