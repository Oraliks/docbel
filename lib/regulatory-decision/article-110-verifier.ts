import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";
import type { FormPayload } from "@/lib/pdf-forms/types";

import { decideArticle110ChildFirstProfessionalIncome } from "./article-110-child-income";
import {
  assessHouseholdBranch,
  classifyHouseholdComposition,
  type HouseholdMemberFact,
  type HouseholdRelation,
} from "./household-composition";
import type { RegulatoryFacts } from "./types";
import { assessIsolatedHouseholdClaim } from "./personal-situation-change";

type AlimonyFacts = {
  enabled?: boolean;
  beneficiary?: "conjoint" | "enfant-mineur" | "enfant-majeur" | "autre";
  paymentEffective?: boolean;
  legalBasis?: "decision-judiciaire" | "acte-notarie-divorce" | "acte-notarie-enfant" | "autre";
  documentStatus?: "en-main" | "deja-introduit" | "en-cours";
  decisionDate?: string;
  effectiveDate?: string;
  requestDate?: string;
};

type AlternatingCareFacts = {
  enabled?: boolean;
  regular?: boolean;
  familyAllowances?: boolean;
  childRelevantIncome?: boolean;
  documentStatus?: "jugement" | "acte-notarie" | "en-cours";
  decisionDate?: string;
  effectiveDate?: string;
  requestDate?: string;
};

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
  alimony?: AlimonyFacts;
  alternatingCare?: AlternatingCareFacts;
};

export type Article110VerifierResult = ReturnType<typeof evaluateArticle110Verifier>;

/**
 * UI-only projection of the composition already established by the engine.
 * It deliberately contains no category or income rule: the client uses it
 * only to avoid asking questions that cannot affect the active branch.
 */
export type Article110VerifierFormSection = "partner" | "children" | "relatives" | "third_parties" | "isolated";

export function getArticle110VerifierFormSections(input: Pick<Article110VerifierInput, "people">): Article110VerifierFormSection[] {
  const composition = classifyHouseholdComposition(input.people.map((person) => ({ ...person, factKey: `verifier.${person.id}` })));
  switch (composition.kind) {
    case "alone": return ["isolated"];
    case "spouse_or_partner": return ["partner"];
    case "children_only": return ["children"];
    case "children_and_relatives": return ["children", "relatives"];
    case "relatives_only": return ["relatives"];
    case "children_and_third_parties": return ["children", "third_parties"];
    case "relatives_and_third_parties": return ["relatives", "third_parties"];
    case "children_relatives_and_third_parties": return ["children", "relatives", "third_parties"];
    case "mixed_or_unsupported": return ["partner", "children", "relatives", "third_parties"];
  }
}

function documentLabel(document: string) {
  return ({
    judgment_or_admissible_act: "Jugement ou acte notarié",
    payment_proof: "Preuve de paiement",
    lease: "Bail",
    sworn_statement: "Attestation sur l'honneur",
    "c1-regis": "Annexe REGIS",
  } as Record<string, string>)[document] ?? document;
}

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
  const isolatedPayload: FormPayload = {
    statutFamilial: "isole",
    ...(input.alimony?.enabled ? {
      pensionAlimentaire: "oui", pensionAlimentaireBeneficiaire: input.alimony.beneficiary,
      pensionAlimentairePaiementEffectif: input.alimony.paymentEffective === undefined ? undefined : input.alimony.paymentEffective ? "oui" : "non",
      pensionAlimentaireBaseJuridique: input.alimony.legalBasis, statutJugementPensionAlimentaire: input.alimony.documentStatus,
      dateActePensionAlimentaire: input.alimony.decisionDate, dateEffetRevendiquePensionAlimentaire: input.alimony.effectiveDate, dateDemandePensionAlimentaire: input.alimony.requestDate,
    } : {}),
    ...(input.alternatingCare?.enabled ? {
      hebergementAlterneEnfant: "oui", hebergementAlterneRegulier: input.alternatingCare.regular === undefined ? undefined : input.alternatingCare.regular ? "oui" : "non",
      hebergementAlterneAllocationsFamiliales: input.alternatingCare.familyAllowances === undefined ? undefined : input.alternatingCare.familyAllowances ? "oui" : "non",
      hebergementAlterneEnfantRevenuPertinent: input.alternatingCare.childRelevantIncome === undefined ? undefined : input.alternatingCare.childRelevantIncome ? "oui" : "non",
      hebergementAlternePieceStatut: input.alternatingCare.documentStatus, datePieceHebergementAlterne: input.alternatingCare.decisionDate,
      dateEffetRevendiqueHebergementAlterne: input.alternatingCare.effectiveDate, dateDemandeHebergementAlterne: input.alternatingCare.requestDate,
    } : {}),
    ...(input.cohousingClaim ? {
      cohousingVieAutonomeRevendiquee: "oui", cohousingBailDisponible: input.cohousingDocuments?.lease ? "oui" : "non",
      cohousingAttestationHonneur: input.cohousingDocuments?.swornStatement ? "oui" : "non",
    } : {}),
  };
  const isolatedAssessment = assessIsolatedHouseholdClaim(isolatedPayload, composition, input.officialOnemCode, { regisCompleted: input.cohousingDocuments?.regis });
  const expectedCategory = isolatedAssessment ? isolatedAssessment.expectedCategory : householdAssessment.expectedCategory;
  return {
    composition,
    householdAssessment,
    article110Decision,
    cohousing: isolatedAssessment?.branch === "cohousing" ? isolatedAssessment : undefined,
    expectedCategory,
    expectedLabel: expectedCategory === "A" ? "Charge de famille" : expectedCategory === "B" ? "Cohabitant" : "À confirmer",
    level: isolatedAssessment?.status === "needs_review" || isolatedAssessment?.status === "pending_judgment" || householdAssessment.status === "needs_review" ? "review" as const
      : isolatedAssessment?.status === "needs_information" || householdAssessment.status === "needs_information" ? "information" as const : "confirmed" as const,
    declarationRequired: input.people.length > 0,
    sourceRuleIds: [...new Set([
      ...householdAssessment.sourceRuleIds,
      ...(article110Decision?.sourceRuleIds ?? []),
      ...(isolatedAssessment?.sourceRuleIds ?? []),
    ])],
    actions: [
      ...(householdAssessment.requiredExternalDocument?.status === "required" ? ["Fournir le C110A officiel"] : []),
      ...(householdAssessment.pensionAssessment?.status === "NEEDS_DOCUMENT" ? ["Fournir la preuve SPF Pensions"] : []),
      ...(isolatedAssessment?.documents.filter((document) => document.status === "required" || document.status === "pending").map((document) => documentLabel(document.document)) ?? []),
      ...(householdAssessment.recommendedAction === "declaration_required" ? ["Introduire ou mettre à jour le C1"] : []),
      ...(householdAssessment.recommendedAction === "review_required" || isolatedAssessment?.recommendedAction === "onem_review" ? ["Revue ONEM / organisme de paiement nécessaire"] : []),
    ],
    isolatedAssessment,
  };
}

export function compareArticle110Verifier(before: Article110VerifierInput, after: Article110VerifierInput) {
  const beforeResult = evaluateArticle110Verifier(before);
  const afterResult = evaluateArticle110Verifier(after);
  const inputsChanged = JSON.stringify({ ...before, thresholds: undefined }) !== JSON.stringify({ ...after, thresholds: undefined });
  return {
    before: beforeResult,
    after: afterResult,
    categoryChanged: beforeResult.expectedCategory !== afterResult.expectedCategory,
    declarationRequired: inputsChanged,
    declarationReason: inputsChanged ? "La composition, un revenu ou une situation déclarée a changé." : undefined,
    officialOnemCode: before.officialOnemCode ?? after.officialOnemCode,
  };
}
