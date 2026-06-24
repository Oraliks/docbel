/**
 * Docbel Employeur — ensembles de valeurs bornées (workerType, contractType, …)
 * et leurs libellés FR. Source unique pour le wizard, la validation Zod, le
 * moteur de règles, l'UI et l'admin. Stockés en `String` en base (pas d'enum
 * Postgres) pour rester extensibles côté admin.
 */

export interface Option {
  readonly value: string;
  readonly label: string;
  /** Clé i18n optionnelle (namespace `public.employeurLib.constants.*`). */
  readonly labelKey?: string;
  /** Aide contextuelle (tooltip) — ton vulgarisé. */
  readonly help?: string;
}

export const LEGAL_FORMS = [
  { value: "independant", label: "Indépendant (personne physique)", labelKey: "public.employeurLib.constants.legalForm.independant" },
  { value: "srl", label: "SRL", labelKey: "public.employeurLib.constants.legalForm.srl" },
  { value: "asbl", label: "ASBL", labelKey: "public.employeurLib.constants.legalForm.asbl" },
  { value: "societe_etrangere", label: "Société étrangère", labelKey: "public.employeurLib.constants.legalForm.societe_etrangere" },
  { value: "autre", label: "Autre", labelKey: "public.employeurLib.constants.legalForm.autre" },
] as const satisfies readonly Option[];

export const REGIONS = [
  { value: "wallonia", label: "Wallonie", labelKey: "public.employeurLib.constants.region.wallonia" },
  { value: "flanders", label: "Flandre", labelKey: "public.employeurLib.constants.region.flanders" },
  { value: "brussels", label: "Bruxelles", labelKey: "public.employeurLib.constants.region.brussels" },
  { value: "multi", label: "Plusieurs régions", labelKey: "public.employeurLib.constants.region.multi" },
] as const satisfies readonly Option[];

export const WORKER_TYPES = [
  { value: "employe", label: "Employé", labelKey: "public.employeurLib.constants.workerType.employe" },
  { value: "ouvrier", label: "Ouvrier", labelKey: "public.employeurLib.constants.workerType.ouvrier" },
  { value: "etudiant", label: "Étudiant", labelKey: "public.employeurLib.constants.workerType.etudiant" },
  { value: "flexi_job", label: "Flexi-job", labelKey: "public.employeurLib.constants.workerType.flexi_job" },
  { value: "interim", label: "Intérim", labelKey: "public.employeurLib.constants.workerType.interim" },
  { value: "stagiaire", label: "Stagiaire", labelKey: "public.employeurLib.constants.workerType.stagiaire" },
  { value: "autre", label: "Autre", labelKey: "public.employeurLib.constants.workerType.autre" },
] as const satisfies readonly Option[];

export const CONTRACT_TYPES = [
  { value: "cdi", label: "CDI (durée indéterminée)", labelKey: "public.employeurLib.constants.contractType.cdi" },
  { value: "cdd", label: "CDD (durée déterminée)", labelKey: "public.employeurLib.constants.contractType.cdd" },
  { value: "temps_plein", label: "Temps plein", labelKey: "public.employeurLib.constants.contractType.temps_plein" },
  { value: "temps_partiel", label: "Temps partiel", labelKey: "public.employeurLib.constants.contractType.temps_partiel" },
  { value: "remplacement", label: "Remplacement", labelKey: "public.employeurLib.constants.contractType.remplacement" },
  { value: "etudiant", label: "Contrat étudiant", labelKey: "public.employeurLib.constants.contractType.etudiant" },
  { value: "flexi_job", label: "Contrat flexi-job", labelKey: "public.employeurLib.constants.contractType.flexi_job" },
  { value: "interim", label: "Intérim", labelKey: "public.employeurLib.constants.contractType.interim" },
  { value: "autre", label: "Autre", labelKey: "public.employeurLib.constants.contractType.autre" },
] as const satisfies readonly Option[];

export const BENEFIT_TYPES = [
  { value: "voiture", label: "Voiture", labelKey: "public.employeurLib.constants.benefitType.voiture" },
  { value: "cheques_repas", label: "Chèques-repas", labelKey: "public.employeurLib.constants.benefitType.cheques_repas" },
  { value: "ecocheques", label: "Écochèques", labelKey: "public.employeurLib.constants.benefitType.ecocheques" },
  { value: "frais_forfaitaires", label: "Frais forfaitaires", labelKey: "public.employeurLib.constants.benefitType.frais_forfaitaires" },
  { value: "bonus", label: "Bonus", labelKey: "public.employeurLib.constants.benefitType.bonus" },
  { value: "prime", label: "Prime", labelKey: "public.employeurLib.constants.benefitType.prime" },
  { value: "telephone", label: "Téléphone", labelKey: "public.employeurLib.constants.benefitType.telephone" },
  { value: "ordinateur", label: "Ordinateur", labelKey: "public.employeurLib.constants.benefitType.ordinateur" },
  { value: "assurance_groupe", label: "Assurance groupe", labelKey: "public.employeurLib.constants.benefitType.assurance_groupe" },
  { value: "autre", label: "Autre", labelKey: "public.employeurLib.constants.benefitType.autre" },
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
  { value: "premier_engagement", label: "Premier engagement", labelKey: "public.employeurLib.constants.checklistCategory.premier_engagement" },
  { value: "engagement_classique", label: "Engagement classique", labelKey: "public.employeurLib.constants.checklistCategory.engagement_classique" },
  { value: "etudiant", label: "Étudiant", labelKey: "public.employeurLib.constants.checklistCategory.etudiant" },
  { value: "flexi_job", label: "Flexi-job", labelKey: "public.employeurLib.constants.checklistCategory.flexi_job" },
  { value: "temps_partiel", label: "Temps partiel", labelKey: "public.employeurLib.constants.checklistCategory.temps_partiel" },
  { value: "chomage_temporaire", label: "Chômage temporaire", labelKey: "public.employeurLib.constants.checklistCategory.chomage_temporaire" },
  { value: "sortie_service", label: "Sortie de service", labelKey: "public.employeurLib.constants.checklistCategory.sortie_service" },
] as const satisfies readonly Option[];

export const ITEM_PRIORITIES = [
  { value: "obligatoire", label: "Obligatoire", labelKey: "public.employeurLib.constants.itemPriority.obligatoire" },
  { value: "recommande", label: "Recommandé", labelKey: "public.employeurLib.constants.itemPriority.recommande" },
  { value: "optionnel", label: "Optionnel", labelKey: "public.employeurLib.constants.itemPriority.optionnel" },
] as const satisfies readonly Option[];

export const ITEM_STATUSES = [
  { value: "todo", label: "À faire", labelKey: "public.employeurLib.constants.itemStatus.todo" },
  { value: "in_progress", label: "En cours", labelKey: "public.employeurLib.constants.itemStatus.in_progress" },
  { value: "done", label: "Fait", labelKey: "public.employeurLib.constants.itemStatus.done" },
  { value: "not_applicable", label: "Non applicable", labelKey: "public.employeurLib.constants.itemStatus.not_applicable" },
  { value: "needs_review", label: "À vérifier", labelKey: "public.employeurLib.constants.itemStatus.needs_review" },
] as const satisfies readonly Option[];

export const SCENARIO_STATUSES = [
  { value: "draft", label: "Brouillon", labelKey: "public.employeurLib.constants.scenarioStatus.draft" },
  { value: "ready", label: "Prêt", labelKey: "public.employeurLib.constants.scenarioStatus.ready" },
  { value: "exported", label: "Exporté", labelKey: "public.employeurLib.constants.scenarioStatus.exported" },
  { value: "archived", label: "Archivé", labelKey: "public.employeurLib.constants.scenarioStatus.archived" },
] as const satisfies readonly Option[];

export const ALERT_SEVERITIES = [
  { value: "info", label: "Info", labelKey: "public.employeurLib.constants.alertSeverity.info" },
  { value: "warning", label: "Attention", labelKey: "public.employeurLib.constants.alertSeverity.warning" },
  { value: "critical", label: "Critique", labelKey: "public.employeurLib.constants.alertSeverity.critical" },
] as const satisfies readonly Option[];

export const RELIABILITY_LEVELS = [
  { value: "low", label: "Faible", labelKey: "public.employeurLib.constants.reliability.low" },
  { value: "medium", label: "Moyenne", labelKey: "public.employeurLib.constants.reliability.medium" },
  { value: "high", label: "Bonne", labelKey: "public.employeurLib.constants.reliability.high" },
  { value: "needs_human_validation", label: "À valider", labelKey: "public.employeurLib.constants.reliability.needs_human_validation" },
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

/**
 * Donne la clé i18n (`labelKey`) associée à une valeur, pour résolution côté UI.
 * Retourne `undefined` si la valeur n'est pas trouvée — l'appelant doit alors
 * retomber sur le libellé FR via `labelWorkerType`/`labelXxx` (fallback).
 */
function makeKeyLookup(options: readonly Option[]): (value: string | null | undefined) => string | undefined {
  const map = new Map(options.map((o) => [o.value, o.labelKey]));
  return (value) => (value == null ? undefined : map.get(value));
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

export const keyWorkerType = makeKeyLookup(WORKER_TYPES);
export const keyContractType = makeKeyLookup(CONTRACT_TYPES);
export const keyLegalForm = makeKeyLookup(LEGAL_FORMS);
export const keyRegion = makeKeyLookup(REGIONS);
export const keyBenefit = makeKeyLookup(BENEFIT_TYPES);
export const keyCategory = makeKeyLookup(CHECKLIST_CATEGORIES);
export const keyPriority = makeKeyLookup(ITEM_PRIORITIES);
export const keyItemStatus = makeKeyLookup(ITEM_STATUSES);
export const keyScenarioStatus = makeKeyLookup(SCENARIO_STATUSES);
export const keySeverity = makeKeyLookup(ALERT_SEVERITIES);
export const keyReliability = makeKeyLookup(RELIABILITY_LEVELS);

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
