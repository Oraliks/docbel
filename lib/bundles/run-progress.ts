/// Un `BundleRun` « a de la progression » dès qu'il porte au moins un document
/// complété, une réponse de pré-qualification, ou un payload de formulaire.
/// Sert à (1) ne pas traiter un run vide comme une reprise (page /d/[slug]),
/// (2) réutiliser un run vide au lieu d'en créer un doublon (« Nouvelle demande »).
export function bundleRunHasProgress(run: {
  completedTemplateIds: unknown;
  eligibilityAnswers: unknown;
  payloads: unknown;
}): boolean {
  const completed = Array.isArray(run.completedTemplateIds)
    ? run.completedTemplateIds.length
    : 0;
  const elig =
    run.eligibilityAnswers && typeof run.eligibilityAnswers === "object"
      ? Object.keys(run.eligibilityAnswers as Record<string, unknown>).length
      : 0;
  const payloads =
    run.payloads && typeof run.payloads === "object"
      ? Object.keys(run.payloads as Record<string, unknown>).length
      : 0;
  return completed > 0 || elig > 0 || payloads > 0;
}
