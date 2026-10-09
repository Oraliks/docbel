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
  isAloneExplicit?: boolean;
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
 * Stable, user-facing outcome families for the verifier. They describe the
 * next step without turning the indicative assessment into an ONEM decision.
 */
export type Article110ResultType =
  | "decision_determined"
  | "information_missing"
  | "document_required"
  | "onem_decision_required"
  | "not_automated";

export type Article110Category = "A" | "B" | "N";
export type Article110InformationStatus = "complete" | "incomplete";
export type Article110DocumentStatus = "complete" | "required";
export type Article110OnemDecisionStatus = "not_required" | "required";
export type Article110AutomationStatus = "automated" | "partial" | "not_automated";

export type Article110MissingFact = {
  factKey: string;
  personId?: string;
  label: string;
  step: 1 | 2;
};

/**
 * UI-only projection of the composition already established by the engine.
 * It deliberately contains no category or income rule: the client uses it
 * only to avoid asking questions that cannot affect the active branch.
 */
export type Article110VerifierFormSection = "partner" | "children" | "relatives" | "third_parties" | "isolated";

export function getArticle110VerifierFormSections(input: Pick<Article110VerifierInput, "people" | "isAloneExplicit">): Article110VerifierFormSection[] {
  if (input.people.length === 0) return input.isAloneExplicit ? ["isolated"] : [];
  const composition = classifyHouseholdComposition(input.people.map((person) => ({ ...person, factKey: `verifier.${person.id}` })));
  switch (composition.kind) {
    case "alone": return ["isolated"];
    case "spouse_or_partner": return ["partner"];
    case "children_only": return ["children"];
    case "children_and_relatives": return ["children", "relatives"];
    case "relatives_only": return ["relatives"];
    case "third_parties_only": return ["third_parties"];
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

function categoryLabel(category: Article110Category) {
  return category === "A" ? "Travailleur ayant charge de famille" : category === "B" ? "Cohabitant" : category === "N" ? "Isolé" : "À vérifier";
}

function officialCategoryFromCode(code?: string): Article110Category | undefined {
  if (!code) return undefined;
  if (/^110&1/.test(code)) return "A";
  if (/^110&2/.test(code)) return "N";
  if (/^110&3/.test(code)) return "B";
  return undefined;
}

function resultReason(input: Article110VerifierInput, compositionKnown: boolean, missingFacts: Article110MissingFact[], householdStatus: string, cohousing: boolean) {
  if (!compositionKnown) return "La composition réelle du ménage n'est pas encore renseignée.";
  if (missingFacts.length > 0) return "Des informations sont nécessaires pour évaluer la situation familiale.";
  if (cohousing) return "La situation de co-housing est appréciée par l’ONEM sur la situation réelle.\n\nLe Bureau du chômage peut effectuer une enquête avant de décider si le chômeur peut être considéré comme isolé.";
  if (input.isAloneExplicit && input.people.length === 0 && input.alimony?.enabled !== true && input.alternatingCare?.enabled !== true) return "Le chômeur a déclaré vivre seul, sans autre situation particulière établie.";
  if (householdStatus === "needs_review") return "Les éléments déclarés nécessitent une vérification avant de déterminer la catégorie.";
  if (input.people.some((person) => person.relation === "spouse" || person.relation === "partner")) return "Le conjoint ou partenaire est prioritaire pour l'évaluation de la situation familiale.";
  if (input.isAloneExplicit) return "Le chômeur a déclaré vivre seul et aucune autre situation particulière n'est établie.";
  return "La catégorie résulte de la composition du ménage et des revenus déclarés.";
}

function resultTypeFor(input: {
  composition: ReturnType<typeof classifyHouseholdComposition>;
  compositionKnown: boolean;
  missingFacts: Article110MissingFact[];
  missingDocuments: string[];
  cohousing: boolean;
  explicitMinimalAlone: boolean;
  householdStatus: string;
  isolatedStatus?: string;
  expectedCategory: "A" | "B" | "N" | null;
}): Article110ResultType {
  if (input.composition.kind === "mixed_or_unsupported") return "not_automated";
  if (!input.compositionKnown || input.missingFacts.length > 0) return "information_missing";
  if (input.cohousing) return "onem_decision_required";
  if (input.missingDocuments.length > 0) return "document_required";
  if (input.explicitMinimalAlone) return "decision_determined";
  return input.expectedCategory ? "decision_determined" : "not_automated";
}

function getMissingFacts(input: Article110VerifierInput, sections: Article110VerifierFormSection[]): Article110MissingFact[] {
  const missing: Article110MissingFact[] = [];
  const add = (person: Article110VerifierPerson, key: string, label: string, value: unknown) => {
    if (value === undefined) missing.push({ factKey: `${person.id}.${key}`, personId: person.id, label, step: 2 });
  };
  for (const person of input.people) {
    const inSection = (person.relation === "spouse" || person.relation === "partner") ? sections.includes("partner")
      : person.relation === "child" ? sections.includes("children")
      : person.relation === "relative" ? sections.includes("relatives") : sections.includes("third_parties");
    if (!inSection) continue;
    const label = ({ partner: "partenaire", conjoint: "conjoint", mother: "mère", father: "père", child: "enfant", sibling: "frère ou sœur", grandparent: "grand-parent", uncle_aunt: "oncle ou tante", nephew_niece: "neveu ou nièce", cousin: "cousin ou cousine", friend: "ami ou tiers", other: "autre personne" } as Record<string, string>)[person.label.toLowerCase()] ?? "cette personne";
    add(person, "hasProfessionalIncome", `Indiquer si ${label} dispose d'un revenu professionnel.`, person.hasProfessionalIncome);
    add(person, "hasReplacementIncome", `Indiquer si ${label} perçoit un revenu de remplacement.`, person.hasReplacementIncome);
    if (person.relation === "child") add(person, "receivesFamilyAllowances", `Indiquer si ${label} perçoit des allocations familiales.`, person.receivesFamilyAllowances);
    if (person.hasProfessionalIncome === true) add(person, "professionalIncomeAmount", `Indiquer le montant brut mensuel du revenu professionnel de ${label}.`, person.professionalIncomeAmount);
    if (person.hasReplacementIncome === true) add(person, "replacementIncomeAmount", `Indiquer le montant brut mensuel du revenu de remplacement de ${label}.`, person.replacementIncomeAmount);
  }
  return missing;
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
  const missingFacts = getMissingFacts(input, getArticle110VerifierFormSections(input));
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
  const isolatedSituationProvided = input.isAloneExplicit || input.cohousingClaim === true || input.alimony?.enabled === true || input.alternatingCare?.enabled === true;
  const isolatedAssessment = isolatedSituationProvided ? assessIsolatedHouseholdClaim(isolatedPayload, composition, input.officialOnemCode, { regisCompleted: input.cohousingDocuments?.regis }) : undefined;
  // Co-housing remains a factual ONEM assessment even when another established
  // situation could be more favourable. Assess it separately so it cannot be
  // silently replaced by that potential outcome.
  const cohousingPayload: FormPayload | undefined = input.cohousingClaim ? {
    statutFamilial: "isole",
    cohousingVieAutonomeRevendiquee: "oui",
    cohousingBailDisponible: input.cohousingDocuments?.lease ? "oui" : "non",
    cohousingAttestationHonneur: input.cohousingDocuments?.swornStatement ? "oui" : "non",
  } : undefined;
  const cohousingAssessment = cohousingPayload ? assessIsolatedHouseholdClaim(cohousingPayload, composition, input.officialOnemCode, { regisCompleted: input.cohousingDocuments?.regis }) : undefined;
  const compositionKnown = isolatedSituationProvided || input.people.length > 0;
  const explicitMinimalAlone = input.isAloneExplicit === true && input.people.length === 0 && !isolatedAssessment;
  const effectiveMissingFacts = compositionKnown ? missingFacts : [{ factKey: "composition", label: "Indiquer si le chômeur vit seul ou ajouter une personne au ménage.", step: 1 as const }];
  const supportedCategory = compositionKnown ? (isolatedAssessment ? isolatedAssessment.expectedCategory : explicitMinimalAlone ? "N" : householdAssessment.expectedCategory) : null;
  const isCohousing = cohousingAssessment?.branch === "cohousing";
  const officialCategory = officialCategoryFromCode(input.officialOnemCode);
  // B is the residual operational category. Missing facts and documents remain
  // independent statuses instead of becoming a pseudo-category.
  const category: Article110Category = isCohousing
    ? (officialCategory ? (supportedCategory === "A" ? "A" : officialCategory) : "B")
    : supportedCategory ?? officialCategory ?? "B";
  const cohousingEvidenceComplete = input.cohousingDocuments?.lease === true
    && input.cohousingDocuments?.regis === true
    && input.cohousingDocuments?.swornStatement === true;
  const potentialCategory: Article110Category | undefined = isCohousing && category === "B" && cohousingEvidenceComplete
    ? (supportedCategory === "A" ? "A" : "N")
    : isCohousing && category === "N" && supportedCategory === "A" ? "A" : undefined;
  const expectedCategory = supportedCategory;
  const missingDocuments = [
    ...(householdAssessment.requiredExternalDocument?.status === "required" ? ["C110A du mois concerné"] : []),
    ...(householdAssessment.pensionAssessment?.status === "NEEDS_DOCUMENT" ? ["Preuve SPF Pensions du mois concerné"] : []),
    ...[isolatedAssessment, cohousingAssessment].flatMap((assessment) => assessment?.documents.filter((document) => document.status === "required" || document.status === "pending").map((document) => documentLabel(document.document)) ?? []),
  ];
  const uniqueMissingDocuments = [...new Set(missingDocuments)];
  const reason = resultReason(input, compositionKnown, effectiveMissingFacts, householdAssessment.status, isCohousing);
  const status = !compositionKnown || effectiveMissingFacts.length > 0 ? "incomplete" as const
    : explicitMinimalAlone ? "complete" as const
    : isCohousing || householdAssessment.status === "needs_review" || isolatedAssessment?.status === "needs_review" || isolatedAssessment?.status === "pending_judgment" ? "review" as const
    : uniqueMissingDocuments.length > 0 ? "document" as const : "complete" as const;
  const resultType = resultTypeFor({
    composition,
    compositionKnown,
    missingFacts: effectiveMissingFacts,
    missingDocuments: uniqueMissingDocuments,
    cohousing: isCohousing,
    explicitMinimalAlone,
    householdStatus: householdAssessment.status,
    isolatedStatus: isolatedAssessment?.status,
    expectedCategory,
  });
  const informationStatus: Article110InformationStatus = effectiveMissingFacts.length > 0 ? "incomplete" : "complete";
  const documentStatus: Article110DocumentStatus = uniqueMissingDocuments.length > 0 ? "required" : "complete";
  // A missing fact, a missing document, or an incomplete automation branch is
  // not an ONEM decision by itself. Co-housing is the factual assessment that
  // remains reserved to the ONEM in this verifier.
  const onemDecisionRequired = isCohousing && officialCategory === undefined;
  const onemDecisionStatus: Article110OnemDecisionStatus = onemDecisionRequired ? "required" : "not_required";
  const automationStatus: Article110AutomationStatus = composition.kind === "mixed_or_unsupported" ? "not_automated"
    : informationStatus === "incomplete" || documentStatus === "required" || onemDecisionStatus === "required" ? "partial" : "automated";
  const nextActions = [
    ...(effectiveMissingFacts.length > 0 ? ["Compléter les informations"] : []),
    ...uniqueMissingDocuments.map((document) => `Obtenir : ${document}`),
    ...(onemDecisionRequired ? ["Transmettre pour vérification au Bureau du chômage"] : []),
  ];
  return {
    composition,
    householdAssessment,
    article110Decision,
    cohousing: cohousingAssessment,
    category,
    expectedCategory,
    potentialCategory,
    potentialReason: potentialCategory === "A"
      ? "Une catégorie A pourrait être examinée au vu des faits déjà établis, sans remplacer la décision ONEM sur le co-housing."
      : potentialCategory === "N"
        ? "Une catégorie N pourrait être examinée si l’ONEM reconnaît le statut d’isolé au vu de la situation réelle."
        : undefined,
    informationStatus,
    documentStatus,
    onemDecisionStatus,
    onemDecisionRequired,
    automationStatus,
    status,
    resultType,
    categoryLabel: categoryLabel(category),
    reason,
    decisiveFacts: [
      input.isAloneExplicit ? "Le chômeur a déclaré vivre seul" : undefined,
      input.people.length > 0 ? `${input.people.length} personne(s) dans le ménage` : undefined,
      input.officialOnemCode ? `Situation ONEM actuelle : ${input.officialOnemCode}` : undefined,
    ].filter((fact): fact is string => Boolean(fact)),
    missingDocuments: uniqueMissingDocuments,
    nextActions,
    potentialOutcome: potentialCategory ? categoryLabel(potentialCategory) : undefined,
    reviewReason: status === "review" ? reason : undefined,
    officialOnemState: input.officialOnemCode,
    expectedOnemState: category,
    level: !compositionKnown ? "information" as const : explicitMinimalAlone ? "confirmed" as const : isolatedAssessment?.status === "needs_review" || isolatedAssessment?.status === "pending_judgment" || householdAssessment.status === "needs_review" ? "review" as const
      : isolatedAssessment?.status === "needs_information" || householdAssessment.status === "needs_information" ? "information" as const : "confirmed" as const,
    declarationRequired: input.people.length > 0,
    sourceRuleIds: [...new Set([
      ...householdAssessment.sourceRuleIds,
      ...(article110Decision?.sourceRuleIds ?? []),
      ...(isolatedAssessment?.sourceRuleIds ?? []),
      ...(cohousingAssessment?.sourceRuleIds ?? []),
    ])],
    actions: [
      ...uniqueMissingDocuments,
      ...(householdAssessment.requiredExternalDocument?.status === "required" ? ["Fournir le C110A officiel"] : []),
      ...(householdAssessment.recommendedAction === "declaration_required" ? ["Introduire ou mettre à jour le C1"] : []),
      ...(onemDecisionRequired || householdAssessment.recommendedAction === "review_required" || isolatedAssessment?.recommendedAction === "onem_review" ? ["Revue ONEM / organisme de paiement nécessaire"] : []),
    ],
    missingFacts: effectiveMissingFacts,
    isolatedAssessment,
    cohousingAssessment,
  };
}

export function compareArticle110Verifier(before: Article110VerifierInput, after: Article110VerifierInput) {
  const beforeResult = evaluateArticle110Verifier(before);
  const afterResult = evaluateArticle110Verifier(after);
  const inputsChanged = JSON.stringify({ ...before, thresholds: undefined }) !== JSON.stringify({ ...after, thresholds: undefined });
  return {
    before: beforeResult,
    after: afterResult,
    categoryChanged: beforeResult.category !== afterResult.category,
    declarationRequired: inputsChanged,
    declarationReason: inputsChanged ? "La composition, un revenu ou une situation déclarée a changé." : undefined,
    officialOnemCode: before.officialOnemCode ?? after.officialOnemCode,
  };
}
