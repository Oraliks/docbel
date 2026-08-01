// Régénère les PDF déjà complétés (visibles, requis) d'un BundleRun depuis les
// payloads déjà validés — AUCUN PDF n'est jamais stocké (RGPD), donc zip (Task
// 7), mail (Task 8) et téléchargement individuel régénèrent à chaque appel, en
// mémoire.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadDossierState, type DossierState } from "@/lib/bundles/completion";
import { computeItemStatuses, type BundleItem } from "@/components/docbel/bundle-runner/compute";
import { fillForm } from "@/lib/pdf-forms/filler";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { getCombWidgetsForSlug } from "@/lib/pdf-forms/bindings/comb-widgets";
import { readSourcePdf } from "@/lib/pdf-forms/storage";
import { renderFilename } from "@/lib/pdf-forms/filename";
import { applyServerAutoFields } from "@/lib/pdf-forms/auto-fields";
import { visiblePayload } from "@/lib/pdf-forms/validation";
import { todayISO } from "@/lib/pdf-forms/system-values";
import { shouldFlattenGeneratedPdf } from "@/lib/pdf-forms/flatten-policy";
import { buildDiagnosticsSummary, stablePayloadHashOf } from "@/lib/pdf-forms/submission-log";
import { sha256Hex } from "@/lib/pdf-forms/security";
import type { PdfFormField, AcroFieldRaw, FormPayload } from "@/lib/pdf-forms/types";

export interface RegeneratedDoc {
  filename: string;
  bytes: Buffer;
}

/// Items à la fois complétés ET encore éligibles (visibles) d'un state.
/// `completedTemplateIds` est append-only : un document complété puis rendu
/// inapplicable par un changement de réponse d'aiguillage y reste, mais
/// `computeItemStatuses` le marque `eligibility === false` — il ne doit alors
/// pas être re-inclus dans un export. On filtre donc sur la visibilité
/// calculée, pas sur la seule complétion.
function completedEligibleItems(state: DossierState): BundleItem[] {
  const { itemStatuses } = computeItemStatuses(
    state.items,
    state.completedTemplateIds,
    state.payloads,
    state.applicableSlugs,
  );
  return itemStatuses
    .filter((s) => s.completed && s.eligibility !== false && s.item.pdfFormId && s.item.pdfForm)
    .map((s) => s.item);
}

/// Remplit en mémoire les `items` donnés → RegeneratedDoc[], dans l'ordre reçu.
/// Aucun stockage. Un skip (form/payload/source manquant) fait disparaître
/// silencieusement un document légal de l'export : on le trace, comme le fait
/// le filler sur ses propres skips, pour que l'anomalie soit observable.
async function regenerateItems(
  state: DossierState,
  items: BundleItem[],
  ownership: { userId: string | null; sessionId: string | null },
): Promise<RegeneratedDoc[]> {
  const forms = await prisma.pdfForm.findMany({
    where: { id: { in: items.map((it) => it.pdfFormId as string) } },
    select: {
      id: true,
      slug: true,
      sourceStoragePath: true,
      sourceFileName: true,
      fields: true,
      technicalSchema: true,
      // Opposabilité (S7) : une régénération est une livraison comme une
      // autre — elle mérite sa ligne de log, donc la version et la locale.
      version: true,
      defaultLocale: true,
    },
  });
  const formsById = new Map(forms.map((f) => [f.id, f]));

  const docs: RegeneratedDoc[] = [];
  const logs: Prisma.PdfFormSubmissionLogCreateManyInput[] = [];
  for (const item of items) {
    const form = formsById.get(item.pdfFormId as string);
    if (!form) {
      console.warn(`[regenerate-pdfs] PdfForm introuvable pour l'item complété ${item.pdfFormId} — document omis de l'export`);
      continue;
    }
    const payload = state.payloads[form.id] as FormPayload | undefined;
    if (!payload) {
      console.warn(`[regenerate-pdfs] payload manquant pour ${form.slug} (marqué complété sans données) — document omis de l'export`);
      continue;
    }
    const source = await readSourcePdf(form.sourceStoragePath, form.sourceFileName);
    if (!source) {
      console.warn(`[regenerate-pdfs] PDF source introuvable pour ${form.slug} — document omis de l'export`);
      continue;
    }
    const fields = (form.fields as unknown as PdfFormField[]) || [];
    const technicalSchema = (form.technicalSchema as unknown as AcroFieldRaw[]) || [];
    // Réinjecte les valeurs auto-imposées par le serveur (date de création =
    // jour du téléchargement, signature = confirmée) que le payload stocké ne
    // contient pas : ces champs sont exclus du schéma Zod (donc jamais
    // persistés dans bundleRun.payloads). Sans ça, tous les PDF régénérés
    // depuis un dossier (téléchargement individuel, zip, email) sortaient sans
    // date ni signature — cf. applyServerAutoFields.
    const filled = applyServerAutoFields(fields, payload, todayISO());
    // Même filtre de visibilité que la route /generate : le zip et l'e-mail
    // repartent du payload stocké, qui contient lui aussi les valeurs devenues
    // invisibles avant l'envoi.
    const extraStamps = resolveStamps(visiblePayload(fields, filled), getRulesForSlug(form.slug));
    const { bytes, diagnostics } = await fillForm(source, fields, filled, {
      flatten: shouldFlattenGeneratedPdf(form.slug),
      technicalSchema,
      extraStamps,
      combWidgets: getCombWidgetsForSlug(form.slug),
    });
    docs.push({ filename: renderFilename(form.slug, filled), bytes });
    // Opposabilité (S7). Chaque régénération (zip, e-mail, téléchargement
    // unitaire) produit un document officiel remis au citoyen : elle laisse
    // donc la même trace qu'une génération directe. Écrit ICI et non dans les
    // trois routes appelantes — une seule place, aucune ne peut l'oublier.
    // `stablePayloadHash` vaudra celui de la génération d'origine : c'est
    // précisément ce qui établit qu'on a re-servi LE MÊME document, malgré une
    // date d'impression différente (décision n°5).
    logs.push({
      formId: form.id,
      formVersion: form.version,
      locale: form.defaultLocale,
      payloadHash: sha256Hex(JSON.stringify(filled)),
      stablePayloadHash: stablePayloadHashOf(filled, fields),
      diagnosticsSummary: buildDiagnosticsSummary(diagnostics) as unknown as Prisma.InputJsonValue,
      delivery: "regenerate",
      success: true,
      // Pas d'`ipHash` : la régénération est déclenchée par une route qui a
      // déjà son propre rate-limit par IP, et faire descendre la requête
      // jusqu'ici n'apporterait rien à l'opposabilité.
      userId: ownership.userId,
    });
  }

  // Best-effort, après coup : une écriture de log qui échoue ne doit jamais
  // priver le citoyen de ses documents (même règle que `logSubmission`).
  if (logs.length > 0) {
    try {
      await prisma.pdfFormSubmissionLog.createMany({ data: logs });
    } catch (err) {
      console.error("[regenerate-pdfs] log de régénération échoué (non bloquant) :", err);
    }
  }
  return docs;
}

/// Régénère TOUS les documents complétés (requis, visibles) d'un run — dans le
/// même ordre que `state.items`. Retourne `null` si le run n'est pas accessible
/// (propriété) OU si le dossier n'est pas encore complet (le verrou s'applique
/// aussi ici, pas seulement sur le téléchargement individuel).
export async function regenerateAllDocuments(
  bundleRunId: string,
  ownership: { userId: string | null; sessionId: string | null },
): Promise<{ state: DossierState; docs: RegeneratedDoc[] } | null> {
  const state = await loadDossierState(bundleRunId, ownership);
  if (!state || !state.allRequiredDone) return null;
  const docs = await regenerateItems(state, completedEligibleItems(state), ownership);
  return { state, docs };
}

/// Régénère UN SEUL document complété+éligible d'un run (téléchargement
/// individuel). Retourne `null` si le run n'est pas accessible/complet OU si
/// `pdfFormId` ne correspond pas à un document complété+éligible de ce run
/// (le caller traduit ce `null` en 404 — on ne distingue jamais « pas trouvé »
/// de « pas à toi » côté HTTP).
export async function regenerateOneDocument(
  bundleRunId: string,
  pdfFormId: string,
  ownership: { userId: string | null; sessionId: string | null },
): Promise<{ state: DossierState; doc: RegeneratedDoc } | null> {
  const state = await loadDossierState(bundleRunId, ownership);
  if (!state || !state.allRequiredDone) return null;
  const target = completedEligibleItems(state).find((it) => it.pdfFormId === pdfFormId);
  if (!target) return null;
  const docs = await regenerateItems(state, [target], ownership);
  if (docs.length === 0) return null;
  return { state, doc: docs[0] };
}
