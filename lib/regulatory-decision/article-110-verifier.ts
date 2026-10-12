import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";
import { activeFirstProfessionalIncomePersonIds } from "./article-110-child-income";
import {
  evaluateFamilySituation,
  householdCompositionFromFamilyFacts,
  type FamilyFacts,
  type FamilyIncome,
  type FamilyPerson,
  type HouseholdRelation,
} from "./household-composition";

/** Facts entered in the partner checker. This module deliberately has no document state. */
export type Article110VerifierPerson = {
  id: string;
  relation: HouseholdRelation;
  label?: string;
  partnerEstablished?: boolean;
  isAscendant?: boolean;
  receivesFamilyAllowances?: boolean;
  hasProfessionalIncome?: boolean;
  professionalIncomeAmount?: number;
  professionalIncomeType?: "employee" | "independent" | "other";
  professionalIncomeContract?: "cdi" | "cdd" | "other";
  professionalIncomeVariable?: boolean;
  /** Availability and amount declared on the C110A for the assessed month. */
  c110aReceived?: boolean;
  c110aMonthlyDeclaredIncome?: number;
  firstProfessionalIncome?: boolean;
  neutralisationRequested?: boolean;
  firstProfessionalIncomeStartedAt?: string;
  studiesEndedAt?: string;
  hasReplacementIncome?: boolean;
  replacementIncomeType?: "unemployment" | "mutuality" | "pension" | "disability_allowance" | "other";
  replacementIncomeAmount?: number;
};

export type Article110VerifierInput = {
  people: Article110VerifierPerson[];
  thresholds: C1BaremeThresholds;
  asOf?: string;
  isAloneExplicit?: boolean;
  officialOnemCode?: string;
  /** Asked only for a household composed exclusively of third parties. */
  cohousing?: boolean;
  alimony?: { enabled?: boolean; legalConditionEstablished?: boolean; beneficiary?: "minor_child" | "adult_child" | "other"; adultChildInNeed?: boolean };
  alternatingCare?: { enabled?: boolean; averageDaysPerWeek?: number; cycle?: "monthly" | "quarterly" | "semiannual" | "annual"; familyAllowances?: boolean; childHasRelevantIncome?: boolean; children?: Array<{ id: string; familyAllowances?: boolean; hasRelevantIncome?: boolean }> };
};

function toIncome(person: Article110VerifierPerson): FamilyIncome[] {
  const incomes: FamilyIncome[] = [];
  if (person.hasProfessionalIncome === true) incomes.push({
    kind: "professional", amount: person.professionalIncomeAmount, active: true,
    contract: person.professionalIncomeType === "independent" ? "independent" : person.professionalIncomeContract,
    variable: person.professionalIncomeVariable, firstProfessionalIncome: person.firstProfessionalIncome,
    neutralisationRequested: person.neutralisationRequested, startedAt: person.firstProfessionalIncomeStartedAt,
    studiesEndedAt: person.studiesEndedAt,
    c110aReceived: person.c110aReceived,
    monthlyAmount: person.c110aMonthlyDeclaredIncome,
  });
  if (person.hasReplacementIncome === true) incomes.push({
    kind: person.replacementIncomeType === "pension" ? "pension" : person.replacementIncomeType === "disability_allowance" ? "spf_disability" : "replacement",
    amount: person.replacementIncomeAmount, amountKind: person.replacementIncomeType === "pension" ? "gross" : undefined, active: true,
  });
  return incomes;
}

export function article110VerifierFacts(input: Article110VerifierInput): FamilyFacts {
  return {
    asOf: input.asOf ?? new Date().toISOString().slice(0, 10),
    people: input.isAloneExplicit ? [] : input.people.map((person): FamilyPerson => ({
      id: person.id, relation: person.relation, partnerEstablished: person.partnerEstablished,
      isAscendant: person.isAscendant, receivesFamilyAllowances: person.receivesFamilyAllowances,
      incomes: toIncome(person),
    })),
    cohousing: input.cohousing === undefined ? undefined : { declared: input.cohousing },
    isolated: {
      alimony: input.alimony?.enabled === undefined ? undefined : {
        paid: input.alimony.enabled, admissibleBasis: input.alimony.legalConditionEstablished,
        beneficiary: input.alimony.beneficiary, adultChildInNeed: input.alimony.adultChildInNeed,
      },
      alternatingCare: input.alternatingCare?.enabled === undefined ? undefined : {
        averageDaysPerWeek: input.alternatingCare.enabled ? input.alternatingCare.averageDaysPerWeek : undefined,
        cycle: input.alternatingCare.cycle,
        familyAllowances: input.alternatingCare.familyAllowances,
        childHasRelevantIncome: input.alternatingCare.childHasRelevantIncome,
        children: input.alternatingCare.children,
      },
    },
  };
}

function labelForFact(factKey: string) {
  if (factKey === "isolated.alternatingCare.averageDaysPerWeek") return "Indiquez le nombre moyen de jours calendrier par semaine où l’enfant réside chez vous.";
  if (factKey === "isolated.alternatingCare.cycle") return "Indiquez le cycle retenu pour calculer cette moyenne.";
  if (factKey === "isolated.alternatingCare.familyAllowances") return "Précisez si vous pouvez prétendre aux allocations familiales pour l’enfant.";
  if (factKey === "isolated.alternatingCare.childHasRelevantIncome") return "Précisez si l’enfant dispose de revenus professionnels ou de remplacement pertinents.";
  if (factKey === "isolated.alimony") return "Les conditions de la pension alimentaire doivent être précisées.";
  if (factKey === "cohousing.declared") return "Indiquez si vous vivez en co-housing plutôt qu’en cohabitation ordinaire.";
  return "Des informations sur la composition ou les revenus du ménage doivent être précisées.";
}

/** Thin adapter: all conclusions are produced by evaluateFamilySituation. */
export function evaluateArticle110Verifier(input: Article110VerifierInput) {
  const facts = article110VerifierFacts(input);
  const assessment = evaluateFamilySituation({
    facts,
    activeChildIncomeNeutralisation: activeFirstProfessionalIncomePersonIds(facts.people, facts.asOf).length > 0,
    neutralisedChildIds: activeFirstProfessionalIncomePersonIds(facts.people, facts.asOf),
    spouseProfessionalMonthlyThreshold: input.thresholds.spouseProfessionalMonthly,
    ascendantPensionWithChildMonthlyThreshold: input.thresholds.ascendantPensionWithChildMonthly,
    ascendantPensionMonthlyThreshold: input.thresholds.ascendantPensionMonthly,
    ascendantDisabledPensionMonthlyThreshold: input.thresholds.ascendantDisabledPensionMonthly,
    baremeSource: input.thresholds.source,
  });
  const missingFacts = (assessment.missingFacts ?? []).map((factKey) => ({ factKey, label: labelForFact(factKey) }));
  const needsInformation = assessment.status === "needs_information";
  return {
    category: assessment.expectedCategory,
    householdAssessment: assessment,
    reason: assessment.explanation ?? "Une évaluation théorique est en cours.",
    missingFacts,
    nextActions: needsInformation ? ["Compléter les faits manquants pour poursuivre l’évaluation théorique."] : assessment.status === "needs_review" ? ["Faire examiner la situation par l’ONEM avant toute décision."] : [],
    onemDecisionStatus: assessment.status === "needs_review" ? "required" as const : "not_required" as const,
    legalWarning: "Résultat théorique : seule l’ONEM détermine la catégorie officielle.",
  };
}

export type Article110VerifierFormSection = "partner" | "children" | "relatives" | "third_parties" | "isolated";

/** The UI layout follows the composition determined by the shared evaluator. */
export function getArticle110VerifierFormSections(input: Article110VerifierInput): Article110VerifierFormSection[] {
  const kind = householdCompositionFromFamilyFacts(article110VerifierFacts(input)).kind;
  if (kind === "alone") return ["isolated"];
  const sections: Article110VerifierFormSection[] = [];
  if (input.people.some((person) => person.relation === "spouse" || person.relation === "partner")) sections.push("partner");
  if (input.people.some((person) => person.relation === "child")) sections.push("children");
  if (input.people.some((person) => person.relation === "relative")) sections.push("relatives");
  if (input.people.some((person) => person.relation === "third_party" || person.relation === "unknown")) sections.push("third_parties");
  return sections;
}
