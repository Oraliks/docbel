import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { readSourcePdf } from "@/lib/pdf-forms/storage";
import { fillForm } from "@/lib/pdf-forms/filler";
import { generateSeedPayload } from "@/lib/pdf-forms/seed-payload";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { getCombWidgetsForSlug } from "@/lib/pdf-forms/bindings/comb-widgets";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { PdfFormField, FormPayload, AcroFieldRaw } from "@/lib/pdf-forms/types";
import { sanitizeFields } from "@/lib/pdf-forms/sanitize-fields";
import { visiblePayload } from "@/lib/pdf-forms/validation";
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

  // Fallback `sourceFileName` (comme app/api/pdf/[slug]/generate/route.ts) :
  // sans lui, un formulaire dont le fichier source a été déplacé/renommé
  // depuis l'upload échouait à charger le PDF de test alors que le parcours
  // citoyen, lui, le retrouvait.
  const source = await readSourcePdf(form.sourceStoragePath, form.sourceFileName);
  if (!source) return apiError(500, "PDF source introuvable");

  let result;
  try {
    // L'aperçu admin doit suivre exactement la même voie de génération que
    // le parcours citoyen : les bindings serveur complètent les widgets qui
    // n'ont pas d'ancre directe dans le schéma du FormRunner.
    // « Exactement la même voie » inclut le filtre de visibilité : sans lui,
    // l'aperçu admin ne montrerait pas le document que le citoyen reçoit.
    const extraStamps = resolveStamps(visiblePayload(fields, payload), getRulesForSlug(form.slug));
    result = await fillForm(source, fields, payload, {
      flatten: shouldFlattenGeneratedPdf(form.slug),
      technicalSchema: form.technicalSchema as unknown as AcroFieldRaw[],
      extraStamps,
      combWidgets: getCombWidgetsForSlug(form.slug),
    });
    // Traçage (comme generate/route.ts, S1) : le remplissage est best-effort
    // et n'échoue pas quand une valeur ne parvient pas jusqu'au papier — sans
    // cette trace, un widget cassé restait invisible même en aperçu admin.
    // Projection sans `detail` : peut contenir des caractères saisis par un
    // testeur (seed data ou payload custom envoyé au body).
    if (result.diagnostics.length > 0) {
      console.warn(
        `[pdf-forms] test-generate ${form.slug} — ${result.diagnostics.length} valeur(s) non écrite(s) :`,
        result.diagnostics.map(({ fieldId, widget, kind }) => ({ fieldId, widget, kind }))
      );
    }
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
