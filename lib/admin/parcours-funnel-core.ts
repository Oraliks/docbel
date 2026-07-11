/**
 * Funnel « Parcours » unifié (Lot 3) — cœur PUR (sans prisma), testable.
 *
 * Rassemble en UNE séquence les moitiés jusque-là éclatées entre deux dashboards :
 * orientation (events wizard), dossier (run) et documents. L'ordre, les libellés
 * et le regroupement par phase sont définis ici, une seule fois.
 *
 * NB honnêteté des données : les 5 premières étapes viennent d'events réellement
 * émis (BundleAnalyticsEvent). La dernière (« Documents obtenus ») vient d'un event
 * `documents_downloaded` AJOUTÉ avec ce lot — l'ancien signal de complétion
 * (`BundleRun.completedAt`) n'était jamais écrit, donc inutilisable.
 */

export type ParcoursPhase = "orientation" | "dossier" | "documents";

export interface ParcoursStage {
  key: string;
  label: string;
  phase: ParcoursPhase;
  count: number;
}

export interface ParcoursCounts {
  /** `search_performed` — recherche de dossier sur /mon-dossier. */
  search: number;
  /** `wizard_started` — début du questionnaire d'orientation. */
  wizardStarted: number;
  /** `wizard_result_shown` — un résultat d'orientation a été présenté. */
  resultShown: number;
  /** `bundle_opened` — ouverture d'un dossier. */
  opened: number;
  /** `run_created` — un run (dossier réellement démarré) est créé. */
  runCreated: number;
  /** `documents_downloaded` — l'usager a récupéré ses documents (zip/email). */
  documents: number;
}

/** Ordre + libellés + phase des étapes du parcours (source de vérité). */
export const PARCOURS_STAGE_DEFS: {
  key: keyof ParcoursCounts;
  label: string;
  phase: ParcoursPhase;
}[] = [
  { key: "search", label: "Recherches", phase: "orientation" },
  { key: "wizardStarted", label: "Orientation démarrée", phase: "orientation" },
  { key: "resultShown", label: "Résultat d'orientation", phase: "orientation" },
  { key: "opened", label: "Dossier ouvert", phase: "dossier" },
  { key: "runCreated", label: "Dossier démarré", phase: "dossier" },
  { key: "documents", label: "Documents obtenus", phase: "documents" },
];

/** Assemble la séquence d'étapes à partir des comptes bruts. */
export function assembleParcoursStages(counts: ParcoursCounts): ParcoursStage[] {
  return PARCOURS_STAGE_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    phase: d.phase,
    count: counts[d.key],
  }));
}

/** Comptes tous à zéro (repli sûr en cas d'indisponibilité DB). */
export function zeroParcoursCounts(): ParcoursCounts {
  return {
    search: 0,
    wizardStarted: 0,
    resultShown: 0,
    opened: 0,
    runCreated: 0,
    documents: 0,
  };
}

/**
 * Taux de conversion (%) entre chaque étape et la précédente. Longueur
 * `stages.length - 1` ; `null` quand l'étape précédente vaut 0 (pas de base).
 */
export function stageConversions(stages: ParcoursStage[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1].count;
    out.push(prev === 0 ? null : Math.round((stages[i].count / prev) * 100));
  }
  return out;
}
