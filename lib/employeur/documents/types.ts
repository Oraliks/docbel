/**
 * Module 5 — Documents préparatoires employeur (spec §5).
 *
 * Configuration déclarative des types de documents : pour chaque type, un
 * libellé, une description et une liste ORDONNÉE de champs. Cette config est la
 * source unique pour :
 *   - le formulaire dynamique (`document-builder.tsx`),
 *   - le rendu texte FR (`render.ts`),
 *   - la validation des valeurs (clés connues).
 *
 * Aucun import React/serveur ici : module pur réutilisable côté client + API.
 */

import {
  WORKER_TYPES,
  CONTRACT_TYPES,
  type Option,
} from "@/lib/employeur/constants";

/** Les 5 types de documents préparatoires (spec §5). */
export const DOCUMENT_TYPES = [
  "fiche_travailleur",
  "demande_secretariat",
  "prepa_contrat_etudiant",
  "prepa_flexi",
  "verif_bareme",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type FieldType = "text" | "textarea" | "date" | "select";

export interface DocumentField {
  readonly key: string;
  readonly label: string;
  /** Clé i18n optionnelle pour `label` (namespace `public.employeurLib.documentTypes.<type>.fields.<key>.label`). FR `label` reste source/fallback. */
  readonly labelKey?: string;
  readonly type: FieldType;
  /** Uniquement pour `type: "select"`. */
  readonly options?: readonly Option[];
  /** Aide contextuelle (ton vulgarisé). */
  readonly help?: string;
  /** Clé i18n optionnelle pour `help` (namespace `public.employeurLib.documentTypes.<type>.fields.<key>.help`). */
  readonly helpKey?: string;
}

export interface DocumentTypeConfig {
  readonly type: DocumentType;
  readonly label: string;
  /** Clé i18n optionnelle pour `label` (namespace `public.employeurLib.documentTypes.<type>.label`). FR `label` reste source/fallback. */
  readonly labelKey?: string;
  readonly description: string;
  /** Clé i18n optionnelle pour `description` (namespace `public.employeurLib.documentTypes.<type>.description`). */
  readonly descriptionKey?: string;
  /** Active l'action « Ouvrir dans l'email » (mailto:) côté UI. */
  readonly emailable: boolean;
  readonly fields: readonly DocumentField[];
}

/** Régimes horaires courants (préparation, jamais bloquant). */
const SCHEDULE_OPTIONS: readonly Option[] = [
  { value: "temps_plein", label: "Temps plein", labelKey: "public.employeurLib.documentTypes.scheduleOptions.temps_plein" },
  { value: "temps_partiel", label: "Temps partiel", labelKey: "public.employeurLib.documentTypes.scheduleOptions.temps_partiel" },
  { value: "variable", label: "Horaire variable", labelKey: "public.employeurLib.documentTypes.scheduleOptions.variable" },
] as const;

/** Préfixe namespace i18n pour `documentTypes.<type>.fields.<key>`. */
const FT_FIELD = (type: DocumentType, key: string) =>
  `public.employeurLib.documentTypes.${type}.fields.${key}` as const;

const FICHE_TRAVAILLEUR: DocumentTypeConfig = {
  type: "fiche_travailleur",
  label: "Fiche travailleur",
  labelKey: "public.employeurLib.documentTypes.fiche_travailleur.label",
  description:
    "Récapitule les données du travailleur à transmettre à votre secrétariat social.",
  descriptionKey: "public.employeurLib.documentTypes.fiche_travailleur.description",
  emailable: false,
  fields: [
    { key: "lastName", label: "Nom", labelKey: FT_FIELD("fiche_travailleur", "lastName") + ".label", type: "text" },
    { key: "firstName", label: "Prénom", labelKey: FT_FIELD("fiche_travailleur", "firstName") + ".label", type: "text" },
    {
      key: "niss",
      label: "NISS (numéro de registre national)",
      labelKey: FT_FIELD("fiche_travailleur", "niss") + ".label",
      type: "text",
      help: "Facultatif — 11 chiffres. À transmettre uniquement si vous l'avez.",
      helpKey: FT_FIELD("fiche_travailleur", "niss") + ".help",
    },
    { key: "address", label: "Adresse", labelKey: FT_FIELD("fiche_travailleur", "address") + ".label", type: "textarea" },
    { key: "email", label: "E-mail", labelKey: FT_FIELD("fiche_travailleur", "email") + ".label", type: "text" },
    { key: "phone", label: "Téléphone", labelKey: FT_FIELD("fiche_travailleur", "phone") + ".label", type: "text" },
    { key: "startDate", label: "Date d'entrée prévue", labelKey: FT_FIELD("fiche_travailleur", "startDate") + ".label", type: "date" },
    { key: "functionTitle", label: "Fonction", labelKey: FT_FIELD("fiche_travailleur", "functionTitle") + ".label", type: "text" },
    {
      key: "schedule",
      label: "Régime horaire",
      labelKey: FT_FIELD("fiche_travailleur", "schedule") + ".label",
      type: "select",
      options: SCHEDULE_OPTIONS,
    },
    {
      key: "weeklyHours",
      label: "Horaire (heures/semaine)",
      labelKey: FT_FIELD("fiche_travailleur", "weeklyHours") + ".label",
      type: "text",
      help: "Ex. 38 (temps plein) ou 20 (temps partiel).",
      helpKey: FT_FIELD("fiche_travailleur", "weeklyHours") + ".help",
    },
    {
      key: "grossSalary",
      label: "Salaire brut mensuel (€)",
      labelKey: FT_FIELD("fiche_travailleur", "grossSalary") + ".label",
      type: "text",
    },
    {
      key: "benefits",
      label: "Avantages prévus",
      labelKey: FT_FIELD("fiche_travailleur", "benefits") + ".label",
      type: "textarea",
      help: "Ex. chèques-repas, écochèques, voiture…",
      helpKey: FT_FIELD("fiche_travailleur", "benefits") + ".help",
    },
    {
      key: "jointCommittee",
      label: "Commission paritaire (si connue)",
      labelKey: FT_FIELD("fiche_travailleur", "jointCommittee") + ".label",
      type: "text",
      help: "Ex. CP 200. À faire confirmer par le secrétariat social.",
      helpKey: FT_FIELD("fiche_travailleur", "jointCommittee") + ".help",
    },
    {
      key: "workerType",
      label: "Type de travailleur",
      labelKey: FT_FIELD("fiche_travailleur", "workerType") + ".label",
      type: "select",
      options: WORKER_TYPES,
    },
    {
      key: "contractType",
      label: "Type de contrat",
      labelKey: FT_FIELD("fiche_travailleur", "contractType") + ".label",
      type: "select",
      options: CONTRACT_TYPES,
    },
    { key: "workplace", label: "Lieu de travail", labelKey: FT_FIELD("fiche_travailleur", "workplace") + ".label", type: "text" },
    { key: "remark", label: "Remarque", labelKey: FT_FIELD("fiche_travailleur", "remark") + ".label", type: "textarea" },
  ],
};

const DEMANDE_SECRETARIAT: DocumentTypeConfig = {
  type: "demande_secretariat",
  label: "Demande au secrétariat social",
  labelKey: "public.employeurLib.documentTypes.demande_secretariat.label",
  description:
    "Message prêt à envoyer à votre secrétariat social pour préparer un engagement.",
  descriptionKey: "public.employeurLib.documentTypes.demande_secretariat.description",
  emailable: true,
  fields: [
    { key: "employerName", label: "Votre organisation", labelKey: FT_FIELD("demande_secretariat", "employerName") + ".label", type: "text" },
    {
      key: "employerRef",
      label: "Votre référence dossier / n° ONSS",
      labelKey: FT_FIELD("demande_secretariat", "employerRef") + ".label",
      type: "text",
      help: "Facultatif — aide le secrétariat à retrouver votre dossier.",
      helpKey: FT_FIELD("demande_secretariat", "employerRef") + ".help",
    },
    {
      key: "contactName",
      label: "Personne de contact (vous)",
      labelKey: FT_FIELD("demande_secretariat", "contactName") + ".label",
      type: "text",
    },
    { key: "workerName", label: "Identité du travailleur", labelKey: FT_FIELD("demande_secretariat", "workerName") + ".label", type: "text" },
    { key: "startDate", label: "Date d'entrée prévue", labelKey: FT_FIELD("demande_secretariat", "startDate") + ".label", type: "date" },
    {
      key: "contractType",
      label: "Type de contrat",
      labelKey: FT_FIELD("demande_secretariat", "contractType") + ".label",
      type: "select",
      options: CONTRACT_TYPES,
    },
    {
      key: "schedule",
      label: "Régime horaire",
      labelKey: FT_FIELD("demande_secretariat", "schedule") + ".label",
      type: "select",
      options: SCHEDULE_OPTIONS,
    },
    { key: "weeklyHours", label: "Horaire (heures/semaine)", labelKey: FT_FIELD("demande_secretariat", "weeklyHours") + ".label", type: "text" },
    { key: "grossSalary", label: "Salaire brut mensuel (€)", labelKey: FT_FIELD("demande_secretariat", "grossSalary") + ".label", type: "text" },
    {
      key: "benefits",
      label: "Avantages prévus",
      labelKey: FT_FIELD("demande_secretariat", "benefits") + ".label",
      type: "textarea",
      help: "Ex. chèques-repas, écochèques, voiture…",
      helpKey: FT_FIELD("demande_secretariat", "benefits") + ".help",
    },
    {
      key: "attachments",
      label: "Pièces jointes annoncées",
      labelKey: FT_FIELD("demande_secretariat", "attachments") + ".label",
      type: "textarea",
      help: "Ex. copie carte d'identité, projet de contrat…",
      helpKey: FT_FIELD("demande_secretariat", "attachments") + ".help",
    },
    {
      key: "questions",
      label: "Points à vérifier / questions",
      labelKey: FT_FIELD("demande_secretariat", "questions") + ".label",
      type: "textarea",
      help: "Ex. barème applicable, CP, réductions de cotisations…",
      helpKey: FT_FIELD("demande_secretariat", "questions") + ".help",
    },
  ],
};

const PREPA_CONTRAT_ETUDIANT: DocumentTypeConfig = {
  type: "prepa_contrat_etudiant",
  label: "Préparation contrat étudiant",
  labelKey: "public.employeurLib.documentTypes.prepa_contrat_etudiant.label",
  description:
    "Fiche de PRÉPARATION (ce n'est pas un contrat) : les mentions obligatoires à prévoir pour un contrat d'occupation d'étudiant.",
  descriptionKey: "public.employeurLib.documentTypes.prepa_contrat_etudiant.description",
  emailable: false,
  fields: [
    { key: "employerName", label: "Employeur", labelKey: FT_FIELD("prepa_contrat_etudiant", "employerName") + ".label", type: "text" },
    { key: "studentName", label: "Nom de l'étudiant", labelKey: FT_FIELD("prepa_contrat_etudiant", "studentName") + ".label", type: "text" },
    { key: "startDate", label: "Date de début", labelKey: FT_FIELD("prepa_contrat_etudiant", "startDate") + ".label", type: "date" },
    { key: "endDate", label: "Date de fin", labelKey: FT_FIELD("prepa_contrat_etudiant", "endDate") + ".label", type: "date" },
    { key: "functionTitle", label: "Fonction / tâches", labelKey: FT_FIELD("prepa_contrat_etudiant", "functionTitle") + ".label", type: "text" },
    { key: "workplace", label: "Lieu d'exécution", labelKey: FT_FIELD("prepa_contrat_etudiant", "workplace") + ".label", type: "text" },
    {
      key: "schedule",
      label: "Horaire de travail",
      labelKey: FT_FIELD("prepa_contrat_etudiant", "schedule") + ".label",
      type: "textarea",
      help: "Jours et heures prévus. À préciser dans le contrat écrit.",
      helpKey: FT_FIELD("prepa_contrat_etudiant", "schedule") + ".help",
    },
    {
      key: "grossSalary",
      label: "Rémunération prévue",
      labelKey: FT_FIELD("prepa_contrat_etudiant", "grossSalary") + ".label",
      type: "text",
      help: "À vérifier selon la CP applicable.",
      helpKey: FT_FIELD("prepa_contrat_etudiant", "grossSalary") + ".help",
    },
    {
      key: "jointCommittee",
      label: "Commission paritaire (si connue)",
      labelKey: FT_FIELD("prepa_contrat_etudiant", "jointCommittee") + ".label",
      type: "text",
    },
    {
      key: "quota",
      label: "Quota d'heures (475 h/an) — solde estimé",
      labelKey: FT_FIELD("prepa_contrat_etudiant", "quota") + ".label",
      type: "text",
      help: "Cotisations réduites dans la limite du contingent annuel. À confirmer (student@work).",
      helpKey: FT_FIELD("prepa_contrat_etudiant", "quota") + ".help",
    },
    { key: "remark", label: "Remarque", labelKey: FT_FIELD("prepa_contrat_etudiant", "remark") + ".label", type: "textarea" },
  ],
};

const PREPA_FLEXI: DocumentTypeConfig = {
  type: "prepa_flexi",
  label: "Préparation flexi-job",
  labelKey: "public.employeurLib.documentTypes.prepa_flexi.label",
  description:
    "Préparation d'un contrat-cadre flexi-job et des informations à réunir (ce n'est pas un contrat).",
  descriptionKey: "public.employeurLib.documentTypes.prepa_flexi.description",
  emailable: false,
  fields: [
    { key: "employerName", label: "Employeur", labelKey: FT_FIELD("prepa_flexi", "employerName") + ".label", type: "text" },
    { key: "workerName", label: "Nom du flexi-travailleur", labelKey: FT_FIELD("prepa_flexi", "workerName") + ".label", type: "text" },
    {
      key: "eligibility",
      label: "Conditions d'éligibilité vérifiées",
      labelKey: FT_FIELD("prepa_flexi", "eligibility") + ".label",
      type: "textarea",
      help: "Ex. occupation ≥ 4/5 chez un autre employeur au trimestre T-3 ; ou pensionné.",
      helpKey: FT_FIELD("prepa_flexi", "eligibility") + ".help",
    },
    { key: "startDate", label: "Début de l'occupation", labelKey: FT_FIELD("prepa_flexi", "startDate") + ".label", type: "date" },
    { key: "functionTitle", label: "Fonction prévue", labelKey: FT_FIELD("prepa_flexi", "functionTitle") + ".label", type: "text" },
    { key: "workplace", label: "Lieu de travail", labelKey: FT_FIELD("prepa_flexi", "workplace") + ".label", type: "text" },
    {
      key: "flexiSalary",
      label: "Flexi-salaire horaire (€)",
      labelKey: FT_FIELD("prepa_flexi", "flexiSalary") + ".label",
      type: "text",
      help: "Salaire minimum flexi à vérifier (indexé). Flexi-pécule de vacances en sus.",
      helpKey: FT_FIELD("prepa_flexi", "flexiSalary") + ".help",
    },
    {
      key: "jointCommittee",
      label: "Commission paritaire",
      labelKey: FT_FIELD("prepa_flexi", "jointCommittee") + ".label",
      type: "text",
      help: "Le flexi-job n'est ouvert qu'à certains secteurs. À confirmer.",
      helpKey: FT_FIELD("prepa_flexi", "jointCommittee") + ".help",
    },
    {
      key: "frameworkContract",
      label: "Contrat-cadre — points à prévoir",
      labelKey: FT_FIELD("prepa_flexi", "frameworkContract") + ".label",
      type: "textarea",
      help: "Le contrat-cadre écrit doit précéder la 1re occupation.",
      helpKey: FT_FIELD("prepa_flexi", "frameworkContract") + ".help",
    },
    { key: "remark", label: "Remarque", labelKey: FT_FIELD("prepa_flexi", "remark") + ".label", type: "textarea" },
  ],
};

const VERIF_BAREME: DocumentTypeConfig = {
  type: "verif_bareme",
  label: "Vérification du barème / CP",
  labelKey: "public.employeurLib.documentTypes.verif_bareme.label",
  description:
    "Court message demandant à un secrétariat social ou un conseiller de vérifier le barème et la commission paritaire applicables.",
  descriptionKey: "public.employeurLib.documentTypes.verif_bareme.description",
  emailable: true,
  fields: [
    { key: "employerName", label: "Votre organisation", labelKey: FT_FIELD("verif_bareme", "employerName") + ".label", type: "text" },
    { key: "functionTitle", label: "Fonction concernée", labelKey: FT_FIELD("verif_bareme", "functionTitle") + ".label", type: "text" },
    {
      key: "workerType",
      label: "Type de travailleur",
      labelKey: FT_FIELD("verif_bareme", "workerType") + ".label",
      type: "select",
      options: WORKER_TYPES,
    },
    {
      key: "jointCommittee",
      label: "Commission paritaire supposée",
      labelKey: FT_FIELD("verif_bareme", "jointCommittee") + ".label",
      type: "text",
      help: "Indiquez la CP que vous pensez applicable (si vous en avez une).",
      helpKey: FT_FIELD("verif_bareme", "jointCommittee") + ".help",
    },
    { key: "experience", label: "Ancienneté / expérience", labelKey: FT_FIELD("verif_bareme", "experience") + ".label", type: "text" },
    {
      key: "currentSalary",
      label: "Salaire envisagé (€)",
      labelKey: FT_FIELD("verif_bareme", "currentSalary") + ".label",
      type: "text",
    },
    {
      key: "schedule",
      label: "Régime horaire",
      labelKey: FT_FIELD("verif_bareme", "schedule") + ".label",
      type: "select",
      options: SCHEDULE_OPTIONS,
    },
    {
      key: "question",
      label: "Question précise",
      labelKey: FT_FIELD("verif_bareme", "question") + ".label",
      type: "textarea",
      help: "Ex. « Le barème minimum de la CP est-il respecté pour cette fonction ? »",
      helpKey: FT_FIELD("verif_bareme", "question") + ".help",
    },
  ],
};

export const DOCUMENT_CONFIGS: Record<DocumentType, DocumentTypeConfig> = {
  fiche_travailleur: FICHE_TRAVAILLEUR,
  demande_secretariat: DEMANDE_SECRETARIAT,
  prepa_contrat_etudiant: PREPA_CONTRAT_ETUDIANT,
  prepa_flexi: PREPA_FLEXI,
  verif_bareme: VERIF_BAREME,
};

export const DOCUMENT_CONFIG_LIST: readonly DocumentTypeConfig[] =
  DOCUMENT_TYPES.map((t) => DOCUMENT_CONFIGS[t]);

/** Valeurs d'un document : map clé → valeur (toujours string côté formulaire). */
export type DocumentValues = Record<string, string>;

export function isDocumentType(value: unknown): value is DocumentType {
  return (
    typeof value === "string" && (DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

export function getDocumentConfig(type: DocumentType): DocumentTypeConfig {
  return DOCUMENT_CONFIGS[type];
}

/** Libellé d'une valeur de select (sinon la valeur brute), pour le rendu texte. */
export function labelFieldValue(field: DocumentField, value: string): string {
  if (field.type !== "select" || !field.options) return value;
  return field.options.find((o) => o.value === value)?.label ?? value;
}
