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
  /** Clé i18n optionnelle pour `title` (FR `title` reste source/fallback). Namespace `public.employeurLib.starterRules.<code>.title`. */
  titleKey?: string;
  description: string;
  /** Clé i18n optionnelle pour `description`. Namespace `public.employeurLib.starterRules.<code>.description`. */
  descriptionKey?: string;
  conditionJson: ConditionGroup;
  outputJson: RuleOutput[];
  /**
   * Clés i18n optionnelles pour les sorties (`outputJson`), indexées par leur
   * position (ex. `item0`, `alert1`). Namespace
   * `public.employeurLib.starterRules.<code>.outputs.<itemN|alertN>.{title|description|tooltip|message}`.
   * FR reste source/fallback dans `outputJson`.
   */
  outputKeys?: Record<
    string,
    { titleKey?: string; descriptionKey?: string; tooltipKey?: string; messageKey?: string }
  >;
  severity: "info" | "warning" | "critical";
  sourceCode: string | null;
  internalNote?: string | null;
}

const T = SCENARIO_TEMPLATE_ID;

/** Préfixe namespace pour les clés starterRules. */
const SR = (code: string) => `public.employeurLib.starterRules.${code}` as const;

export const STARTER_RULES: StarterRule[] = [
  {
    code: "first_engagement_wide",
    title: "Premier engagement → identification employeur (WIDE)",
    titleKey: SR("first_engagement_wide") + ".title",
    description:
      "Pas de personnel et pas de numéro ONSS (ou inconnu) : l'entreprise doit s'identifier comme employeur.",
    descriptionKey: SR("first_engagement_wide") + ".description",
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
    outputKeys: {
      item0: {
        titleKey: SR("first_engagement_wide") + ".outputs.item0.title",
        descriptionKey: SR("first_engagement_wide") + ".outputs.item0.description",
        tooltipKey: SR("first_engagement_wide") + ".outputs.item0.tooltip",
      },
    },
    severity: "info",
    sourceCode: "S1",
  },
  {
    code: "dimona_required",
    title: "Travailleur salarié → Dimona",
    titleKey: SR("dimona_required") + ".title",
    description: "Un travailleur salarié nécessite une déclaration Dimona.",
    descriptionKey: SR("dimona_required") + ".description",
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
    outputKeys: {
      item0: {
        titleKey: SR("dimona_required") + ".outputs.item0.title",
        descriptionKey: SR("dimona_required") + ".outputs.item0.description",
        tooltipKey: SR("dimona_required") + ".outputs.item0.tooltip",
      },
    },
    severity: "info",
    sourceCode: "S2",
  },
  {
    code: "part_time_written",
    title: "Temps partiel → contrat écrit (régime + horaire)",
    titleKey: SR("part_time_written") + ".title",
    description: "Un régime à temps partiel impose un écrit avec régime de travail et horaire.",
    descriptionKey: SR("part_time_written") + ".description",
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
    outputKeys: {
      alert0: { messageKey: SR("part_time_written") + ".outputs.alert0.message" },
      item1: {
        titleKey: SR("part_time_written") + ".outputs.item1.title",
        descriptionKey: SR("part_time_written") + ".outputs.item1.description",
      },
    },
    severity: "warning",
    sourceCode: "S6",
  },
  {
    code: "cp_unknown_reliability",
    title: "CP inconnue → fiabilité faible",
    titleKey: SR("cp_unknown_reliability") + ".title",
    description:
      "Sans commission paritaire, le salaire minimum sectoriel ne peut pas être vérifié précisément.",
    descriptionKey: SR("cp_unknown_reliability") + ".description",
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
    outputKeys: {
      alert1: { messageKey: SR("cp_unknown_reliability") + ".outputs.alert1.message" },
    },
    severity: "warning",
    sourceCode: "S8",
  },
  {
    code: "salary_vs_cp",
    title: "Salaire encodé mais CP absente → barème non vérifiable",
    titleKey: SR("salary_vs_cp") + ".title",
    description: "Un salaire est encodé alors que la commission paritaire est inconnue.",
    descriptionKey: SR("salary_vs_cp") + ".description",
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
    outputKeys: {
      alert0: { messageKey: SR("salary_vs_cp") + ".outputs.alert0.message" },
    },
    severity: "info",
    sourceCode: "S8",
  },
  {
    code: "student_checklist",
    title: "Étudiant → contrat étudiant + mentions obligatoires",
    titleKey: SR("student_checklist") + ".title",
    description: "Un travailleur étudiant nécessite un contrat écrit et des mentions obligatoires.",
    descriptionKey: SR("student_checklist") + ".description",
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
    outputKeys: {
      item0: { titleKey: SR("student_checklist") + ".outputs.item0.title" },
      item1: { titleKey: SR("student_checklist") + ".outputs.item1.title" },
      item2: { titleKey: SR("student_checklist") + ".outputs.item2.title" },
      item3: { titleKey: SR("student_checklist") + ".outputs.item3.title" },
      alert4: { messageKey: SR("student_checklist") + ".outputs.alert4.message" },
    },
    severity: "info",
    sourceCode: "S9",
  },
  {
    code: "flexi_contract_frame",
    title: "Flexi-job → contrat-cadre écrit",
    titleKey: SR("flexi_contract_frame") + ".title",
    description: "Un flexi-job nécessite un contrat-cadre écrit et des conditions spécifiques.",
    descriptionKey: SR("flexi_contract_frame") + ".description",
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
    outputKeys: {
      item0: { titleKey: SR("flexi_contract_frame") + ".outputs.item0.title" },
      item1: { titleKey: SR("flexi_contract_frame") + ".outputs.item1.title" },
      item2: { titleKey: SR("flexi_contract_frame") + ".outputs.item2.title" },
      alert3: { messageKey: SR("flexi_contract_frame") + ".outputs.alert3.message" },
    },
    severity: "warning",
    sourceCode: "S10",
  },
];
