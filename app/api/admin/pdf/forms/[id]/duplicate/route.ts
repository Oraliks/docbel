import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { readSourcePdf, saveSourcePdf } from "@/lib/pdf-forms/storage";
import { slugify } from "@/lib/pdf-forms/ingest";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// POST — duplique un formulaire (copie indépendante du PDF source + schéma).
/// La copie repart en `draft`, version 1, sans révisions.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const src = await prisma.pdfForm.findUnique({ where: { id } });
  if (!src) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  // Copie physique du PDF source pour rester indépendant.
  const buffer = await readSourcePdf(src.sourceStoragePath);
  if (!buffer) return NextResponse.json({ error: "PDF source introuvable" }, { status: 500, headers: json });
  const newPath = await saveSourcePdf(buffer, src.sourceFileName);

  const title = `${src.title} (copie)`;
  let slug = slugify(title);
  for (let i = 1; await prisma.pdfForm.findUnique({ where: { slug } }); i++) {
    slug = `${slugify(title)}-${i}`;
  }

  const copy = await prisma.pdfForm.create({
    data: {
      slug,
      title,
      description: src.description,
      issuer: src.issuer,
      defaultLocale: src.defaultLocale,
      locales: src.locales as Prisma.InputJsonValue,
      sourceStoragePath: newPath,
      sourceFileName: src.sourceFileName,
      sourceByteSize: src.sourceByteSize,
      sourceSha256: src.sourceSha256,
      pageCount: src.pageCount,
      technicalSchema: src.technicalSchema as Prisma.InputJsonValue,
      fields: src.fields as Prisma.InputJsonValue,
      allowDownload: src.allowDownload,
      allowDoccle: src.allowDoccle,
      allowItsme: src.allowItsme,
      createdBy: auth.user.id,
    },
    select: { id: true, slug: true, title: true },
  });

  return NextResponse.json(copy, { status: 201, headers: json });
}
