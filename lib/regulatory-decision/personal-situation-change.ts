import type { FormPayload } from "@/lib/pdf-forms/types";
import {
  decideArticle110ChildFirstProfessionalIncome,
  preserveArticle110TemporalHistory,
} from "./article-110-child-income";
import {
  assessHouseholdBranch,
  classifyHouseholdComposition,
  type HouseholdMemberFact,
} from "./household-composition";
import type { RegulatoryDecision } from "./types";
import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";

/**
 * Minimal, purpose-built history for the C1 personal-situation workflow.
 * It deliberately records only the declared change and its effective date;
 * it is not a generic event store and it never copies household PII.
 */
export type PersonalSituationChange = {
  factKey: "adresse" | "famille.statut" | "paiement.compte" | "organisme.paiement";
  previousValue?: string;
  currentValue?: string;
  effectiveDate: string;
  source: "c1";
};

export type CompanionTrace = {
  formSlug: "c1-partenaire" | "c1-regis";
  status: "required" | "needs_review";
  reason: string;
  sourceRuleIds: string[];
  version: 1;
};

export type PersonalSituationTrace = {
  version: 1;
  changes: PersonalSituationChange[];
  factsUsed: string[];
  companions: CompanionTrace[];
};

function text(payload: FormPayload, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function checked(payload: FormPayload, key: string): boolean {
  return payload[key] === true;
}

function dateFor(payload: FormPayload, key: string): string | undefined {
  // `dateModificationEffective` is kept as a compatibility fallback for
  // already-saved runs while new forms store one date per declared change.
  return text(payload, key) ?? text(payload, "dateModificationEffective");
}

type IsolatedAssessment = NonNullable<RegulatoryDecision["isolatedHouseholdAssessment"]>;

function isolatedFactKeys(payload: FormPayload, keys: string[]) {
  return keys.filter((key) => payload[key] !== undefined);
}

function retroactivity(payload: FormPayload): IsolatedAssessment["retroactivity"] | undefined {
  const requestDate = text(payload, "dateDemandePensionAlimentaire");
  const legalDocumentDate = text(payload, "dateActePensionAlimentaire");
  const receivedDate = text(payload, "dateReceptionPensionAlimentaire");
  const claimedEffectiveDate = text(payload, "dateEffetRevendiquePensionAlimentaire");
  if (!requestDate && !legalDocumentDate && !receivedDate && !claimedEffectiveDate) return undefined;
  return { status: "RETROACTIVE_REVIEW_REQUIRED", requestDate, legalDocumentDate, receivedDate, claimedEffectiveDate };
}

/**
 * This covers only the declared isolated-household claims. It deliberately
 * produces an expected category, never an official ONEM state or code.
 */
export function assessIsolatedHouseholdClaim(payload: FormPayload, composition: ReturnType<typeof deriveHouseholdCompositionFromC1>, officialOnemCode?: string, options?: { regisCompleted?: boolean }): IsolatedAssessment | undefined {
  const officialAction = <T extends IsolatedAssessment["recommendedAction"]>(fallback: T) =>
    officialOnemCode ? "await_onem_decision" as const : fallback;

  if (text(payload, "pensionAlimentaire") === "oui" && text(payload, "statutFamilial") === "isole") {
    const judgment = text(payload, "statutJugementPensionAlimentaire");
    const payment = text(payload, "pensionAlimentairePaiementEffectif");
    const basis = text(payload, "pensionAlimentaireBaseJuridique");
    const beneficiary = text(payload, "pensionAlimentaireBeneficiaire");
    const adultChildRelevant = text(payload, "pensionAlimentaireEnfantMajeurBesoin");
    const factKeys = isolatedFactKeys(payload, ["statutFamilial", "pensionAlimentaire", "statutJugementPensionAlimentaire", "pensionAlimentairePaiementEffectif", "pensionAlimentaireBaseJuridique", "pensionAlimentaireBeneficiaire", "pensionAlimentaireEnfantMajeurBesoin", "dateArretPensionAlimentaire", "dateDemandePensionAlimentaire", "dateActePensionAlimentaire", "dateReceptionPensionAlimentaire", "dateEffetRevendiquePensionAlimentaire"]);
    const history = retroactivity(payload);
    const base = { branch: "alimony" as const, factKeys, sourceRuleIds: ["situation_familiale_isole_pension_alimentaire"] };
    if (judgment === "en-cours" || judgment === "pas-encore-recu") return {
      ...base, status: "pending_judgment", expectedCategory: null, claimState: "PENDING_JUDGMENT",
      documents: [{ document: "judgment_or_admissible_act", status: "pending" }, { document: "payment_proof", status: payment === "oui" ? "declared" : "required" }],
      recommendedAction: officialAction("provide_judgment"), ...(history ? { retroactivity: history } : {}),
    };
    if (payment === "non") return {
      ...base, status: "needs_review", expectedCategory: null,
      documents: [{ document: "judgment_or_admissible_act", status: judgment === "en-main" || judgment === "deja-introduit" ? "received" : "required" }],
      recommendedAction: officialAction("reassess_from_effective_date"),
      ...(text(payload, "dateArretPensionAlimentaire") ? { recalculationEffectiveAt: text(payload, "dateArretPensionAlimentaire") } : {}),
      ...(history ? { retroactivity: history } : {}),
    };
    const admissibleBasis = basis === "decision-judiciaire" || basis === "acte-notarie-divorce" || basis === "acte-notarie-enfant";
    const documentReceived = judgment === "en-main" || judgment === "deja-introduit";
    const adultChildUnclear = beneficiary === "enfant-majeur" && adultChildRelevant !== "oui";
    if (payment === "oui" && admissibleBasis && documentReceived && beneficiary && !adultChildUnclear) return {
      ...base, status: "probable", expectedCategory: "A",
      documents: [{ document: "judgment_or_admissible_act", status: "received" }, { document: "payment_proof", status: "declared" }],
      recommendedAction: officialAction("onem_review"), ...(history ? { retroactivity: history } : {}),
    };
    return {
      ...base, status: "needs_information", expectedCategory: null,
      documents: [{ document: "judgment_or_admissible_act", status: documentReceived ? "received" : "required" }, { document: "payment_proof", status: payment === "oui" ? "declared" : "required" }],
      recommendedAction: officialAction("provide_information"), ...(history ? { retroactivity: history } : {}),
    };
  }

  if (text(payload, "hebergementAlterneEnfant") === "oui" && text(payload, "statutFamilial") === "isole") {
    const regular = text(payload, "hebergementAlterneRegulier");
    const allowances = text(payload, "hebergementAlterneAllocationsFamiliales");
    const relevantIncome = text(payload, "hebergementAlterneEnfantRevenuPertinent");
    const documentStatus = text(payload, "hebergementAlternePieceStatut");
    const careHistory = (() => {
      const requestDate = text(payload, "dateDemandeHebergementAlterne");
      const legalDocumentDate = text(payload, "datePieceHebergementAlterne");
      const receivedDate = text(payload, "dateReceptionHebergementAlterne");
      const claimedEffectiveDate = text(payload, "dateEffetRevendiqueHebergementAlterne");
      return requestDate || legalDocumentDate || receivedDate || claimedEffectiveDate
        ? { status: "RETROACTIVE_REVIEW_REQUIRED" as const, requestDate, legalDocumentDate, receivedDate, claimedEffectiveDate }
        : undefined;
    })();
    const base = { branch: "alternating_care" as const, factKeys: isolatedFactKeys(payload, ["statutFamilial", "hebergementAlterneEnfant", "hebergementAlterneRegulier", "hebergementAlterneAllocationsFamiliales", "hebergementAlterneEnfantRevenuPertinent", "hebergementAlternePieceStatut", "dateDemandeHebergementAlterne", "datePieceHebergementAlterne", "dateReceptionHebergementAlterne", "dateEffetRevendiqueHebergementAlterne"]), sourceRuleIds: ["situation_familiale_isole_garde_alternee"] };
    if (documentStatus === "en-cours") return { ...base, status: "pending_judgment", expectedCategory: null, claimState: "PENDING_JUDGMENT", documents: [{ document: "judgment_or_admissible_act", status: "pending" }], recommendedAction: officialAction("provide_judgment"), ...(careHistory ? { retroactivity: careHistory } : {}) };
    const documentReceived = documentStatus === "jugement" || documentStatus === "acte-notarie";
    if (regular === "oui" && (allowances === "oui" || relevantIncome === "non") && documentReceived) return { ...base, status: "probable", expectedCategory: "A", documents: [{ document: "judgment_or_admissible_act", status: "received" }], recommendedAction: officialAction("onem_review"), ...(careHistory ? { retroactivity: careHistory } : {}) };
    return { ...base, status: regular === "non" ? "needs_review" : "needs_information", expectedCategory: null, documents: [{ document: "judgment_or_admissible_act", status: documentReceived ? "received" : "required" }], recommendedAction: officialAction(regular === "non" ? "onem_review" : "provide_information"), ...(careHistory ? { retroactivity: careHistory } : {}) };
  }

  if (text(payload, "cohousingVieAutonomeRevendiquee") === "oui") {
    const familyOrCouple = composition.members.some((member) => member.relation === "spouse" || member.relation === "partner" || member.relation === "child" || member.relation === "relative");
    if (familyOrCouple) return undefined;
    const document = (key: string, name: IsolatedAssessment["documents"][number]["document"]) => ({ document: name, status: text(payload, key) === "oui" ? "declared" as const : "required" as const });
    return {
      branch: "cohousing", status: "needs_review", expectedCategory: null, claimState: "ISOLATED_CLAIM",
      documents: [document("cohousingBailDisponible", "lease"), document("cohousingAttestationHonneur", "sworn_statement"), { document: "c1-regis", status: options?.regisCompleted ? "completed" : "required" }],
      recommendedAction: officialAction("onem_review"),
      factKeys: isolatedFactKeys(payload, ["cohousingVieAutonomeRevendiquee", "cohousingBailDisponible", "cohousingEspacePrivatif", "cohousingAttestationHonneur", "cohousingGestionMenageSeparee", "cohousingExplicationVieAutonome"]),
      sourceRuleIds: ["c1_annexe_regis_difference", "situation_familiale_cohousing_a_verifier"],
    };
  }
  return undefined;
}

function preserveIsolatedAssessmentHistory(previous: IsolatedAssessment | undefined, next: IsolatedAssessment | undefined): IsolatedAssessment[] | undefined {
  if (!previous) return undefined;
  if (!next) return [previous];
  const signature = (assessment: IsolatedAssessment) => JSON.stringify({ branch: assessment.branch, status: assessment.status, expectedCategory: assessment.expectedCategory, recalculationEffectiveAt: assessment.recalculationEffectiveAt, retroactivity: assessment.retroactivity });
  return signature(previous) === signature(next) ? undefined : [previous];
}

/**
 * C1 provides the temporal facts but cannot establish the remaining category-A
 * branch on its own. That fact is intentionally left absent here: a later
 * verified source may provide it, otherwise the regulatory decision safely
 * remains `needs_information`.
 */
export function deriveArticle110FactsFromC1(payload: FormPayload) {
  const cohabitants = Array.isArray(payload.cohabitants) ? payload.cohabitants : [];
  const candidates = cohabitants.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const person = entry as Record<string, unknown>;
    return person.lien === "enfant" && person.premierRevenuProfessionnel === "oui";
  }) as Array<Record<string, unknown>>;
  if (candidates.length !== 1) return null;

  const child = candidates[0];
  const date = (key: string) => {
    const value = child[key];
    return typeof value === "string" && value ? { kind: "date" as const, value } : undefined;
  };
  return {
    "family.child.firstProfessionalIncome": { value: true, origin: "user" as const },
    "family.child.neutralisationRequested": {
      value: child.demandeNeutralisationPremierRevenu === "oui",
      origin: "user" as const,
    },
    ...(date("dateDebutPremiereActivite")
      ? {
          "family.child.firstProfessionalIncomeStartedAt": {
            value: date("dateDebutPremiereActivite")!, origin: "user" as const,
          },
        }
      : {}),
    ...(date("dateFinEtudes")
      ? { "family.child.studiesEndedAt": { value: date("dateFinEtudes")!, origin: "user" as const } }
      : {}),
  };
}

const RELATION_BY_C1_VALUE: Record<string, HouseholdMemberFact["relation"]> = {
  epoux: "spouse",
  partenaire: "partner",
  enfant: "child",
  pere: "relative",
  mere: "relative",
  frere: "relative",
  soeur: "relative",
  neveu: "relative",
  niece: "relative",
  oncle: "relative",
  tante: "relative",
  cousin: "third_party",
  cousine: "third_party",
  "aucun-lien": "third_party",
  FAC: "unknown",
  NFAC: "unknown",
};

/** Converts the existing C1 cohabitants array into non-identifying household facts. */
export function deriveHouseholdCompositionFromC1(payload: FormPayload) {
  const cohabitants = Array.isArray(payload.cohabitants) ? payload.cohabitants : [];
  const members = cohabitants.flatMap((entry, index): HouseholdMemberFact[] => {
    if (!entry || typeof entry !== "object") return [{ relation: "unknown", factKey: `cohabitants[${index}]` }];
    const person = entry as Record<string, unknown>;
    const lien = typeof person.lien === "string" ? person.lien : "";
    const relation = RELATION_BY_C1_VALUE[lien] ?? "unknown";
    const professional = typeof person.typeRevenuPro === "string"
      ? person.typeRevenuPro !== "aucun"
      : undefined;
    const replacementType = typeof person.revenuRemplacement === "string" ? person.revenuRemplacement : undefined;
    const replacement = typeof replacementType === "string"
      ? replacementType !== "aucun"
      : undefined;
    return [{
      relation,
      ...(relation === "partner" && person.partenaireConditionsEtablies === "oui" ? { partnerEstablished: true } : {}),
      ...(professional !== undefined ? { hasProfessionalIncome: professional } : {}),
      ...(typeof person.montantRevenuPro === "number" ? { professionalIncomeAmount: person.montantRevenuPro } : {}),
      ...(person.typeContratRevenuPro === "cdi" || person.typeContratRevenuPro === "cdd" || person.typeContratRevenuPro === "other"
        ? { professionalIncomeContract: person.typeContratRevenuPro }
        : {}),
      ...(person.revenuProfessionnelVariable === "oui" ? { professionalIncomeVariable: true }
        : person.revenuProfessionnelVariable === "non" ? { professionalIncomeVariable: false }
        : {}),
      ...(person.c110aStatut === "recu" ? { c110aReceived: true }
        : person.c110aStatut === "non-recu" ? { c110aReceived: false }
        : {}),
      ...(typeof person.montantMensuelC110a === "number" ? { c110aMonthlyDeclaredIncome: person.montantMensuelC110a } : {}),
      ...(replacement !== undefined ? { hasReplacementIncome: replacement } : {}),
      ...(replacementType === "allocation-handicap" ? { replacementIncomeRelevantForFamilyStatus: false } : {}),
      ...(replacementType === "pension" ? { replacementIncomeType: "pension" as const } : replacementType === "allocation-handicap" ? { replacementIncomeType: "disability_allowance" as const } : replacement ? { replacementIncomeType: "other" as const } : {}),
      ...(typeof person.montantRevenuRemplacement === "number" ? { replacementIncomeAmount: person.montantRevenuRemplacement } : {}),
      ...(person.preuvePension === "recu" ? { pensionProofAvailable: true } : person.preuvePension === "manquante" ? { pensionProofAvailable: false } : {}),
      ...(person.montantPensionNature === "brut" ? { pensionGrossAmountConfirmed: true } : person.montantPensionNature === "net" ? { pensionGrossAmountConfirmed: false } : {}),
      ...(lien === "pere" || lien === "mere" ? { isAscendant: true } : {}),
      ...(person.handicapReconnu === "oui" ? { disabilityDeclared: true } : {}),
      ...(person.preuveHandicap === "oui" ? { disabilityProofAvailable: true } : {}),
      ...(person.allocationsFamiliales === "oui" ? { receivesFamilyAllowances: true } : {}),
      ...(person.premierRevenuProfessionnel === "oui" ? { firstProfessionalIncome: true } : {}),
      ...(typeof person.dateFinEtudes === "string" && person.dateFinEtudes ? { studiesEndedAt: person.dateFinEtudes } : {}),
      factKey: `cohabitants[${index}].${relation}`,
    }];
  });
  return classifyHouseholdComposition(members);
}

function deriveChildrenOnlyAssessment(
  previous: RegulatoryDecision["childrenOnlyAssessment"] | undefined,
  composition: ReturnType<typeof deriveHouseholdCompositionFromC1>,
  householdAssessment: ReturnType<typeof assessHouseholdBranch>,
  payload: FormPayload,
  neutralisedChildFactKeys: string[],
): RegulatoryDecision["childrenOnlyAssessment"] | undefined {
  if (composition.kind !== "children_only" || (householdAssessment.expectedCategory !== "A" && householdAssessment.expectedCategory !== "B")) return undefined;
  const facts = composition.members.map((member) => ({
    factKey: member.factKey,
    receivesFamilyAllowances: member.receivesFamilyAllowances,
    hasProfessionalIncome: member.hasProfessionalIncome,
    hasReplacementIncome: member.hasReplacementIncome,
    firstProfessionalIncome: member.firstProfessionalIncome,
    studiesEndedAt: member.studiesEndedAt,
    neutralisedBy110_1M: neutralisedChildFactKeys.includes(member.factKey) || undefined,
  }));
  const before = new Map((previous?.facts ?? []).map((fact) => [fact.factKey, fact]));
  const after = new Map(facts.map((fact) => [fact.factKey, fact]));
  const changes: NonNullable<RegulatoryDecision["childrenOnlyAssessment"]>["changes"] = [];
  const effectiveDate = text(payload, "dateModificationSituationFamilialeEffective") ?? text(payload, "dateModificationEffective");
  for (const [factKey, current] of after) {
    const prior = before.get(factKey);
    if (!prior) continue;
    if (prior.hasProfessionalIncome !== true && current.hasProfessionalIncome === true) changes.push({ reason: "CHILD_STARTED_WORK", factKey, previous: prior, current, effectiveDate });
    if (prior.hasProfessionalIncome === true && current.hasProfessionalIncome !== true) changes.push({ reason: "CHILD_STOPPED_WORK", factKey, previous: prior, current, effectiveDate });
    if (prior.receivesFamilyAllowances === true && current.receivesFamilyAllowances !== true) changes.push({ reason: "CHILD_LOST_FAMILY_ALLOWANCE", factKey, previous: prior, current, effectiveDate });
    if (prior.receivesFamilyAllowances !== true && current.receivesFamilyAllowances === true) changes.push({ reason: "CHILD_GAINED_FAMILY_ALLOWANCE", factKey, previous: prior, current, effectiveDate });
    if (prior.hasReplacementIncome !== current.hasReplacementIncome) changes.push({ reason: "INCOME_CHANGED", factKey, previous: prior, current, effectiveDate });
    if (prior.studiesEndedAt !== current.studiesEndedAt && current.studiesEndedAt) changes.push({ reason: "CHILD_STUDIES_ENDED", factKey, previous: prior, current, effectiveDate: current.studiesEndedAt });
    if (prior.firstProfessionalIncome === true && current.neutralisedBy110_1M !== true) changes.push({ reason: "CHILD_110_1M_ENDED", factKey, previous: prior, current, effectiveDate });
  }
  if (previous) {
    for (const [factKey, prior] of before) if (!after.has(factKey)) changes.push({ reason: "HOUSEHOLD_MEMBER_CHANGED", factKey, previous: prior, effectiveDate });
    for (const [factKey, current] of after) if (!before.has(factKey)) changes.push({ reason: "HOUSEHOLD_MEMBER_CHANGED", factKey, current, effectiveDate });
  }
  return {
    expectedCategory: householdAssessment.expectedCategory,
    categoryChanged: previous ? previous.expectedCategory !== householdAssessment.expectedCategory : false,
    declarationRequired: changes.length > 0,
    facts,
    changes,
    sourceRuleIds: ["situation_familiale_children_only"],
  };
}

function deriveRelativeHouseholdAssessment(
  previous: RegulatoryDecision["relativeHouseholdAssessment"] | undefined,
  composition: ReturnType<typeof deriveHouseholdCompositionFromC1>,
  householdAssessment: ReturnType<typeof assessHouseholdBranch>,
  payload: FormPayload,
): RegulatoryDecision["relativeHouseholdAssessment"] | undefined {
  if ((composition.kind !== "relatives_only" && composition.kind !== "children_and_relatives") || (householdAssessment.expectedCategory !== "A" && householdAssessment.expectedCategory !== "B")) return undefined;
  const facts = composition.members.filter((member) => member.relation === "relative").map((member) => ({
    factKey: member.factKey,
    professional: member.hasProfessionalIncome,
    replacementType: member.replacementIncomeType,
    pensionGrossAmount: member.replacementIncomeAmount,
    pensionProof: member.pensionProofAvailable,
    disabilityProof: member.disabilityProofAvailable,
  }));
  const before = new Map((previous?.facts ?? []).map((fact) => [fact.factKey, fact]));
  const changes: NonNullable<RegulatoryDecision["relativeHouseholdAssessment"]>["changes"] = [];
  const effectiveDate = text(payload, "dateModificationSituationFamilialeEffective") ?? text(payload, "dateModificationEffective");
  for (const current of facts) {
    const prior = before.get(current.factKey);
    if (!prior) continue;
    if (prior.replacementType !== "pension" && current.replacementType === "pension") changes.push({ reason: "PENSION_STARTED", factKey: current.factKey, previous: prior, current, effectiveDate });
    if (prior.replacementType === "pension" && current.replacementType !== "pension") changes.push({ reason: "PENSION_STOPPED", factKey: current.factKey, previous: prior, current, effectiveDate });
    if (prior.pensionGrossAmount !== current.pensionGrossAmount) changes.push({ reason: "PENSION_AMOUNT_CHANGED", factKey: current.factKey, previous: prior, current, effectiveDate });
    if (prior.replacementType !== current.replacementType || prior.professional !== current.professional) changes.push({ reason: "INCOME_CHANGED", factKey: current.factKey, previous: prior, current, effectiveDate });
    if (prior.disabilityProof !== current.disabilityProof) changes.push({ reason: "DISABILITY_PROOF_CHANGED", factKey: current.factKey, previous: prior, current, effectiveDate });
  }
  if (previous) {
    const afterKeys = new Set(facts.map((fact) => fact.factKey));
    for (const [factKey, prior] of before) if (!afterKeys.has(factKey)) changes.push({ reason: "HOUSEHOLD_MEMBER_CHANGED", factKey, previous: prior, effectiveDate });
    for (const current of facts) if (!before.has(current.factKey)) changes.push({ reason: "HOUSEHOLD_MEMBER_CHANGED", factKey: current.factKey, current, effectiveDate });
  }
  return { composition: composition.kind, expectedCategory: householdAssessment.expectedCategory, categoryChanged: previous ? previous.expectedCategory !== householdAssessment.expectedCategory : false, declarationRequired: changes.length > 0, facts, changes, sourceRuleIds: ["situation_familiale_ascendants_pensions"] };
}

function deriveThirdPartyHouseholdAssessment(
  previous: RegulatoryDecision["thirdPartyHouseholdAssessment"] | undefined,
  previousComposition: RegulatoryDecision["householdAssessment"] | undefined,
  composition: ReturnType<typeof deriveHouseholdCompositionFromC1>,
  householdAssessment: ReturnType<typeof assessHouseholdBranch>,
  payload: FormPayload,
): RegulatoryDecision["thirdPartyHouseholdAssessment"] | undefined {
  const supported = composition.kind === "children_and_third_parties" || composition.kind === "relatives_and_third_parties" || composition.kind === "children_relatives_and_third_parties";
  if (!supported && !previous) return undefined;
  const facts = composition.members.filter((member) => member.relation === "third_party").map((member) => ({ factKey: member.factKey, professional: member.hasProfessionalIncome, replacementType: member.replacementIncomeType, relevantReplacement: member.replacementIncomeRelevantForFamilyStatus !== false && member.hasReplacementIncome }));
  const effectiveDate = text(payload, "dateModificationSituationFamilialeEffective") ?? text(payload, "dateModificationEffective");
  const changes: NonNullable<RegulatoryDecision["thirdPartyHouseholdAssessment"]>["changes"] = [];
  if (!previous && supported && previousComposition && !previousComposition.composition.includes("third_parties")) changes.push({ reason: "THIRD_PARTY_ARRIVED", effectiveDate });
  if (previous && !supported) changes.push({ reason: "THIRD_PARTY_LEFT", effectiveDate });
  if (previous && supported) {
    const before = new Map(previous.facts.map((fact) => [fact.factKey, fact]));
    for (const fact of facts) {
      const prior = before.get(fact.factKey);
      if (!prior || prior.professional !== fact.professional || prior.replacementType !== fact.replacementType || prior.relevantReplacement !== fact.relevantReplacement) changes.push({ reason: prior ? "THIRD_PARTY_INCOME_CHANGED" : "THIRD_PARTY_ARRIVED", factKey: fact.factKey, effectiveDate });
    }
    for (const prior of previous.facts) if (!facts.some((fact) => fact.factKey === prior.factKey)) changes.push({ reason: "THIRD_PARTY_LEFT", factKey: prior.factKey, effectiveDate });
  }
  const thirdComposition: NonNullable<RegulatoryDecision["thirdPartyHouseholdAssessment"]>["composition"] = supported
    ? composition.kind as "children_and_third_parties" | "relatives_and_third_parties" | "children_relatives_and_third_parties"
    : "none";
  return {
    composition: thirdComposition,
    expectedCategory: supported ? householdAssessment.expectedCategory : null,
    categoryChanged: previous ? previous.expectedCategory !== (supported ? householdAssessment.expectedCategory : null) : false,
    declarationRequired: changes.length > 0,
    facts,
    changes,
    sourceRuleIds: ["situation_familiale_third_parties"],
  };
}

export function derivePersonalSituationTrace(payload: FormPayload): PersonalSituationTrace {
  const changes: PersonalSituationChange[] = [];
  const factsUsed: string[] = [];

  const add = (
    enabled: boolean,
    factKey: PersonalSituationChange["factKey"],
    effectiveDate: string | undefined,
    values: Pick<PersonalSituationChange, "previousValue" | "currentValue"> = {},
  ) => {
    if (!enabled || !effectiveDate) return;
    changes.push({
      factKey,
      effectiveDate,
      source: "c1",
      ...(values.previousValue ? { previousValue: values.previousValue } : {}),
      ...(values.currentValue ? { currentValue: values.currentValue } : {}),
    });
    factsUsed.push(factKey, `${factKey}.effectiveDate`);
  };

  add(checked(payload, "modificationAdresse"), "adresse", dateFor(payload, "dateModificationAdresseEffective"));
  add(
    checked(payload, "modificationSituationFamiliale"),
    "famille.statut",
    dateFor(payload, "dateModificationSituationFamilialeEffective"),
    { previousValue: text(payload, "previousStatutFamilial"), currentValue: text(payload, "statutFamilial") },
  );
  add(checked(payload, "modificationCompte"), "paiement.compte", dateFor(payload, "dateModificationCompteEffective"));
  add(
    checked(payload, "transfereOrganismePaiement"),
    "organisme.paiement",
    text(payload, "dateChangementOrganisme"),
  );

  const companions: CompanionTrace[] = [];
  const cohabitants = Array.isArray(payload.cohabitants) ? payload.cohabitants : [];
  const firstFinanciallyDependent = cohabitants.some((entry) =>
    !!entry && typeof entry === "object" && (entry as Record<string, unknown>).c1PartenaireStatus === "premiere-fois",
  );
  if (firstFinanciallyDependent) {
    companions.push({
      formSlug: "c1-partenaire",
      status: "required",
      reason: "Une personne financièrement à charge est déclarée pour la première fois.",
      sourceRuleIds: ["c1_partenaire_personne_charge"],
      version: 1,
    });
  }

  if (text(payload, "situationCohabitationAmbigue") === "oui" || text(payload, "cohousingVieAutonomeRevendiquee") === "oui") {
    companions.push({
      formSlug: "c1-regis",
      status: "required",
      reason: text(payload, "cohousingVieAutonomeRevendiquee") === "oui"
        ? "Une demande explicite de co-housing doit être documentée avec l'Annexe REGIS existante."
        : "Une différence déclarée entre le C1 et les registres doit être expliquée.",
      sourceRuleIds: ["c1_annexe_regis_difference"],
      version: 1,
    });
  } else if (text(payload, "cohabiteType") === "colocation" || text(payload, "habiteEnColocation") === "oui") {
    companions.push({
      formSlug: "c1-regis",
      status: "needs_review",
      reason: "La colocation est décrite factuellement ; elle ne permet pas, à elle seule, de conclure à une catégorie familiale ou à une Annexe REGIS.",
      sourceRuleIds: ["situation_familiale_definitions"],
      version: 1,
    });
  }

  return { version: 1, changes, factsUsed: [...new Set(factsUsed)], companions };
}

export function withPersonalSituationTrace(
  decision: RegulatoryDecision | null | undefined,
  payload: FormPayload,
  now = new Date(),
  thresholds?: C1BaremeThresholds,
  options?: { regisCompleted?: boolean },
): RegulatoryDecision | (RegulatoryDecision & { personalSituationTrace: PersonalSituationTrace }) | null | undefined {
  if (!decision) return decision;
  const article110Facts = deriveArticle110FactsFromC1(payload);
  const article110Decision = article110Facts
    ? preserveArticle110TemporalHistory(
        decision.article110Decision,
        decideArticle110ChildFirstProfessionalIncome(article110Facts, now),
      )
    : undefined;
  const composition = deriveHouseholdCompositionFromC1(payload);
  const neutralisedChildFactKeys = article110Decision?.temporalEffect?.onemCode === "110&1M"
    ? composition.members.filter((member) => member.relation === "child" && member.firstProfessionalIncome).map((member) => member.factKey)
    : [];
  const householdAssessment = assessHouseholdBranch({
    composition,
    activeChildIncomeNeutralisation: article110Decision?.temporalEffect?.onemCode === "110&1M",
    officialOnemCode: decision.officialOnemState?.onemCode,
    spouseProfessionalMonthlyThreshold: thresholds?.spouseProfessionalMonthly,
    ascendantPensionWithChildMonthlyThreshold: thresholds?.ascendantPensionWithChildMonthly,
    ascendantPensionMonthlyThreshold: thresholds?.ascendantPensionMonthly,
    ascendantDisabledPensionMonthlyThreshold: thresholds?.ascendantDisabledPensionMonthly,
    baremeSource: thresholds?.source,
    neutralisedChildFactKeys,
  });
  const childrenOnlyAssessment = deriveChildrenOnlyAssessment(decision.childrenOnlyAssessment, composition, householdAssessment, payload, neutralisedChildFactKeys);
  const relativeHouseholdAssessment = deriveRelativeHouseholdAssessment(decision.relativeHouseholdAssessment, composition, householdAssessment, payload);
  const thirdPartyHouseholdAssessment = deriveThirdPartyHouseholdAssessment(decision.thirdPartyHouseholdAssessment, decision.householdAssessment, composition, householdAssessment, payload);
  const isolatedHouseholdAssessment = assessIsolatedHouseholdClaim(payload, composition, decision.officialOnemState?.onemCode, options);
  const priorIsolatedHistory = preserveIsolatedAssessmentHistory(decision.isolatedHouseholdAssessment, isolatedHouseholdAssessment);
  return {
    ...decision,
    personalSituationTrace: derivePersonalSituationTrace(payload),
    ...(article110Decision ? { article110Decision } : {}),
    householdAssessment,
    ...(childrenOnlyAssessment ? { childrenOnlyAssessment } : {}),
    ...(relativeHouseholdAssessment ? { relativeHouseholdAssessment } : {}),
    ...(thirdPartyHouseholdAssessment ? { thirdPartyHouseholdAssessment } : {}),
    isolatedHouseholdAssessment,
    ...(priorIsolatedHistory || decision.isolatedHouseholdAssessmentHistory
      ? { isolatedHouseholdAssessmentHistory: [...(decision.isolatedHouseholdAssessmentHistory ?? []), ...(priorIsolatedHistory ?? [])] }
      : {}),
  };
}
