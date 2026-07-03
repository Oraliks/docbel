/// Sérialiseurs purs pour l'écran d'explication (DossierJourneyIntro).
///
/// Les warnings/documents d'un dossier codé portent des fonctions
/// (`visibleWhen`, `includeWhen`) et des tableaux de champs non transmissibles
/// à un composant client. Ces fonctions réduisent chaque structure à sa forme
/// sérialisable minimale, en évaluant les conditions côté serveur.

import type { WarningSeverity } from "@/lib/bundles/types";
import type { DossierWarning, DossierDocument, DossierAnswers } from "./types";

/// Avertissement sérialisable pour la sidebar de l'écran d'explication.
export interface JourneyWarning {
  title: string;
  titleKey?: string;
  message: string;
  messageKey?: string;
  severity: WarningSeverity;
}

/// Document sérialisable pour la sidebar (aide-mémoire « à prévoir »).
export interface JourneyDocument {
  slug: string;
  title: string;
  titleKey?: string;
  issuer: string;
  required: boolean;
}

/// Filtre les warnings selon `visibleWhen` (avec les réponses connues) et
/// retire la fonction pour ne garder que les champs sérialisables.
export function serializeJourneyWarnings(
  warnings: DossierWarning[],
  answers: DossierAnswers,
): JourneyWarning[] {
  return warnings
    .filter((w) => (w.visibleWhen ? w.visibleWhen(answers) : true))
    .map((w) => ({
      title: w.title,
      titleKey: w.titleKey,
      message: w.message,
      messageKey: w.messageKey,
      severity: w.severity,
    }));
}

/// Réduit les documents (déjà filtrés par `selectDocuments`) à leur forme
/// d'affichage. `required` par défaut = true (cohérent avec le runner).
export function serializeJourneyDocuments(
  docs: DossierDocument[],
): JourneyDocument[] {
  return docs.map((d) => ({
    slug: d.slug,
    title: d.title,
    titleKey: d.titleKey,
    issuer: d.issuer,
    required: d.required ?? true,
  }));
}
