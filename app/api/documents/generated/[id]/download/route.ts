import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { resolveStoredFilePath } from "@/lib/file-storage";
import { verifyDownloadToken } from "@/lib/documents/token";
import { isBlobsPath, getBlob } from "@/lib/documents/blob-storage";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const generated = await prisma.generatedDocument.findUnique({
    where: { id },
    include: { outputFile: true },
  });

  if (!generated) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  if (generated.expiresAt < new Date()) {
    return NextResponse.json({ error: "Document expiré" }, { status: 410 });
  }

  // Auth: token valide OU userId match OU admin
  let allowed = false;
  if (token && verifyDownloadToken(id, token)) {
    allowed = true;
  } else {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) {
      if (session.user.id === generated.userId) {
        allowed = true;
      } else {
        const role = (session.user as { role?: string }).role;
        if (role === "admin") allowed = true;
      }
    }
  }
  if (!allowed) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

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
  const contentType =
    CONTENT_TYPES[generated.outputFile.fileType || ""] || "application/octet-stream";

  return new NextResponse(content as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${generated.outputFile.name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
