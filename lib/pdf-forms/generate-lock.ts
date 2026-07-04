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

/// Un item réduit à ce qu'il faut pour résoudre un id de PdfForm vers son
/// slug — sert aux items réels du bundle ET aux formulaires compagnons
/// déclenchés (jamais des items réels, cf. commentaire plus bas).
export interface ResolvableItem {
  pdfFormId: string | null;
  pdfFormSlug: string | null;
}

/// Résout `completedTemplateIds` (des id de PdfForm) en slugs. Prend en
/// compte à la fois les items réels du bundle ET les formulaires compagnons
/// déclenchés par un trigger (`c1-regis`, `c1a`, etc.) — ces derniers ne
/// sont JAMAIS des `DocumentBundleItem` en base (cf. lib/dossiers/seed.ts,
/// qui ne crée des items que pour les documents propres du dossier) : sans
/// cette résolution séparée, un compagnon complété n'est jamais reconnu
/// comme tel, et un document `gatedByRestOfDossier` reste verrouillé pour
/// toujours dès qu'un compagnon est déclenché. Pure — aucun accès DB ici ;
/// le caller fournit déjà les données nécessaires (items du bundle +
/// formulaires compagnons, récupérés séparément).
export function resolveCompletedSlugs(
  bundleItems: ResolvableItem[],
  triggeredForms: ResolvableItem[],
  completedTemplateIds: string[],
): string[] {
  const idToSlug = new Map<string, string>();
  for (const it of bundleItems) {
    if (it.pdfFormId && it.pdfFormSlug) idToSlug.set(it.pdfFormId, it.pdfFormSlug);
  }
  for (const f of triggeredForms) {
    if (f.pdfFormId && f.pdfFormSlug) idToSlug.set(f.pdfFormId, f.pdfFormSlug);
  }
  return completedTemplateIds
    .map((id) => idToSlug.get(id))
    .filter((s): s is string => !!s);
}

/// Questions qui doivent avoir une réponse avant qu'un document
/// `gatedByRestOfDossier` du dossier ne puisse se débloquer. Si aucune
/// question n'est marquée `gatesDocuments`, toutes le sont par défaut (cf.
/// DossierQuestion.gatesDocuments). Exportée séparément pour être réutilisée
/// côté page (affichage) sans dupliquer ce filtre.
export function areGatingQuestionsAnswered(
  questions: DossierDefinition["questions"],
  answers: DossierAnswers,
): boolean {
  const gating = questions.some((q) => q.gatesDocuments)
    ? questions.filter((q) => q.gatesDocuments)
    : questions;
  return gating.every((q) => {
    const v = answers[q.id];
    return v !== undefined && v !== "";
  });
}

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

  if (!areGatingQuestionsAnswered(params.dossier.questions, params.answers)) return true;

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
