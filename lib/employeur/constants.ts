/**
 * Docbel Employeur — ensembles de valeurs bornées (workerType, contractType, …)
 * et leurs libellés FR. Source unique pour le wizard, la validation Zod, le
 * moteur de règles, l'UI et l'admin. Stockés en `String` en base (pas d'enum
 * Postgres) pour rester extensibles côté admin.
 */

export interface Option {
  readonly value: string;
  readonly label: string;
  /** Aide contextuelle (tooltip) — ton vulgarisé. */
  readonly help?: string;
}

export const LEGAL_FORMS = [
  { value: "independant", label: "Indépendant (personne physique)" },
  { value: "srl", label: "SRL" },
  { value: "asbl", label: "ASBL" },
  { value: "societe_etrangere", label: "Société étrangère" },
  { value: "autre", label: "Autre" },
] as const satisfies readonly Option[];

export const REGIONS = [
  { value: "wallonia", label: "Wallonie" },
  { value: "flanders", label: "Flandre" },
  { value: "brussels", label: "Bruxelles" },
  { value: "multi", label: "Plusieurs régions" },
] as const satisfies readonly Option[];

export const WORKER_TYPES = [
  { value: "employe", label: "Employé" },
  { value: "ouvrier", label: "Ouvrier" },
  { value: "etudiant", label: "Étudiant" },
  { value: "flexi_job", label: "Flexi-job" },
  { value: "interim", label: "Intérim" },
  { value: "stagiaire", label: "Stagiaire" },
  { value: "autre", label: "Autre" },
] as const satisfies readonly Option[];

export const CONTRACT_TYPES = [
  { value: "cdi", label: "CDI (durée indéterminée)" },
  { value: "cdd", label: "CDD (durée déterminée)" },
  { value: "temps_plein", label: "Temps plein" },
  { value: "temps_partiel", label: "Temps partiel" },
  { value: "remplacement", label: "Remplacement" },
  { value: "etudiant", label: "Contrat étudiant" },
  { value: "flexi_job", label: "Contrat flexi-job" },
  { value: "interim", label: "Intérim" },
  { value: "autre", label: "Autre" },
] as const satisfies readonly Option[];

export const BENEFIT_TYPES = [
  { value: "voiture", label: "Voiture" },
  { value: "cheques_repas", label: "Chèques-repas" },
  { value: "ecocheques", label: "Écochèques" },
  { value: "frais_forfaitaires", label: "Frais forfaitaires" },
  { value: "bonus", label: "Bonus" },
  { value: "prime", label: "Prime" },
  { value: "telephone", label: "Téléphone" },
  { value: "ordinateur", label: "Ordinateur" },
  { value: "assurance_groupe", label: "Assurance groupe" },
  { value: "autre", label: "Autre" },
] as const satisfies readonly Option[];

/** Travailleurs salariés : déclenchent l'obligation Dimona. */
export const SALARIED_WORKER_TYPES = [
  "employe",
  "ouvrier",
  "etudiant",
  "flexi_job",
  "interim",
] as const;

export const CHECKLIST_CATEGORIES = [
  { value: "premier_engagement", label: "Premier engagement" },
  { value: "engagement_classique", label: "Engagement classique" },
  { value: "etudiant", label: "Étudiant" },
  { value: "flexi_job", label: "Flexi-job" },
  { value: "temps_partiel", label: "Temps partiel" },
  { value: "chomage_temporaire", label: "Chômage temporaire" },
  { value: "sortie_service", label: "Sortie de service" },
] as const satisfies readonly Option[];

export const ITEM_PRIORITIES = [
  { value: "obligatoire", label: "Obligatoire" },
  { value: "recommande", label: "Recommandé" },
  { value: "optionnel", label: "Optionnel" },
] as const satisfies readonly Option[];

export const ITEM_STATUSES = [
  { value: "todo", label: "À faire" },
  { value: "in_progress", label: "En cours" },
  { value: "done", label: "Fait" },
  { value: "not_applicable", label: "Non applicable" },
  { value: "needs_review", label: "À vérifier" },
] as const satisfies readonly Option[];

export const SCENARIO_STATUSES = [
  { value: "draft", label: "Brouillon" },
  { value: "ready", label: "Prêt" },
  { value: "exported", label: "Exporté" },
  { value: "archived", label: "Archivé" },
] as const satisfies readonly Option[];

export const ALERT_SEVERITIES = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Attention" },
  { value: "critical", label: "Critique" },
] as const satisfies readonly Option[];

export const RELIABILITY_LEVELS = [
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Bonne" },
  { value: "needs_human_validation", label: "À valider" },
] as const satisfies readonly Option[];

// --- unions dérivées -------------------------------------------------------

export type LegalForm = (typeof LEGAL_FORMS)[number]["value"];
export type Region = (typeof REGIONS)[number]["value"];
export type WorkerType = (typeof WORKER_TYPES)[number]["value"];
export type ContractType = (typeof CONTRACT_TYPES)[number]["value"];
export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number]["value"];
export type ItemPriority = (typeof ITEM_PRIORITIES)[number]["value"];
export type ItemStatus = (typeof ITEM_STATUSES)[number]["value"];
export type ScenarioStatus = (typeof SCENARIO_STATUSES)[number]["value"];
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number]["value"];
export type ReliabilityLevel = (typeof RELIABILITY_LEVELS)[number]["value"];

// --- helpers de libellé ----------------------------------------------------

function makeLabeller(options: readonly Option[]): (value: string | null | undefined) => string {
  const map = new Map(options.map((o) => [o.value, o.label]));
  return (value) => (value == null ? "" : (map.get(value) ?? value));
}

export const labelWorkerType = makeLabeller(WORKER_TYPES);
export const labelContractType = makeLabeller(CONTRACT_TYPES);
export const labelLegalForm = makeLabeller(LEGAL_FORMS);
export const labelRegion = makeLabeller(REGIONS);
export const labelBenefit = makeLabeller(BENEFIT_TYPES);
export const labelCategory = makeLabeller(CHECKLIST_CATEGORIES);
export const labelPriority = makeLabeller(ITEM_PRIORITIES);
export const labelItemStatus = makeLabeller(ITEM_STATUSES);
export const labelScenarioStatus = makeLabeller(SCENARIO_STATUSES);
export const labelSeverity = makeLabeller(ALERT_SEVERITIES);
export const labelReliability = makeLabeller(RELIABILITY_LEVELS);

/** Ordre d'affichage des items (Critère §9.3 : obligatoire avant le reste). */
export const PRIORITY_RANK: Record<string, number> = {
  obligatoire: 0,
  recommande: 1,
  optionnel: 2,
};

/** Rang de fiabilité — le plus bas (le plus conservateur) l'emporte. */
export const RELIABILITY_RANK: Record<string, number> = {
  needs_human_validation: 0,
  low: 1,
  medium: 2,
  high: 3,
};
