import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { readSourcePdf } from "@/lib/pdf-forms/storage";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { buildEnrichedSchema } from "@/lib/pdf-forms/field-inference";
import { computeTechnicalDiff, migrateEnrichment } from "@/lib/pdf-forms/diff";
import { AcroFieldRaw, PdfFormField } from "@/lib/pdf-forms/types";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// POST — ré-extrait l'AcroForm depuis le PDF source ACTUEL (même fichier).
/// Conserve l'enrichissement des champs inchangés, ajoute les nouveaux.
/// Utile si le premier parse a raté quelque chose.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  const source = await readSourcePdf(form.sourceStoragePath);
  if (!source) return NextResponse.json({ error: "PDF source introuvable" }, { status: 500, headers: json });

  const parsed = await parsePdf(source);
  const oldTech = (form.technicalSchema as unknown as AcroFieldRaw[]) || [];
  const oldEnriched = (form.fields as unknown as PdfFormField[]) || [];

  const diff = computeTechnicalDiff(oldTech, parsed.fields);
  const { kept } = migrateEnrichment(oldEnriched, diff);
  // Champs nouvellement détectés → enrichissement par défaut
  const newRaws = parsed.fields.filter((r) => diff.added.includes(r.pdfFieldName));
  const addedEnriched = buildEnrichedSchema(newRaws);

  const merged = [...kept, ...addedEnriched].map((f, i) => ({ ...f, order: i }));

  const updated = await prisma.pdfForm.update({
    where: { id },
    data: {
      technicalSchema: parsed.fields as unknown as Prisma.InputJsonValue,
      fields: merged as unknown as Prisma.InputJsonValue,
      pageCount: parsed.pageCount,
    },
  });

  return NextResponse.json({ ok: true, diff, form: updated }, { headers: json });
}
