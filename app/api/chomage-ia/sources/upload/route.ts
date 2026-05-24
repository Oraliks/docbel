/**
 * POST /api/chomage-ia/sources/upload
 *
 * Upload d'un PDF ou d'une image qui devient une KnowledgeSource :
 *  1. On crée un File (réutilise le système existant : public/uploads/...)
 *  2. Pour les PDFs : on tente d'extraire le texte avec pdfjs-dist.
 *     Si l'extraction échoue ou produit < 50 caractères → l'admin devra
 *     éditer le contenu manuellement après création.
 *  3. Pour les images : `content` est obligatoire (caption manuel).
 *  4. On crée une KnowledgeSource liée au File.
 *
 * FormData attendu :
 *   file        : Blob (obligatoire)
 *   title       : string (obligatoire)
 *   kind        : "pdf" | "image_caption" (obligatoire)
 *   content     : string (obligatoire pour image_caption ; optionnel pour pdf)
 *   tags        : string JSON array (optionnel)
 *   sourceUrl   : string (optionnel)
 *   domain      : string (optionnel, défaut "chomage")
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { buildStoredFilePath, getUploadDirectory } from "@/lib/file-storage";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_KINDS = new Set(["pdf", "image_caption"]);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

/**
 * Extrait le texte d'un PDF avec pdfjs-dist (ESM dynamic import — pdfjs
 * fonctionne mal en CJS et il est déjà utilisé ailleurs dans le projet).
 * Retourne "" si l'extraction échoue.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import pour éviter de charger pdfjs au build.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const uint8 = new Uint8Array(buffer);
    const doc = await pdfjs.getDocument({ data: uint8 }).promise;
    const pages: string[] = [];
    const maxPages = Math.min(doc.numPages, 80); // safety cap
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((it: { str?: string }) => it.str ?? "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (pageText.length > 0) pages.push(pageText);
      } catch {
        // skip page on error, continue with next
      }
    }
    return pages.join("\n\n").trim().slice(0, 180_000);
  } catch (err) {
    console.error("PDF extract error:", err);
    return "";
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const kind = (formData.get("kind") as string | null) ?? "";
  const content = (formData.get("content") as string | null)?.trim() ?? "";
  const sourceUrl = (formData.get("sourceUrl") as string | null)?.trim() ?? "";
  const domain = (formData.get("domain") as string | null) ?? DEFAULT_DOMAIN;
  const tagsRaw = formData.get("tags") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }
  if (!title || title.length < 2) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "Kind non supporté" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} Mo)` },
      { status: 413 }
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "Type MIME non autorisé (PDF/JPEG/PNG/WebP/GIF uniquement)" },
      { status: 415 }
    );
  }
  if (kind === "image_caption" && content.length < 10) {
    return NextResponse.json(
      { error: "Description (content) requise pour les images" },
      { status: 400 }
    );
  }

  let tags: string[] = [];
  if (tagsRaw) {
    try {
      const parsed = JSON.parse(tagsRaw);
      if (
        Array.isArray(parsed) &&
        parsed.every((t) => typeof t === "string" && t.length <= 50)
      ) {
        tags = parsed.slice(0, 20);
      }
    } catch {
      // ignore: tags invalides → vide
    }
  }

  const arrayBuf = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  // Stockage en private/ (sources internes — pas de raison d'exposer en public)
  const { relativeDir, absoluteDir } = getUploadDirectory(true);
  if (!existsSync(absoluteDir)) {
    await mkdir(absoluteDir, { recursive: true });
  }
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const uniqueName = `${nanoid(12)}-${sanitizeFileName(file.name)}`;
  const filePath = buildStoredFilePath(relativeDir, uniqueName);
  const fullPath = join(absoluteDir, uniqueName);
  await writeFile(fullPath, buffer);

  // 1. Crée un File en DB (réutilise le pattern Beldoc existant).
  const fileType = kind === "pdf" ? "pdf" : "image";
  const dbFile = await prisma.file.create({
    data: {
      name: file.name,
      type: "file",
      fileType,
      mimeType: file.type || null,
      size: buffer.byteLength,
      sha256,
      parentId: null,
      isPrivate: true,
      filePath,
      createdBy: auth.user.id,
    },
  });

  // 2. Si PDF et content vide, tente extraction.
  let finalContent = content;
  let extractWarning: string | null = null;
  if (kind === "pdf" && finalContent.length < 10) {
    const extracted = await extractPdfText(buffer);
    if (extracted.length >= 50) {
      finalContent = extracted;
    } else {
      finalContent =
        content ||
        `(Contenu PDF non extrait automatiquement — éditer manuellement.)\n\nFichier : ${file.name}\nTaille : ${buffer.byteLength} octets`;
      extractWarning =
        "Le texte n'a pas pu être extrait automatiquement. Édite la source pour ajouter le contenu.";
    }
  }

  // 3. Crée la KnowledgeSource liée au File.
  const ks = await prisma.knowledgeSource.create({
    data: {
      title,
      kind,
      content: finalContent,
      summary: null,
      sourceUrl: sourceUrl || null,
      fileId: dbFile.id,
      tags,
      enabled: true,
      domain,
      createdById: auth.user.id,
    },
  });

  // Détail logged (sans secret)
  console.log(
    `chomage-ia upload: ${kind} "${title}" (${buffer.byteLength}B, ext=${ext}) → ks=${ks.id} file=${dbFile.id}`
  );

  return NextResponse.json(
    {
      id: ks.id,
      title: ks.title,
      kind: ks.kind,
      fileId: dbFile.id,
      contentLength: finalContent.length,
      extractWarning,
    },
    { status: 201 }
  );
}
