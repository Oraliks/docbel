// Régénère tous les PDF déjà complétés (visibles, requis) d'un BundleRun,
// depuis les payloads déjà validés — AUCUN PDF n'est jamais stocké (RGPD),
// donc zip et mail (Task 7/8) régénèrent à chaque appel, en mémoire.

import { prisma } from "@/lib/prisma";
import { loadDossierState, type DossierState } from "@/lib/bundles/completion";
import { fillForm } from "@/lib/pdf-forms/filler";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { readSourcePdf } from "@/lib/pdf-forms/storage";
import { renderFilename } from "@/lib/pdf-forms/filename";
import type { PdfFormField, AcroFieldRaw, FormPayload } from "@/lib/pdf-forms/types";

export interface RegeneratedDoc {
  filename: string;
  bytes: Buffer;
}

/// Régénère tous les documents complétés (requis, visibles) d'un run — dans
/// le même ordre que `state.items`. Retourne `null` si le run n'est pas
/// accessible (propriété) OU si le dossier n'est pas encore complet (le
/// verrou s'applique aussi ici, pas seulement sur le téléchargement
/// individuel).
export async function regenerateAllDocuments(
  bundleRunId: string,
  ownership: { userId: string | null; sessionId: string | null },
): Promise<{ state: DossierState; docs: RegeneratedDoc[] } | null> {
  const state = await loadDossierState(bundleRunId, ownership);
  if (!state || !state.allRequiredDone) return null;

  const completedIds = new Set(state.completedTemplateIds);
  const toRegenerate = state.items.filter(
    (it) => it.pdfFormId && completedIds.has(it.pdfFormId) && it.pdfForm,
  );

  const forms = await prisma.pdfForm.findMany({
    where: { id: { in: toRegenerate.map((it) => it.pdfFormId as string) } },
    select: {
      id: true,
      slug: true,
      sourceStoragePath: true,
      sourceFileName: true,
      fields: true,
      technicalSchema: true,
    },
  });
  const formsById = new Map(forms.map((f) => [f.id, f]));

  const docs: RegeneratedDoc[] = [];
  for (const item of toRegenerate) {
    const form = formsById.get(item.pdfFormId as string);
    if (!form) continue;
    const payload = (state.payloads[form.id] as FormPayload) || {};
    const source = await readSourcePdf(form.sourceStoragePath, form.sourceFileName);
    if (!source) continue;
    const fields = (form.fields as unknown as PdfFormField[]) || [];
    const technicalSchema = (form.technicalSchema as unknown as AcroFieldRaw[]) || [];
    const extraStamps = resolveStamps(payload, getRulesForSlug(form.slug));
    const { bytes } = await fillForm(source, fields, payload, { technicalSchema, extraStamps });
    docs.push({ filename: renderFilename(form.slug, payload), bytes });
  }

  return { state, docs };
}
