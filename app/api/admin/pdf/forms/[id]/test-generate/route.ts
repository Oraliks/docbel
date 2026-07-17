import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { readSourcePdf } from "@/lib/pdf-forms/storage";
import { fillForm } from "@/lib/pdf-forms/filler";
import { generateSeedPayload } from "@/lib/pdf-forms/seed-payload";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { PdfFormField, FormPayload, AcroFieldRaw } from "@/lib/pdf-forms/types";
import { sanitizeFields } from "@/lib/pdf-forms/sanitize-fields";
import { shouldFlattenGeneratedPdf } from "@/lib/pdf-forms/flatten-policy";
import { apiError } from "@/lib/api/response";

/// POST — génère un PDF de test (données seed ou payload fourni). Admin only.
/// Stream direct, AUCUN stockage. Accepte `{ schema?, payload? }` pour tester
/// un schéma en cours d'édition non sauvegardé.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) return apiError(404, "Introuvable");

  let body: { schema?: PdfFormField[]; payload?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    /* pas de body → tout depuis la BDD */
  }

  const fields: PdfFormField[] =
    Array.isArray(body.schema) && body.schema.length
      ? sanitizeFields(body.schema)
      : (form.fields as unknown as PdfFormField[]) || [];

  const payload = (body.payload as FormPayload) || generateSeedPayload(fields);

  const source = await readSourcePdf(form.sourceStoragePath);
  if (!source) return apiError(500, "PDF source introuvable");

  let result;
  try {
    // L'aperçu admin doit suivre exactement la même voie de génération que
    // le parcours citoyen : les bindings serveur complètent les widgets qui
    // n'ont pas d'ancre directe dans le schéma du FormRunner.
    const extraStamps = resolveStamps(payload, getRulesForSlug(form.slug));
    result = await fillForm(source, fields, payload, {
      flatten: shouldFlattenGeneratedPdf(form.slug),
      technicalSchema: form.technicalSchema as unknown as AcroFieldRaw[],
      extraStamps,
    });
  } catch (err) {
    console.error("test-generate error:", err);
    return apiError(500, "Échec de génération");
  }

  return new NextResponse(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="test-${form.slug}.pdf"`,
      "X-Unicode-Font": result.unicodeFont ? "1" : "0",
      "Cache-Control": "no-store",
    },
  });
}
