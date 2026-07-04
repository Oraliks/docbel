// Verrou de génération : décide si un document "gatedByRestOfDossier" (en
// pratique, C109/36-DEMANDE du dossier allocations-insertion) peut être
// généré maintenant, ou doit attendre que le reste du dossier soit complet.
//
// Extrait comme module `lib/` pur (pas de Prisma, pas d'auth) plutôt que
// défini dans app/api/pdf/[slug]/generate/route.ts, pour rester testable
// sans dépendre de l'infrastructure de la route (import statique de
// @/lib/auth, qui lève au chargement du module si BETTER_AUTH_SECRET est
// absent — vrai dans l'environnement de test).

import { selectDocuments, type DossierAnswers, type DossierDefinition } from "@/lib/dossiers/types";

/// Vrai si `targetSlug` est marqué `gatedByRestOfDossier` dans `dossier` ET
/// qu'il manque au moins un autre document obligatoire+applicable pour
/// débloquer sa génération — soit parce qu'une question d'aiguillage n'a
/// pas de réponse, soit parce qu'un document de branche ou un document
/// déclenché par un autre formulaire n'est pas encore complété. Pure : ne
/// touche ni la DB ni le réseau, pour rester testable en isolation.
export function isGeneratingBlocked(params: {
  dossier: DossierDefinition;
  targetSlug: string;
  answers: DossierAnswers;
  /// Slugs des PdfForms déjà complétés dans ce run (dérivés de
  /// `completedTemplateIds` par le caller — cf. Step 5).
  completedSlugs: string[];
  triggeredSlugs: string[];
}): boolean {
  const target = params.dossier.documents.find((d) => d.slug === params.targetSlug);
  if (!target?.gatedByRestOfDossier) return false;

  const allAnswered = params.dossier.questions.every((q) => {
    const v = params.answers[q.id];
    return v !== undefined && v !== "";
  });
  if (!allAnswered) return true;

  const applicable = selectDocuments(params.dossier, params.answers);
  const requiredOtherSlugs = new Set<string>();
  for (const doc of applicable) {
    if (doc.slug === params.targetSlug) continue;
    if (!doc.required) continue;
    // Seuls les documents remplissables (fields non vide OU sourcePdfPath)
    // ont un pdfFormId à compléter — les documents à charge d'un tiers
    // (responsibility ≠ "user") ne bloquent pas ce verrou.
    if (doc.responsibility && doc.responsibility !== "user") continue;
    requiredOtherSlugs.add(doc.slug);
  }
  for (const slug of params.triggeredSlugs) {
    if (slug !== params.targetSlug) requiredOtherSlugs.add(slug);
  }

  const completed = new Set(params.completedSlugs);
  for (const slug of requiredOtherSlugs) {
    if (!completed.has(slug)) return true;
  }
  return false;
}
