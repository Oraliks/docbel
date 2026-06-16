/**
 * Boussole d'orientation — les 15 questions V1 et leur barème de points par
 * branche. Source de vérité pour le seed (OrientationQuestion / Option / Score)
 * et fallback pour le moteur. Les questions restent configurables en admin :
 * à l'exécution on recharge depuis la DB, mais la structure est identique.
 *
 * Barème volontairement souple (heuristique, ajustable en admin). "Je ne sais
 * pas" n'apporte aucun point. "Un peu" apporte un signal léger.
 */
import type { BranchKey } from "./branches";

export type AnswerValue = "oui" | "un_peu" | "non" | "je_ne_sais_pas";

export interface AnswerOptionDef {
  value: AnswerValue;
  label: string;
  /** Points apportés à chaque branche (clé → points). */
  scores: Partial<Record<BranchKey, number>>;
}

export interface QuestionDef {
  /** Clé stable (q1..q15) — sert d'identifiant côté seed/moteur. */
  key: string;
  text: string;
  description?: string;
  options: AnswerOptionDef[];
}

/** Options standard réutilisées (libellés). Les scores diffèrent par question. */
const A = {
  oui: (scores: AnswerOptionDef["scores"]): AnswerOptionDef => ({
    value: "oui",
    label: "Oui",
    scores,
  }),
  unPeu: (scores: AnswerOptionDef["scores"]): AnswerOptionDef => ({
    value: "un_peu",
    label: "Un peu",
    scores,
  }),
  non: (scores: AnswerOptionDef["scores"]): AnswerOptionDef => ({
    value: "non",
    label: "Non",
    scores,
  }),
  idk: (): AnswerOptionDef => ({
    value: "je_ne_sais_pas",
    label: "Je ne sais pas",
    scores: {},
  }),
};

export const QUESTIONS: QuestionDef[] = [
  {
    key: "q1",
    text: "Tu veux changer de métier ou te réorienter ?",
    description: "Il n'y a pas de mauvaise réponse — c'est juste pour mieux te situer.",
    options: [
      A.oui({}),
      A.unPeu({}),
      A.non({}),
      A.idk(),
    ],
  },
  {
    key: "q2",
    text: "Tu préfères travailler avec des personnes plutôt qu'avec des objets ou des machines ?",
    options: [
      A.oui({ SOCIAL_CARE: 3, HEALTH_WELLBEING: 2, SALES_CUSTOMER: 2, ADMINISTRATIVE_OFFICE: 1 }),
      A.unPeu({ SOCIAL_CARE: 1, SALES_CUSTOMER: 1, DIGITAL_IT: 1 }),
      A.non({ DIGITAL_IT: 2, TECHNICAL_MANUAL: 3, LOGISTICS_TRANSPORT: 2 }),
      A.idk(),
    ],
  },
  {
    key: "q3",
    text: "Tu aimerais un métier principalement manuel ?",
    options: [
      A.oui({ TECHNICAL_MANUAL: 3, LOGISTICS_TRANSPORT: 2, HEALTH_WELLBEING: 1 }),
      A.unPeu({ TECHNICAL_MANUAL: 1, LOGISTICS_TRANSPORT: 1 }),
      A.non({ ADMINISTRATIVE_OFFICE: 2, DIGITAL_IT: 2, SALES_CUSTOMER: 1 }),
      A.idk(),
    ],
  },
  {
    key: "q4",
    text: "Tu es à l'aise avec l'ordinateur ?",
    options: [
      A.oui({ DIGITAL_IT: 3, ADMINISTRATIVE_OFFICE: 2, SALES_CUSTOMER: 1 }),
      A.unPeu({ DIGITAL_IT: 1, ADMINISTRATIVE_OFFICE: 1 }),
      A.non({ TECHNICAL_MANUAL: 2, LOGISTICS_TRANSPORT: 2, HEALTH_WELLBEING: 1, SOCIAL_CARE: 1 }),
      A.idk(),
    ],
  },
  {
    key: "q5",
    text: "Tu préfères un métier stable et structuré ?",
    options: [
      A.oui({ ADMINISTRATIVE_OFFICE: 3, LOGISTICS_TRANSPORT: 1, HEALTH_WELLBEING: 1 }),
      A.unPeu({ ADMINISTRATIVE_OFFICE: 1 }),
      A.non({ ENTREPRENEURSHIP: 3, SALES_CUSTOMER: 1 }),
      A.idk(),
    ],
  },
  {
    key: "q6",
    text: "Tu veux une formation courte pour avancer rapidement ?",
    options: [
      A.oui({ LOGISTICS_TRANSPORT: 2, SALES_CUSTOMER: 2, ADMINISTRATIVE_OFFICE: 1, SOCIAL_CARE: 1 }),
      A.unPeu({ LOGISTICS_TRANSPORT: 1, SALES_CUSTOMER: 1 }),
      A.non({ DIGITAL_IT: 1, HEALTH_WELLBEING: 1 }),
      A.idk(),
    ],
  },
  {
    key: "q7",
    text: "Tu es prêt à suivre une formation longue si elle ouvre plus de portes ?",
    options: [
      A.oui({ DIGITAL_IT: 2, HEALTH_WELLBEING: 2, ADMINISTRATIVE_OFFICE: 1 }),
      A.unPeu({ DIGITAL_IT: 1 }),
      A.non({ LOGISTICS_TRANSPORT: 1, SALES_CUSTOMER: 1 }),
      A.idk(),
    ],
  },
  {
    key: "q8",
    text: "Tu veux éviter un métier trop physique ?",
    options: [
      A.oui({ ADMINISTRATIVE_OFFICE: 2, DIGITAL_IT: 2, SALES_CUSTOMER: 1 }),
      A.unPeu({ ADMINISTRATIVE_OFFICE: 1, DIGITAL_IT: 1 }),
      A.non({ TECHNICAL_MANUAL: 3, LOGISTICS_TRANSPORT: 2, HEALTH_WELLBEING: 1 }),
      A.idk(),
    ],
  },
  {
    key: "q9",
    text: "Tu aimerais aider ou accompagner des personnes ?",
    options: [
      A.oui({ SOCIAL_CARE: 3, HEALTH_WELLBEING: 3 }),
      A.unPeu({ SOCIAL_CARE: 1, HEALTH_WELLBEING: 1 }),
      A.non({ DIGITAL_IT: 1, TECHNICAL_MANUAL: 1, LOGISTICS_TRANSPORT: 1 }),
      A.idk(),
    ],
  },
  {
    key: "q10",
    text: "Tu es à l'aise avec la vente ou le contact client ?",
    options: [
      A.oui({ SALES_CUSTOMER: 3, ENTREPRENEURSHIP: 2, SOCIAL_CARE: 1 }),
      A.unPeu({ SALES_CUSTOMER: 1 }),
      A.non({ TECHNICAL_MANUAL: 1, ADMINISTRATIVE_OFFICE: 1, DIGITAL_IT: 1 }),
      A.idk(),
    ],
  },
  {
    key: "q11",
    text: "Tu aimes organiser, classer, gérer des documents ou suivre des dossiers ?",
    options: [
      A.oui({ ADMINISTRATIVE_OFFICE: 3, LOGISTICS_TRANSPORT: 1 }),
      A.unPeu({ ADMINISTRATIVE_OFFICE: 1 }),
      A.non({ TECHNICAL_MANUAL: 1, SALES_CUSTOMER: 1 }),
      A.idk(),
    ],
  },
  {
    key: "q12",
    text: "Tu préfères bouger plutôt que rester assis toute la journée ?",
    options: [
      A.oui({ LOGISTICS_TRANSPORT: 3, TECHNICAL_MANUAL: 2, HEALTH_WELLBEING: 1, SALES_CUSTOMER: 1 }),
      A.unPeu({ LOGISTICS_TRANSPORT: 1 }),
      A.non({ ADMINISTRATIVE_OFFICE: 2, DIGITAL_IT: 2 }),
      A.idk(),
    ],
  },
  {
    key: "q13",
    text: "Tu préfères travailler de façon autonome ?",
    description: "Plutôt seul ou en petite équipe, sans dépendre en permanence des autres.",
    options: [
      A.oui({ DIGITAL_IT: 2, ENTREPRENEURSHIP: 2, TECHNICAL_MANUAL: 1 }),
      A.unPeu({ DIGITAL_IT: 1, ENTREPRENEURSHIP: 1 }),
      A.non({ SOCIAL_CARE: 1, SALES_CUSTOMER: 1, LOGISTICS_TRANSPORT: 1 }),
      A.idk(),
    ],
  },
  {
    key: "q14",
    text: "Tu aimerais créer ton activité plus tard ?",
    options: [
      A.oui({ ENTREPRENEURSHIP: 3, SALES_CUSTOMER: 1 }),
      A.unPeu({ ENTREPRENEURSHIP: 1 }),
      A.non({ ADMINISTRATIVE_OFFICE: 1 }),
      A.idk(),
    ],
  },
  {
    key: "q15",
    text: "Tu as besoin d'une remise à niveau avant une formation métier ?",
    options: [
      A.oui({ ADMINISTRATIVE_OFFICE: 1, SOCIAL_CARE: 1, LOGISTICS_TRANSPORT: 1 }),
      A.unPeu({}),
      A.non({ DIGITAL_IT: 1, HEALTH_WELLBEING: 1 }),
      A.idk(),
    ],
  },
];

export const QUESTION_BY_KEY: Record<string, QuestionDef> = Object.fromEntries(
  QUESTIONS.map((q) => [q.key, q]),
);
