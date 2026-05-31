// Seed générique d'un dossier codé → crée ses PdfForms + son DocumentBundle
// à partir de sa DossierDefinition. Source de vérité unique : le module.
// Idempotent au niveau des slugs.
//
// NB : génère des PDFs AcroForm "gabarit" (un widget par champ) pour démarrer.
// En production, l'admin remplace le PDF source par le formulaire officiel et
// remappe les champs — le reste (questions, propagation, signature) tient.

import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveSourcePdf } from "@/lib/pdf-forms/storage";
import { ingestPdf } from "@/lib/pdf-forms/ingest";
import type { PdfFormField, Localized } from "@/lib/pdf-forms/types";
import { loc } from "@/lib/pdf-forms/types";
import type { DossierDefinition, DossierDocument } from "./types";
import { resolveDocumentFields, type ResolvedField } from "./resolve";

export interface SeedResult {
  ok: boolean;
  created: boolean;
  bundleId: string;
  bundleSlug: string;
  pdfFormIds: string[];
  message: string;
}

function frLabel(l: Localized): string {
  return loc(l, "fr");
}

/// Génère un PDF gabarit 1+ pages avec un widget texte par champ résolu.
async function generateTemplatePdf(doc: DossierDocument, fields: ResolvedField[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]);
  page.drawText(doc.title, { x: 50, y: 800, size: 16, font });
  page.drawText(`Émetteur : ${doc.issuer}`, { x: 50, y: 780, size: 10, font });
  page.drawText("Gabarit — à remplacer par le formulaire officiel.", { x: 50, y: 762, size: 9, font });

  const form = pdf.getForm();
  let y = 720;
  for (const f of fields) {
    if (y < 80) {
      page = pdf.addPage([595, 842]);
      y = 780;
    }
    page.drawText(`${frLabel(f.label)} :`, { x: 50, y, size: 10, font });
    const widget = form.createTextField(f.pdfFieldName);
    // La signature a besoin d'un cadre plus haut pour le bloc "façon Adobe".
    const h = f.type === "signature" ? 40 : 18;
    widget.addToPage(page, { x: 250, y: y - (h - 14), width: 290, height: h });
    y -= h + 12;
  }
  form.updateFieldAppearances(font);
  return Buffer.from(await pdf.save());
}

/// Crée (idempotent par slug) un PdfForm publié à partir d'un document.
async function createPdfFormForDocument(doc: DossierDocument, userId: string | null): Promise<string> {
  const existing = await prisma.pdfForm.findUnique({ where: { slug: doc.slug } });
  if (existing) return existing.id;

  const fields = resolveDocumentFields(doc);
  const buffer = await generateTemplatePdf(doc, fields);
  const filename = `${doc.slug}.pdf`;
  const storagePath = await saveSourcePdf(buffer, filename);
  const ingest = await ingestPdf(buffer);

  // Construit le schéma enrichi à partir des champs résolus (autoritaire),
  // en récupérant pdfFieldName/acroType depuis l'ingest (matching par nom).
  const enriched: PdfFormField[] = fields.map((f, i) => {
    const tech = ingest.fields.find((t) => t.pdfFieldName === f.pdfFieldName);
    return {
      id: f.key,
      pdfFieldName: f.pdfFieldName,
      type: f.type,
      required: f.required,
      label: f.label,
      help: f.help,
      prefillFrom: f.prefillFrom,
      section: f.section,
      order: i,
      acroType: tech?.acroType,
    } as PdfFormField;
  });

  const created = await prisma.pdfForm.create({
    data: {
      slug: doc.slug,
      title: doc.title,
      issuer: doc.issuer,
      status: "published",
      defaultLocale: "fr",
      locales: ["fr"] as unknown as Prisma.InputJsonValue,
      sourceStoragePath: storagePath,
      sourceFileName: filename,
      sourceByteSize: ingest.byteSize,
      sourceSha256: ingest.sha256,
      pageCount: ingest.pageCount,
      technicalSchema: ingest.technicalSchema as unknown as Prisma.InputJsonValue,
      fields: enriched as unknown as Prisma.InputJsonValue,
      createdBy: userId,
    },
    select: { id: true },
  });
  return created.id;
}

/// Seed complet d'un dossier : PdfForms + bundle + items. Idempotent.
export async function seedDossier(def: DossierDefinition, userId: string | null): Promise<SeedResult> {
  const existing = await prisma.documentBundle.findUnique({
    where: { slug: def.slug },
    include: { items: { include: { pdfForm: { select: { id: true } } } } },
  });
  if (existing) {
    return {
      ok: true,
      created: false,
      bundleId: existing.id,
      bundleSlug: existing.slug,
      pdfFormIds: existing.items.map((i) => i.pdfForm?.id).filter((x): x is string => !!x),
      message: `Dossier « ${def.title} » déjà présent — aucune modification.`,
    };
  }

  // 1. PdfForms (un par document).
  const pdfFormIds: string[] = [];
  for (const docDef of def.documents) {
    pdfFormIds.push(await createPdfFormForDocument(docDef, userId));
  }

  // 2. Bundle (questions/warnings convertis au format DB attendu, en FR).
  const eligibilityQuestions = def.questions.map((q) => ({
    id: q.id,
    label: frLabel(q.label),
    type: q.type,
    options: q.options?.map((o) => ({ value: o.value, label: frLabel(o.label) })),
    verdicts: {},
  }));
  const warnings = def.warnings.map((w) => ({ title: w.title, message: w.message, severity: w.severity }));

  const bundle = await prisma.documentBundle.create({
    data: {
      slug: def.slug,
      name: def.title,
      description: def.description,
      icon: def.icon,
      color: def.color,
      active: true,
      order: 0,
      lifeEventCategory: def.category,
      showOnOnboarding: true,
      vocabularyTags: def.vocabularyTags as unknown as Prisma.InputJsonValue,
      eligibilityQuestions: eligibilityQuestions as unknown as Prisma.InputJsonValue,
      warnings: warnings as unknown as Prisma.InputJsonValue,
    },
  });

  // 3. Items. Les documents conditionnels (includeWhen) sont marqués optionnels
  //    pour l'instant ; le filtrage par réponses d'orientation sera branché
  //    quand le runner consommera selectDocuments().
  for (let i = 0; i < def.documents.length; i++) {
    const docDef = def.documents[i];
    await prisma.documentBundleItem.create({
      data: {
        bundleId: bundle.id,
        pdfFormId: pdfFormIds[i],
        order: i,
        required: docDef.includeWhen ? false : docDef.required ?? true,
      },
    });
  }

  return {
    ok: true,
    created: true,
    bundleId: bundle.id,
    bundleSlug: bundle.slug,
    pdfFormIds,
    message: `Dossier « ${def.title} » créé avec ${def.documents.length} documents.`,
  };
}
