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
  readonly type: FieldType;
  /** Uniquement pour `type: "select"`. */
  readonly options?: readonly Option[];
  /** Aide contextuelle (ton vulgarisé). */
  readonly help?: string;
}

export interface DocumentTypeConfig {
  readonly type: DocumentType;
  readonly label: string;
  readonly description: string;
  /** Active l'action « Ouvrir dans l'email » (mailto:) côté UI. */
  readonly emailable: boolean;
  readonly fields: readonly DocumentField[];
}

/** Régimes horaires courants (préparation, jamais bloquant). */
const SCHEDULE_OPTIONS: readonly Option[] = [
  { value: "temps_plein", label: "Temps plein" },
  { value: "temps_partiel", label: "Temps partiel" },
  { value: "variable", label: "Horaire variable" },
] as const;

const FICHE_TRAVAILLEUR: DocumentTypeConfig = {
  type: "fiche_travailleur",
  label: "Fiche travailleur",
  description:
    "Récapitule les données du travailleur à transmettre à votre secrétariat social.",
  emailable: false,
  fields: [
    { key: "lastName", label: "Nom", type: "text" },
    { key: "firstName", label: "Prénom", type: "text" },
    {
      key: "niss",
      label: "NISS (numéro de registre national)",
      type: "text",
      help: "Facultatif — 11 chiffres. À transmettre uniquement si vous l'avez.",
    },
    { key: "address", label: "Adresse", type: "textarea" },
    { key: "email", label: "E-mail", type: "text" },
    { key: "phone", label: "Téléphone", type: "text" },
    { key: "startDate", label: "Date d'entrée prévue", type: "date" },
    { key: "functionTitle", label: "Fonction", type: "text" },
    {
      key: "schedule",
      label: "Régime horaire",
      type: "select",
      options: SCHEDULE_OPTIONS,
    },
    {
      key: "weeklyHours",
      label: "Horaire (heures/semaine)",
      type: "text",
      help: "Ex. 38 (temps plein) ou 20 (temps partiel).",
    },
    {
      key: "grossSalary",
      label: "Salaire brut mensuel (€)",
      type: "text",
    },
    {
      key: "benefits",
      label: "Avantages prévus",
      type: "textarea",
      help: "Ex. chèques-repas, écochèques, voiture…",
    },
    {
      key: "jointCommittee",
      label: "Commission paritaire (si connue)",
      type: "text",
      help: "Ex. CP 200. À faire confirmer par le secrétariat social.",
    },
    {
      key: "workerType",
      label: "Type de travailleur",
      type: "select",
      options: WORKER_TYPES,
    },
    {
      key: "contractType",
      label: "Type de contrat",
      type: "select",
      options: CONTRACT_TYPES,
    },
    { key: "workplace", label: "Lieu de travail", type: "text" },
    { key: "remark", label: "Remarque", type: "textarea" },
  ],
};

const DEMANDE_SECRETARIAT: DocumentTypeConfig = {
  type: "demande_secretariat",
  label: "Demande au secrétariat social",
  description:
    "Message prêt à envoyer à votre secrétariat social pour préparer un engagement.",
  emailable: true,
  fields: [
    { key: "employerName", label: "Votre organisation", type: "text" },
    {
      key: "employerRef",
      label: "Votre référence dossier / n° ONSS",
      type: "text",
      help: "Facultatif — aide le secrétariat à retrouver votre dossier.",
    },
    {
      key: "contactName",
      label: "Personne de contact (vous)",
      type: "text",
    },
    { key: "workerName", label: "Identité du travailleur", type: "text" },
    { key: "startDate", label: "Date d'entrée prévue", type: "date" },
    {
      key: "contractType",
      label: "Type de contrat",
      type: "select",
      options: CONTRACT_TYPES,
    },
    {
      key: "schedule",
      label: "Régime horaire",
      type: "select",
      options: SCHEDULE_OPTIONS,
    },
    { key: "weeklyHours", label: "Horaire (heures/semaine)", type: "text" },
    { key: "grossSalary", label: "Salaire brut mensuel (€)", type: "text" },
    {
      key: "benefits",
      label: "Avantages prévus",
      type: "textarea",
      help: "Ex. chèques-repas, écochèques, voiture…",
    },
    {
      key: "attachments",
      label: "Pièces jointes annoncées",
      type: "textarea",
      help: "Ex. copie carte d'identité, projet de contrat…",
    },
    {
      key: "questions",
      label: "Points à vérifier / questions",
      type: "textarea",
      help: "Ex. barème applicable, CP, réductions de cotisations…",
    },
  ],
};

const PREPA_CONTRAT_ETUDIANT: DocumentTypeConfig = {
  type: "prepa_contrat_etudiant",
  label: "Préparation contrat étudiant",
  description:
    "Fiche de PRÉPARATION (ce n'est pas un contrat) : les mentions obligatoires à prévoir pour un contrat d'occupation d'étudiant.",
  emailable: false,
  fields: [
    { key: "employerName", label: "Employeur", type: "text" },
    { key: "studentName", label: "Nom de l'étudiant", type: "text" },
    { key: "startDate", label: "Date de début", type: "date" },
    { key: "endDate", label: "Date de fin", type: "date" },
    { key: "functionTitle", label: "Fonction / tâches", type: "text" },
    { key: "workplace", label: "Lieu d'exécution", type: "text" },
    {
      key: "schedule",
      label: "Horaire de travail",
      type: "textarea",
      help: "Jours et heures prévus. À préciser dans le contrat écrit.",
    },
    {
      key: "grossSalary",
      label: "Rémunération prévue",
      type: "text",
      help: "À vérifier selon la CP applicable.",
    },
    {
      key: "jointCommittee",
      label: "Commission paritaire (si connue)",
      type: "text",
    },
    {
      key: "quota",
      label: "Quota d'heures (475 h/an) — solde estimé",
      type: "text",
      help: "Cotisations réduites dans la limite du contingent annuel. À confirmer (student@work).",
    },
    { key: "remark", label: "Remarque", type: "textarea" },
  ],
};

const PREPA_FLEXI: DocumentTypeConfig = {
  type: "prepa_flexi",
  label: "Préparation flexi-job",
  description:
    "Préparation d'un contrat-cadre flexi-job et des informations à réunir (ce n'est pas un contrat).",
  emailable: false,
  fields: [
    { key: "employerName", label: "Employeur", type: "text" },
    { key: "workerName", label: "Nom du flexi-travailleur", type: "text" },
    {
      key: "eligibility",
      label: "Conditions d'éligibilité vérifiées",
      type: "textarea",
      help: "Ex. occupation ≥ 4/5 chez un autre employeur au trimestre T-3 ; ou pensionné.",
    },
    { key: "startDate", label: "Début de l'occupation", type: "date" },
    { key: "functionTitle", label: "Fonction prévue", type: "text" },
    { key: "workplace", label: "Lieu de travail", type: "text" },
    {
      key: "flexiSalary",
      label: "Flexi-salaire horaire (€)",
      type: "text",
      help: "Salaire minimum flexi à vérifier (indexé). Flexi-pécule de vacances en sus.",
    },
    {
      key: "jointCommittee",
      label: "Commission paritaire",
      type: "text",
      help: "Le flexi-job n'est ouvert qu'à certains secteurs. À confirmer.",
    },
    {
      key: "frameworkContract",
      label: "Contrat-cadre — points à prévoir",
      type: "textarea",
      help: "Le contrat-cadre écrit doit précéder la 1re occupation.",
    },
    { key: "remark", label: "Remarque", type: "textarea" },
  ],
};

const VERIF_BAREME: DocumentTypeConfig = {
  type: "verif_bareme",
  label: "Vérification du barème / CP",
  description:
    "Court message demandant à un secrétariat social ou un conseiller de vérifier le barème et la commission paritaire applicables.",
  emailable: true,
  fields: [
    { key: "employerName", label: "Votre organisation", type: "text" },
    { key: "functionTitle", label: "Fonction concernée", type: "text" },
    {
      key: "workerType",
      label: "Type de travailleur",
      type: "select",
      options: WORKER_TYPES,
    },
    {
      key: "jointCommittee",
      label: "Commission paritaire supposée",
      type: "text",
      help: "Indiquez la CP que vous pensez applicable (si vous en avez une).",
    },
    { key: "experience", label: "Ancienneté / expérience", type: "text" },
    {
      key: "currentSalary",
      label: "Salaire envisagé (€)",
      type: "text",
    },
    {
      key: "schedule",
      label: "Régime horaire",
      type: "select",
      options: SCHEDULE_OPTIONS,
    },
    {
      key: "question",
      label: "Question précise",
      type: "textarea",
      help: "Ex. « Le barème minimum de la CP est-il respecté pour cette fonction ? »",
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
