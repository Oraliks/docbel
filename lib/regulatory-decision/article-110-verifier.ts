import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";

import { decideArticle110ChildFirstProfessionalIncome } from "./article-110-child-income";
import {
  assessHouseholdBranch,
  classifyHouseholdComposition,
  type HouseholdMemberFact,
  type HouseholdRelation,
} from "./household-composition";
import type { RegulatoryFacts } from "./types";

export type Article110VerifierPerson = Omit<HouseholdMemberFact, "factKey" | "relation"> & {
  id: string;
  relation: HouseholdRelation;
  label: string;
  firstProfessionalIncomeStartedAt?: string;
  neutralisationRequested?: boolean;
};

export type Article110VerifierInput = {
  people: Article110VerifierPerson[];
  officialOnemCode?: string;
  assessedAt?: Date;
  thresholds: C1BaremeThresholds;
  cohousingClaim?: boolean;
  cohousingDocuments?: { lease?: boolean; swornStatement?: boolean; regis?: boolean };
};

export type Article110VerifierResult = ReturnType<typeof evaluateArticle110Verifier>;

/**
 * Thin UI adapter: it only turns professional facts into the contracts already
 * evaluated by the Article 110 engine. It never decides a family category.
 */
export function evaluateArticle110Verifier(input: Article110VerifierInput) {
  const people: HouseholdMemberFact[] = input.people.map((person) => ({
    ...person,
    factKey: `verifier.${person.id}`,
  }));
  const composition = classifyHouseholdComposition(people);
  const temporalCandidate = input.people.filter((person) => person.relation === "child" && person.firstProfessionalIncome === true);
  const child = temporalCandidate.length === 1 ? temporalCandidate[0] : undefined;
  const childFacts: RegulatoryFacts | null = child ? {
    "family.child.firstProfessionalIncome": { value: true, origin: "user" },
    "family.child.neutralisationRequested": { value: child.neutralisationRequested === true, origin: "user" },
    ...(child.firstProfessionalIncomeStartedAt ? { "family.child.firstProfessionalIncomeStartedAt": { value: { kind: "date", value: child.firstProfessionalIncomeStartedAt }, origin: "user" } } : {}),
    ...(child.studiesEndedAt ? { "family.child.studiesEndedAt": { value: { kind: "date", value: child.studiesEndedAt }, origin: "user" } } : {}),
  } : null;
  const article110Decision = childFacts
    ? decideArticle110ChildFirstProfessionalIncome(childFacts, input.assessedAt ?? new Date())
    : undefined;
  const neutralisedChildFactKeys = article110Decision?.temporalEffect?.onemCode === "110&1M"
    ? people.filter((person) => person.relation === "child" && person.firstProfessionalIncome).map((person) => person.factKey)
    : [];
  const householdAssessment = assessHouseholdBranch({
    composition,
    activeChildIncomeNeutralisation: article110Decision?.temporalEffect?.onemCode === "110&1M",
    neutralisedChildFactKeys,
    officialOnemCode: input.officialOnemCode,
    spouseProfessionalMonthlyThreshold: input.thresholds.spouseProfessionalMonthly,
    ascendantPensionWithChildMonthlyThreshold: input.thresholds.ascendantPensionWithChildMonthly,
    ascendantPensionMonthlyThreshold: input.thresholds.ascendantPensionMonthly,
    ascendantDisabledPensionMonthlyThreshold: input.thresholds.ascendantDisabledPensionMonthly,
    baremeSource: input.thresholds.source,
  });
  const cohousing = input.cohousingClaim ? {
    status: "needs_review" as const,
    reason: "La demande de co-housing doit être examinée : elle ne découle pas de la seule adresse.",
    documents: [
      !input.cohousingDocuments?.lease && "Bail",
      !input.cohousingDocuments?.swornStatement && "Attestation sur l'honneur",
      !input.cohousingDocuments?.regis && "Annexe REGIS",
    ].filter(Boolean) as string[],
    sourceRuleIds: ["situation_familiale_cohousing_a_verifier", "c1_annexe_regis_difference"],
  } : undefined;
  const expectedCategory = cohousing ? null : householdAssessment.expectedCategory;
  return {
    composition,
    householdAssessment,
    article110Decision,
    cohousing,
    expectedCategory,
    expectedLabel: expectedCategory === "A" ? "Charge de famille" : expectedCategory === "B" ? "Cohabitant" : "À confirmer",
    level: cohousing || householdAssessment.status === "needs_review" ? "review" as const
      : householdAssessment.status === "needs_information" ? "information" as const : "confirmed" as const,
    declarationRequired: input.people.length > 0,
    sourceRuleIds: [...new Set([
      ...householdAssessment.sourceRuleIds,
      ...(article110Decision?.sourceRuleIds ?? []),
      ...(cohousing?.sourceRuleIds ?? []),
    ])],
    actions: [
      ...(householdAssessment.requiredExternalDocument?.status === "required" ? ["Fournir le C110A officiel"] : []),
      ...(householdAssessment.pensionAssessment?.status === "NEEDS_DOCUMENT" ? ["Fournir la preuve SPF Pensions"] : []),
      ...(cohousing?.documents ?? []),
      ...(householdAssessment.recommendedAction === "declaration_required" ? ["Introduire ou mettre à jour le C1"] : []),
      ...(householdAssessment.recommendedAction === "review_required" || cohousing ? ["Revue ONEM / organisme de paiement nécessaire"] : []),
    ],
  };
}
