import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { ingestPdf, readPdfUpload, slugify } from "@/lib/pdf-forms/ingest";
import { saveSourcePdf } from "@/lib/pdf-forms/storage";
import { isLocale, Locale } from "@/lib/pdf-forms/types";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET — liste paginée des formulaires PDF.
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const where: Prisma.PdfFormWhereInput = {};
  if (status === "draft" || status === "published" || status === "archived") {
    where.status = status;
  }

  const forms = await prisma.pdfForm.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true, slug: true, title: true, issuer: true, status: true,
      version: true, defaultLocale: true, locales: true, pageCount: true,
      allowDoccle: true, allowItsme: true, updatedAt: true,
    },
  });
  return NextResponse.json(forms, { headers: json });
}

/// POST — upload d'un PDF (multipart `file`) + métadonnées → crée un draft.
/// Le PDF est parsé (AcroForm) et le schéma enrichi est pré-rempli.
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart/form-data attendu" }, { status: 400, headers: json });
  }

  const upload = await readPdfUpload(form.get("file"));
  if ("error" in upload) {
    return NextResponse.json({ error: upload.error }, { status: 400, headers: json });
  }

  const title = (form.get("title") as string)?.trim() || upload.name.replace(/\.pdf$/i, "");
  const issuer = ((form.get("issuer") as string) || "").trim() || null;
  const localesRaw = (form.get("locales") as string) || "fr";
  const locales = localesRaw
    .split(",")
    .map((l) => l.trim())
    .filter(isLocale) as Locale[];
  const finalLocales = locales.length ? Array.from(new Set(["fr", ...locales])) : ["fr"];

  const ingest = await ingestPdf(upload.buffer);
  // Les PDFs « plats » (sans AcroForm) sont acceptés : l'admin pourra leur
  // ajouter des champs via l'onglet « Visuel » de l'éditeur.

  // Slug unique
  let slug = slugify(title);
  for (let i = 1; await prisma.pdfForm.findUnique({ where: { slug } }); i++) {
    slug = `${slugify(title)}-${i}`;
  }

  const storagePath = await saveSourcePdf(upload.buffer, upload.name);

  const created = await prisma.pdfForm.create({
    data: {
      slug,
      title,
      issuer,
      defaultLocale: "fr",
      locales: finalLocales as unknown as Prisma.InputJsonValue,
      sourceStoragePath: storagePath,
      sourceFileName: upload.name,
      sourceByteSize: ingest.byteSize,
      sourceSha256: ingest.sha256,
      pageCount: ingest.pageCount,
      technicalSchema: ingest.technicalSchema as unknown as Prisma.InputJsonValue,
      fields: ingest.fields as unknown as Prisma.InputJsonValue,
      createdBy: auth.user.id,
    },
    select: { id: true, slug: true, title: true, status: true },
  });

  return NextResponse.json(created, { status: 201, headers: json });
}
