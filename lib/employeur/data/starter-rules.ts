/**
 * Jeu de règles initial du moteur déterministe (spec §9.2).
 * Semé en base (EmployerRule) et utilisé par les tests du moteur.
 *
 * Chaque condition est un arbre ConditionGroup dont les feuilles ciblent
 * `sourceTemplateId = "scenario"`. Chaque règle porte une source officielle
 * (Critère 8 : pas de publication sans source ou justification interne).
 */
import type { ConditionGroup } from "@/lib/bundles/conditions";
import { SALARIED_WORKER_TYPES } from "../constants";
import { SCENARIO_TEMPLATE_ID } from "../rules/payload";
import type { RuleOutput } from "../rules/output";

export interface StarterRule {
  code: string;
  title: string;
  description: string;
  conditionJson: ConditionGroup;
  outputJson: RuleOutput[];
  severity: "info" | "warning" | "critical";
  sourceCode: string | null;
  internalNote?: string | null;
}

const T = SCENARIO_TEMPLATE_ID;

export const STARTER_RULES: StarterRule[] = [
  {
    code: "first_engagement_wide",
    title: "Premier engagement → identification employeur (WIDE)",
    description:
      "Pas de personnel et pas de numéro ONSS (ou inconnu) : l'entreprise doit s'identifier comme employeur.",
    conditionJson: {
      type: "and",
      rules: [
        { type: "leaf", sourceTemplateId: T, fieldId: "hasEmployees", op: "falsy" },
        { type: "leaf", sourceTemplateId: T, fieldId: "hasOnssNumber", op: "falsy" },
      ],
    },
    outputJson: [
      {
        kind: "checklist_item",
        title: "Demander l'identification employeur via WIDE (ONSS)",
        description:
          "Avant de déclarer un travailleur, l'entreprise doit vérifier si elle doit s'identifier comme employeur auprès de l'ONSS. La demande se fait via WIDE.",
        priority: "obligatoire",
        sourceCode: "S1",
        tooltip: "Sans qualité d'employeur ONSS, aucune déclaration n'est possible.",
      },
    ],
    severity: "info",
    sourceCode: "S1",
  },
  {
    code: "dimona_required",
    title: "Travailleur salarié → Dimona",
    description: "Un travailleur salarié nécessite une déclaration Dimona.",
    conditionJson: {
      type: "and",
      rules: [
        {
          type: "leaf",
          sourceTemplateId: T,
          fieldId: "workerType",
          op: "in",
          value: [...SALARIED_WORKER_TYPES],
        },
      ],
    },
    outputJson: [
      {
        kind: "checklist_item",
        title: "Préparer la déclaration Dimona (entrée en service)",
        description:
          "Une déclaration Dimona est en principe nécessaire pour déclarer l'entrée (et la sortie) de service du travailleur, avant le début de l'occupation.",
        priority: "obligatoire",
        sourceCode: "S2",
        tooltip: "À effectuer AVANT l'entrée en service.",
      },
    ],
    severity: "info",
    sourceCode: "S2",
  },
  {
    code: "part_time_written",
    title: "Temps partiel → contrat écrit (régime + horaire)",
    description: "Un régime à temps partiel impose un écrit avec régime de travail et horaire.",
    conditionJson: {
      type: "and",
      rules: [{ type: "leaf", sourceTemplateId: T, fieldId: "isPartTime", op: "truthy" }],
    },
    outputJson: [
      {
        kind: "alert",
        severity: "warning",
        message:
          "Le contrat à temps partiel doit être établi par écrit et mentionner le régime de travail et l'horaire convenu.",
        sourceCode: "S6",
      },
      {
        kind: "checklist_item",
        title: "Établir le contrat à temps partiel par écrit (régime + horaire)",
        description:
          "Le contrat à temps partiel doit être écrit et contenir le régime de travail et l'horaire convenu.",
        priority: "obligatoire",
        sourceCode: "S6",
      },
    ],
    severity: "warning",
    sourceCode: "S6",
  },
  {
    code: "cp_unknown_reliability",
    title: "CP inconnue → fiabilité faible",
    description:
      "Sans commission paritaire, le salaire minimum sectoriel ne peut pas être vérifié précisément.",
    conditionJson: {
      type: "and",
      rules: [
        { type: "leaf", sourceTemplateId: T, fieldId: "jointCommitteeNumber", op: "isEmpty" },
      ],
    },
    outputJson: [
      { kind: "reliability", level: "low" },
      {
        kind: "alert",
        severity: "warning",
        message:
          "Commission paritaire non renseignée : le salaire minimum sectoriel ne peut pas être vérifié précisément.",
        sourceCode: "S8",
      },
    ],
    severity: "warning",
    sourceCode: "S8",
  },
  {
    code: "salary_vs_cp",
    title: "Salaire encodé mais CP absente → barème non vérifiable",
    description: "Un salaire est encodé alors que la commission paritaire est inconnue.",
    conditionJson: {
      type: "and",
      rules: [
        { type: "leaf", sourceTemplateId: T, fieldId: "grossMonthlySalary", op: "isNotEmpty" },
        { type: "leaf", sourceTemplateId: T, fieldId: "jointCommitteeNumber", op: "isEmpty" },
      ],
    },
    outputJson: [
      {
        kind: "alert",
        severity: "info",
        message:
          "Un salaire brut est encodé mais la commission paritaire est inconnue : impossible de vérifier le barème minimum applicable.",
        sourceCode: "S8",
      },
    ],
    severity: "info",
    sourceCode: "S8",
  },
  {
    code: "student_checklist",
    title: "Étudiant → contrat étudiant + mentions obligatoires",
    description: "Un travailleur étudiant nécessite un contrat écrit et des mentions obligatoires.",
    conditionJson: {
      type: "and",
      rules: [{ type: "leaf", sourceTemplateId: T, fieldId: "workerType", op: "equals", value: "etudiant" }],
    },
    outputJson: [
      {
        kind: "checklist_item",
        title: "Établir un contrat d'occupation d'étudiant écrit",
        priority: "obligatoire",
        sourceCode: "S9",
      },
      {
        kind: "checklist_item",
        title: "Vérifier les mentions obligatoires (CP, horaire, rémunération, période d'occupation)",
        priority: "obligatoire",
        sourceCode: "S9",
      },
      {
        kind: "checklist_item",
        title: "Préparer la Dimona étudiant (type STU)",
        priority: "obligatoire",
        sourceCode: "S2",
      },
      {
        kind: "checklist_item",
        title: "Vérifier le quota d'heures étudiant disponible",
        priority: "recommande",
        sourceCode: "S9",
      },
      {
        kind: "alert",
        severity: "info",
        message:
          "Un contrat d'occupation d'étudiant doit contenir les mentions obligatoires : commission paritaire, horaire, rémunération et période d'occupation.",
        sourceCode: "S9",
      },
    ],
    severity: "info",
    sourceCode: "S9",
  },
  {
    code: "flexi_contract_frame",
    title: "Flexi-job → contrat-cadre écrit",
    description: "Un flexi-job nécessite un contrat-cadre écrit et des conditions spécifiques.",
    conditionJson: {
      type: "or",
      rules: [
        { type: "leaf", sourceTemplateId: T, fieldId: "workerType", op: "equals", value: "flexi_job" },
        { type: "leaf", sourceTemplateId: T, fieldId: "contractType", op: "equals", value: "flexi_job" },
      ],
    },
    outputJson: [
      {
        kind: "checklist_item",
        title: "Établir un contrat-cadre flexi-job écrit avant la première occupation",
        priority: "obligatoire",
        sourceCode: "S10",
      },
      {
        kind: "checklist_item",
        title: "Vérifier les conditions d'accès du travailleur au flexi-job",
        priority: "obligatoire",
        sourceCode: "S10",
      },
      {
        kind: "checklist_item",
        title: "Préparer la Dimona flexi-job (type FLX)",
        priority: "obligatoire",
        sourceCode: "S2",
      },
      {
        kind: "alert",
        severity: "warning",
        message:
          "Le flexi-job nécessite un contrat-cadre écrit avant la première occupation, ainsi que des règles spécifiques de déclaration et de conditions d'accès.",
        sourceCode: "S10",
      },
    ],
    severity: "warning",
    sourceCode: "S10",
  },
];
