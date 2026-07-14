/**
 * Funnel « Parcours » unifié — cœur PUR (sans prisma), testable.
 *
 * Lot 5 — de-conflation. Le modèle historique écrasait TROIS unités
 * incompatibles dans une seule colonne terminale (« Documents obtenus ») :
 *   - des events zip/e-mail (`documents_downloaded`, dossier entier),
 *   - des PDF unitaires (`PdfFormSubmissionLog`, par formulaire),
 *   - des dossiers complétés (`BundleRun.completedAt`).
 * D'où la contradiction « 0 documents obtenus » à côté de « N PDF générés ».
 *
 * On sépare désormais explicitement :
 *   - `interactionStages` : les 5 étapes en UNITÉ « événement » (search →
 *     orientation démarrée → résultat vu → dossiers ouverts → dossiers démarrés).
 *     Les conversions ne se calculent QUE à l'intérieur de ce bloc, jamais vers
 *     les métriques d'entité (unités différentes = non convertibles).
 *   - `entityMetrics` : 3 nombres, chacun ÉTIQUETÉ par son unité (pdf / dossiers
 *     / retraits). Ils ne se convertissent ni entre eux ni depuis les étapes.
 */

export type InteractionPhase = "orientation" | "dossier";

export type InteractionKey =
  | "search"
  | "wizardStarted"
  | "resultShown"
  | "opened"
  | "runCreated";

export type EntityKey = "pdfGenerated" | "dossiersComplets" | "documentsRetrieved";

/** Unité d'une métrique d'entité : sert de garde-fou anti-fusion à l'affichage. */
export type EntityUnit = "pdf" | "dossiers" | "retraits";

export interface InteractionStage {
  key: InteractionKey;
  label: string;
  phase: InteractionPhase;
  count: number;
}

export interface EntityMetric {
  key: EntityKey;
  label: string;
  unit: EntityUnit;
  count: number;
}

export interface ParcoursCounts {
  /** `search_performed` — recherche de dossier sur /mon-dossier. */
  search: number;
  /** `wizard_started` — début du questionnaire d'orientation. */
  wizardStarted: number;
  /** `wizard_result_shown` — un résultat d'orientation a été présenté. */
  resultShown: number;
  /** `bundle_opened` — ouverture (fraîche) d'un dossier. */
  opened: number;
  /** `run_created` — un run (dossier réellement démarré) est créé. */
  runCreated: number;
  /** `PdfFormSubmissionLog` succès, delivery ∈ {download,doccle} — un PDF produit. */
  pdfGenerated: number;
  /** `BundleRun.completedAt` posé sur la période — dossier complété. */
  dossiersComplets: number;
  /** `documents_downloaded` — récupération groupée (zip/e-mail) du dossier. */
  documentsRetrieved: number;
}

export interface ParcoursFunnelModel {
  interactionStages: InteractionStage[];
  entityMetrics: EntityMetric[];
}

/** Ordre + libellés + phase des étapes d'INTERACTION (source de vérité). */
export const INTERACTION_STAGE_DEFS: {
  key: InteractionKey;
  label: string;
  phase: InteractionPhase;
}[] = [
  { key: "search", label: "Recherches (interactions)", phase: "orientation" },
  { key: "wizardStarted", label: "Orientation démarrée", phase: "orientation" },
  { key: "resultShown", label: "Résultat vu", phase: "orientation" },
  { key: "opened", label: "Dossiers ouverts", phase: "dossier" },
  { key: "runCreated", label: "Dossiers démarrés", phase: "dossier" },
];

/** Ordre + libellés + unité des métriques d'ENTITÉ (source de vérité). */
export const ENTITY_METRIC_DEFS: {
  key: EntityKey;
  label: string;
  unit: EntityUnit;
}[] = [
  { key: "pdfGenerated", label: "PDF générés", unit: "pdf" },
  { key: "dossiersComplets", label: "Dossiers complets", unit: "dossiers" },
  {
    key: "documentsRetrieved",
    label: "Documents récupérés (zip/e-mail)",
    unit: "retraits",
  },
];

/** Assemble le modèle complet (étapes + métriques) à partir des comptes bruts. */
export function buildParcoursModel(counts: ParcoursCounts): ParcoursFunnelModel {
  return {
    interactionStages: INTERACTION_STAGE_DEFS.map((d) => ({
      key: d.key,
      label: d.label,
      phase: d.phase,
      count: counts[d.key],
    })),
    entityMetrics: ENTITY_METRIC_DEFS.map((d) => ({
      key: d.key,
      label: d.label,
      unit: d.unit,
      count: counts[d.key],
    })),
  };
}

/** Comptes tous à zéro (repli sûr en cas d'indisponibilité DB). */
export function zeroParcoursCounts(): ParcoursCounts {
  return {
    search: 0,
    wizardStarted: 0,
    resultShown: 0,
    opened: 0,
    runCreated: 0,
    pdfGenerated: 0,
    dossiersComplets: 0,
    documentsRetrieved: 0,
  };
}

/**
 * Taux de conversion (%) entre chaque étape d'interaction et la précédente.
 * Longueur `stages.length - 1` — les conversions NE traversent JAMAIS la
 * frontière vers les métriques d'entité (unités incompatibles). `null` quand
 * l'étape précédente vaut 0 (pas de base).
 */
export function interactionConversions(
  stages: InteractionStage[],
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1].count;
    out.push(prev === 0 ? null : Math.round((stages[i].count / prev) * 100));
  }
  return out;
}

/** Deliveries de `PdfFormSubmissionLog` qui correspondent à un PDF réellement produit. */
export const GENERATED_PDF_DELIVERIES = ["download", "doccle"] as const;

export type PdfDeliveryClass = "generated" | "saved" | "other";

/**
 * Classe une valeur `delivery` de `PdfFormSubmissionLog` :
 *   - download|doccle → `generated` (un PDF a été produit),
 *   - save            → `saved` (persisté dans un dossier, AUCUN PDF),
 *   - autre           → `other`.
 * Garde-fou : un `save` ne doit JAMAIS gonfler « PDF générés ».
 */
export function classifyPdfDelivery(delivery: string): PdfDeliveryClass {
  if ((GENERATED_PDF_DELIVERIES as readonly string[]).includes(delivery)) {
    return "generated";
  }
  if (delivery === "save") return "saved";
  return "other";
}
