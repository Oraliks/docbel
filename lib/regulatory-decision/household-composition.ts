export type HouseholdCompositionKind =
  | "alone"
  | "spouse_or_partner"
  | "children_only"
  | "children_and_relatives"
  | "relatives_only"
  | "children_and_third_parties"
  | "relatives_and_third_parties"
  | "children_relatives_and_third_parties"
  | "third_parties_only"
  | "mixed_or_unsupported";

export type HouseholdRelation = "spouse" | "partner" | "child" | "relative" | "third_party" | "unknown";

/**
 * Canonical, document-independent input for the Article 110 assessment.
 * `undefined` means unknown; `false` and a zero amount are deliberate facts.
 * Adapters (C1, the theoretical checker, or a saved bundle) must map into this
 * shape instead of carrying their own family decision rules.
 */
export type FamilyIncome = {
  kind: "professional" | "replacement" | "pension" | "spf_disability";
  amount?: number;
  /** Declared amount for the evaluated month; it is a fact, not proof availability. */
  monthlyAmount?: number;
  amountKind?: "gross" | "net";
  active?: boolean;
  contract?: "cdi" | "cdd" | "independent" | "other";
  variable?: boolean;
  firstProfessionalIncome?: boolean;
  neutralisationRequested?: boolean;
  startedAt?: string;
  studiesEndedAt?: string;
};

export type FamilyPerson = {
  id: string;
  relation: HouseholdRelation;
  partnerEstablished?: boolean;
  receivesFamilyAllowances?: boolean;
  disabilityRelevant?: boolean;
  isAscendant?: boolean;
  incomes: FamilyIncome[];
};

export type FamilyFacts = {
  asOf: string;
  people: FamilyPerson[];
  /** Explicit distinction for a household made exclusively of third parties. */
  cohousing?: { declared?: boolean };
  isolated?: {
    alimony?: { paid?: boolean; admissibleBasis?: boolean; beneficiary?: "minor_child" | "adult_child" | "other"; adultChildInNeed?: boolean };
    alternatingCare?: {
      /** Average calendar days of actual presence per week, measured over the declared cycle. */
      averageDaysPerWeek?: number;
      cycle?: "monthly" | "quarterly" | "semiannual" | "annual";
      familyAllowances?: boolean;
      childHasRelevantIncome?: boolean;
      /** Several alternating-care children are assessed together, like the children-only branch. */
      children?: Array<{ id: string; familyAllowances?: boolean; hasRelevantIncome?: boolean }>;
    };
  };
};

export type HouseholdMemberFact = {
  relation: HouseholdRelation;
  partnerEstablished?: boolean;
  /** Income actually received by the household member, before Article 60 treatment. */
  hasProfessionalIncome?: boolean;
  professionalIncomeAmount?: number;
  professionalIncomeContract?: "cdi" | "cdd" | "other";
  professionalIncomeVariable?: boolean;
  /** Evidence carried by the external ONEM C110A for the assessed month. */
  c110aReceived?: boolean;
  c110aMonthlyDeclaredIncome?: number;
  hasReplacementIncome?: boolean;
  /** The income exists, but an SPF disability allowance is neutral for this decision. */
  replacementIncomeRelevantForFamilyStatus?: boolean;
  replacementIncomeType?: "pension" | "disability_allowance" | "other";
  replacementIncomeAmount?: number;
  pensionProofAvailable?: boolean;
  pensionGrossAmountConfirmed?: boolean;
  isAscendant?: boolean;
  disabilityDeclared?: boolean;
  disabilityProofAvailable?: boolean;
  receivesFamilyAllowances?: boolean;
  firstProfessionalIncome?: boolean;
  studiesEndedAt?: string;
  factKey: string;
};

export type HouseholdComposition = {
  kind: HouseholdCompositionKind;
  members: HouseholdMemberFact[];
  factKeys: string[];
  needsReview: boolean;
};

export type HouseholdAssessment = {
  composition: HouseholdCompositionKind;
  status: "probable" | "needs_information" | "needs_review";
  expectedCategory: "A" | "N" | "B" | null;
  /** Article applied to the operational follow-up; it is not an ONEM code. */
  operationalArticle: "60A" | "60B" | "none" | "needs_review";
  /** Keeps actual income separate from whether it is relevant after the Article 60 check. */
  incomeAssessment: "no_income" | "not_relevant" | "relevant" | "needs_review";
  /** Monthly rate assessment; it never changes the official ONEM family state. */
  monthlyPaymentAssessment: "A_RATE" | "B_RATE" | "NEEDS_C110A" | "NEEDS_REVIEW";
  baremeSource?: { fileId: string; fileName: string; validFrom?: string };
  /** The official C110A exists, but is not a DocBel PDF form and must not be synthesized. */
  requiredExternalDocument?: { document: "C110A"; status: "required" | "received"; url: string; reason: string };
  monthlyC110aIncome?: number;
  recommendedAction: "none" | "declaration_required" | "information_required" | "review_required" | "await_onem_decision";
  officialOnemCode?: string;
  trigger: "c1_household_update";
  factKeys: string[];
  sourceRuleIds: string[];
  /** Explanation and gaps are produced by the common calculation, never rebuilt by a UI. */
  explanation?: string;
  missingFacts?: string[];
  evaluatedAt?: string;
  /** Alternating care fulfilling its conditions applies to every day of the week. */
  appliesAllWeek?: boolean;
  pensionAssessment?: { status: "VERIFIED" | "NEEDS_DOCUMENT" | "NEEDS_INFORMATION"; grossTotal?: number; threshold?: number; document: "SPF_PENSIONS_PROOF"; proofStatus: "received" | "required" };
};

function explainAssessment(assessment: HouseholdAssessment, evaluatedAt: string): HouseholdAssessment {
  const explanation = assessment.sourceRuleIds.includes("situation_familiale_cohousing_a_verifier")
    ? assessment.status === "needs_information"
      ? "Indiquez si le ménage composé de tiers est une situation de co-housing."
      : "La situation de co-housing ou de cohabitation avec des tiers doit être examinée par l’ONEM."
    : assessment.expectedCategory === "A"
    ? "Les faits déclarés correspondent à une situation théorique de charge de famille."
    : assessment.expectedCategory === "N"
      ? "Les faits déclarés correspondent à une situation théorique de personne isolée."
      : assessment.expectedCategory === "B"
        ? "Les faits déclarés correspondent à une situation théorique de cohabitation avec revenu pertinent."
        : "Des faits déterminants doivent encore être précisés avant une qualification théorique.";
  return {
    ...assessment,
    explanation,
    ...(assessment.expectedCategory === null ? { missingFacts: assessment.factKeys } : {}),
    evaluatedAt,
  };
}

/** Turns the shared fact contract into the evaluator's compact working facts. */
export function householdCompositionFromFamilyFacts(facts: FamilyFacts): HouseholdComposition {
  return classifyHouseholdComposition(facts.people.map((person) => {
    const professional = person.incomes.filter((income) => income.kind === "professional" && income.active !== false);
    const replacement = person.incomes.filter((income) => income.kind === "replacement" && income.active !== false);
    const pensions = person.incomes.filter((income) => income.kind === "pension" && income.active !== false);
    const disability = person.incomes.some((income) => income.kind === "spf_disability" && income.active !== false);
    const primaryProfessional = professional[0];
    const professionalAmount = professional.length > 0 && professional.every((income) => Number.isFinite(income.amount))
      ? professional.reduce((total, income) => total + (income.amount ?? 0), 0)
      : undefined;
    const pensionAmount = pensions.reduce((total, income) => total + (income.amount ?? 0), 0);
    return {
      factKey: person.id,
      relation: person.relation,
      partnerEstablished: person.partnerEstablished,
      receivesFamilyAllowances: person.receivesFamilyAllowances,
      isAscendant: person.isAscendant,
      disabilityDeclared: person.disabilityRelevant,
      disabilityProofAvailable: person.disabilityRelevant,
      hasProfessionalIncome: professional.length > 0,
      professionalIncomeAmount: professionalAmount,
      c110aReceived: typeof primaryProfessional?.monthlyAmount === "number" && Number.isFinite(primaryProfessional.monthlyAmount),
      c110aMonthlyDeclaredIncome: primaryProfessional?.monthlyAmount,
      professionalIncomeContract: professional.length === 1 && primaryProfessional?.contract !== "independent" ? primaryProfessional?.contract : professional.length > 1 || primaryProfessional?.contract === "independent" ? "other" : undefined,
      professionalIncomeVariable: primaryProfessional?.variable,
      hasReplacementIncome: replacement.length > 0 || pensions.length > 0 || disability,
      replacementIncomeRelevantForFamilyStatus: disability && replacement.length === 0 && pensions.length === 0 ? false : undefined,
      replacementIncomeType: pensions.length > 0 ? "pension" : disability ? "disability_allowance" : replacement.length > 0 ? "other" : undefined,
      replacementIncomeAmount: pensions.length > 0 ? pensionAmount : replacement[0]?.amount,
      // A declared gross amount is a calculation fact. Availability of a copy is
      // handled by the document flow and must not change the theoretical branch.
      pensionProofAvailable: pensions.length > 0 ? true : undefined,
      pensionGrossAmountConfirmed: pensions.length > 0 ? pensions.every((income) => income.amountKind === "gross") : undefined,
      firstProfessionalIncome: professional.some((income) => income.firstProfessionalIncome),
      studiesEndedAt: undefined,
    };
  }));
}

/** The sole public Article 110 calculation entry point for new consumers. */
export function evaluateFamilySituation(input: {
  facts: FamilyFacts;
  activeChildIncomeNeutralisation: boolean;
  spouseProfessionalMonthlyThreshold?: number | null;
  ascendantPensionWithChildMonthlyThreshold?: number | null;
  ascendantPensionMonthlyThreshold?: number | null;
  ascendantDisabledPensionMonthlyThreshold?: number | null;
  baremeSource?: { fileId: string; fileName: string; validFrom: Date | null } | null;
  neutralisedChildIds?: string[];
}): HouseholdAssessment {
  if (input.facts.people.length === 0) {
    const alimony = input.facts.isolated?.alimony;
    const alimonyAssessment = alimony?.paid === true ? ((): HouseholdAssessment => {
      const adultChildUnclear = alimony.beneficiary === "adult_child" && alimony.adultChildInNeed !== true;
      if (alimony.admissibleBasis === true && alimony.beneficiary && !adultChildUnclear) {
        return { composition: "alone", status: "probable", expectedCategory: "A", operationalArticle: "none", incomeAssessment: "not_relevant", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: "declaration_required", trigger: "c1_household_update", factKeys: [], sourceRuleIds: ["situation_familiale_isole_pension_alimentaire"] };
      }
      return { composition: "alone", status: "needs_information", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: "information_required", trigger: "c1_household_update", factKeys: ["isolated.alimony"], sourceRuleIds: ["situation_familiale_isole_pension_alimentaire"] };
    })() : null;
    const care = input.facts.isolated?.alternatingCare;
    if (care) {
      const averageDaysPerWeek = care.averageDaysPerWeek;
      const missingCareFacts = [
        ...(typeof averageDaysPerWeek !== "number" || !Number.isFinite(averageDaysPerWeek) || averageDaysPerWeek < 0 ? ["isolated.alternatingCare.averageDaysPerWeek"] : []),
        ...(!care.cycle ? ["isolated.alternatingCare.cycle"] : []),
      ];
      if (missingCareFacts.length > 0) {
        if (alimonyAssessment?.expectedCategory === "A") return explainAssessment(alimonyAssessment, input.facts.asOf);
        return explainAssessment({ composition: "alone", status: "needs_information", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: "information_required", trigger: "c1_household_update", factKeys: missingCareFacts, sourceRuleIds: ["situation_familiale_isole_garde_alternee"] }, input.facts.asOf);
      }
      if (averageDaysPerWeek !== undefined && averageDaysPerWeek >= 2) {
        const familyAllowances = care.children?.some((child) => child.familyAllowances === true)
          ? true
          : care.children && care.children.every((child) => child.familyAllowances === false)
            ? false
            : care.children ? undefined : care.familyAllowances;
        const childHasRelevantIncome = care.children?.some((child) => child.hasRelevantIncome === true)
          ? true
          : care.children && care.children.every((child) => child.hasRelevantIncome === false)
            ? false
            : care.children ? undefined : care.childHasRelevantIncome;
        if (familyAllowances === true || childHasRelevantIncome === false) {
          return explainAssessment({ composition: "alone", status: "probable", expectedCategory: "A", operationalArticle: "none", incomeAssessment: "not_relevant", monthlyPaymentAssessment: "A_RATE", recommendedAction: "declaration_required", trigger: "c1_household_update", factKeys: [], sourceRuleIds: ["situation_familiale_isole_garde_alternee"], appliesAllWeek: true }, input.facts.asOf);
        }
        if (familyAllowances === false && childHasRelevantIncome === true) {
          return explainAssessment({ composition: "children_only", status: "probable", expectedCategory: "B", operationalArticle: "none", incomeAssessment: "relevant", monthlyPaymentAssessment: "B_RATE", recommendedAction: "declaration_required", trigger: "c1_household_update", factKeys: [], sourceRuleIds: ["situation_familiale_isole_garde_alternee"] }, input.facts.asOf);
        }
        if (alimonyAssessment?.expectedCategory === "A") return explainAssessment(alimonyAssessment, input.facts.asOf);
        const missingChildFacts = [
          ...(familyAllowances === undefined ? ["isolated.alternatingCare.familyAllowances"] : []),
          ...(childHasRelevantIncome === undefined ? ["isolated.alternatingCare.childHasRelevantIncome"] : []),
        ];
        return explainAssessment({ composition: "alone", status: "needs_information", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: "information_required", trigger: "c1_household_update", factKeys: missingChildFacts, sourceRuleIds: ["situation_familiale_isole_garde_alternee"] }, input.facts.asOf);
      }
    }
    if (alimonyAssessment) return explainAssessment(alimonyAssessment, input.facts.asOf);
    return explainAssessment({
      composition: "alone",
      status: "probable",
      expectedCategory: "N",
      operationalArticle: "none",
      incomeAssessment: "not_relevant",
      monthlyPaymentAssessment: "NEEDS_REVIEW",
      recommendedAction: "declaration_required",
      trigger: "c1_household_update",
      factKeys: [],
      sourceRuleIds: ["situation_familiale_categories", "situation_familiale_composition_priorities"],
    }, input.facts.asOf);
  }
  const assessment = assessHouseholdBranch({
    composition: householdCompositionFromFamilyFacts(input.facts),
    activeChildIncomeNeutralisation: input.activeChildIncomeNeutralisation,
    spouseProfessionalMonthlyThreshold: input.spouseProfessionalMonthlyThreshold,
    ascendantPensionWithChildMonthlyThreshold: input.ascendantPensionWithChildMonthlyThreshold,
    ascendantPensionMonthlyThreshold: input.ascendantPensionMonthlyThreshold,
    ascendantDisabledPensionMonthlyThreshold: input.ascendantDisabledPensionMonthlyThreshold,
    baremeSource: input.baremeSource,
    neutralisedChildFactKeys: input.neutralisedChildIds,
    cohousingDeclared: input.facts.cohousing?.declared,
  });
  const theoreticalAssessment = { ...assessment };
  delete theoreticalAssessment.requiredExternalDocument;
  delete theoreticalAssessment.pensionAssessment;
  return explainAssessment(theoreticalAssessment, input.facts.asOf);
}

function hasRelevantReplacementIncome(member: HouseholdMemberFact): boolean | undefined {
  if (member.hasReplacementIncome === undefined) return undefined;
  return member.hasReplacementIncome && member.replacementIncomeRelevantForFamilyStatus !== false;
}

/**
 * Composition is established before income rules. A spouse or an explicitly
 * recognised partner always wins over the other household relationships.
 */
export function classifyHouseholdComposition(members: HouseholdMemberFact[]): HouseholdComposition {
  const factKeys = members.map((member) => member.factKey);
  if (members.length === 0) return { kind: "alone", members, factKeys, needsReview: false };

  const spouseOrEstablishedPartner = members.some(
    (member) => member.relation === "spouse" || (member.relation === "partner" && member.partnerEstablished === true),
  );
  if (spouseOrEstablishedPartner) return { kind: "spouse_or_partner", members, factKeys, needsReview: false };

  const ambiguousPartner = members.some((member) => member.relation === "partner" && member.partnerEstablished !== true);
  const unknown = members.some((member) => member.relation === "unknown");
  if (ambiguousPartner || unknown) return { kind: "mixed_or_unsupported", members, factKeys, needsReview: true };

  const children = members.some((member) => member.relation === "child");
  const relatives = members.some((member) => member.relation === "relative");
  const thirdParties = members.some((member) => member.relation === "third_party");
  if (children && !relatives && !thirdParties) return { kind: "children_only", members, factKeys, needsReview: false };
  if (children && relatives && !thirdParties) return { kind: "children_and_relatives", members, factKeys, needsReview: true };
  if (!children && relatives && !thirdParties) return { kind: "relatives_only", members, factKeys, needsReview: true };
  if (children && !relatives && thirdParties) return { kind: "children_and_third_parties", members, factKeys, needsReview: true };
  if (!children && relatives && thirdParties) return { kind: "relatives_and_third_parties", members, factKeys, needsReview: true };
  if (children && relatives && thirdParties) return { kind: "children_relatives_and_third_parties", members, factKeys, needsReview: true };
  if (thirdParties) return { kind: "third_parties_only", members, factKeys, needsReview: false };
  return { kind: "mixed_or_unsupported", members, factKeys, needsReview: true };
}

function action(officialOnemCode: string | undefined, fallback: HouseholdAssessment["recommendedAction"]): HouseholdAssessment["recommendedAction"] {
  return officialOnemCode ? "await_onem_decision" : fallback;
}

/**
 * Narrow first evaluator. It intentionally covers only the recognised
 * spouse/partner priority and the children-only branch; every other branch is
 * retained as composition data and sent to review rather than guessed.
 */
export function assessHouseholdBranch(input: {
  composition: HouseholdComposition;
  activeChildIncomeNeutralisation: boolean;
  officialOnemCode?: string;
  spouseProfessionalMonthlyThreshold?: number | null;
  ascendantPensionWithChildMonthlyThreshold?: number | null;
  ascendantPensionMonthlyThreshold?: number | null;
  ascendantDisabledPensionMonthlyThreshold?: number | null;
  baremeSource?: { fileId: string; fileName: string; validFrom: Date | null } | null;
  neutralisedChildFactKeys?: string[];
  cohousingDeclared?: boolean;
}): HouseholdAssessment {
  const { composition, activeChildIncomeNeutralisation, officialOnemCode, spouseProfessionalMonthlyThreshold, baremeSource, neutralisedChildFactKeys = [], ascendantPensionWithChildMonthlyThreshold, ascendantPensionMonthlyThreshold, ascendantDisabledPensionMonthlyThreshold, cohousingDeclared } = input;
  const base = {
    composition: composition.kind,
    officialOnemCode,
    trigger: "c1_household_update" as const,
    factKeys: composition.factKeys,
    sourceRuleIds: ["situation_familiale_composition_priorities"],
    ...(baremeSource ? {
      baremeSource: {
        fileId: baremeSource.fileId,
        fileName: baremeSource.fileName,
        ...(baremeSource.validFrom ? { validFrom: baremeSource.validFrom.toISOString().slice(0, 10) } : {}),
      },
    } : {}),
  };

  if (composition.kind === "third_parties_only") {
    const cohousingBase = { ...base, sourceRuleIds: [...base.sourceRuleIds, "situation_familiale_cohousing_a_verifier"] };
    if (cohousingDeclared === undefined) return { ...cohousingBase, status: "needs_information", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "information_required"), factKeys: ["cohousing.declared"] };
    return { ...cohousingBase, status: "needs_review", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "review_required") };
  }

  if (composition.kind === "spouse_or_partner") {
    const spouseBase = {
      ...base,
      sourceRuleIds: [...base.sourceRuleIds, "situation_familiale_conjoint_revenu_am60"],
    };
    const recognised = composition.members.filter(
      (member) => member.relation === "spouse" || (member.relation === "partner" && member.partnerEstablished === true),
    );
    const missingIncome = recognised.some((member) => member.hasProfessionalIncome === undefined || hasRelevantReplacementIncome(member) === undefined);
    if (missingIncome) return { ...spouseBase, status: "needs_information", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "information_required") };
    const withoutIncome = recognised.some((member) => member.hasProfessionalIncome === false && hasRelevantReplacementIncome(member) === false);
    if (withoutIncome) return { ...spouseBase, status: "probable", expectedCategory: "A", operationalArticle: "none", incomeAssessment: "no_income", monthlyPaymentAssessment: "A_RATE", recommendedAction: action(officialOnemCode, "declaration_required") };

    const salaried = recognised.filter((member) => member.hasProfessionalIncome === true && member.professionalIncomeContract !== "other");
    if (salaried.length === 0) return { ...spouseBase, status: "probable", expectedCategory: "B", operationalArticle: "none", incomeAssessment: "relevant", monthlyPaymentAssessment: "B_RATE", recommendedAction: action(officialOnemCode, "declaration_required") };
    const incompleteSalaryFacts = salaried.some((member) =>
      !Number.isFinite(member.professionalIncomeAmount) || !member.professionalIncomeContract || member.professionalIncomeVariable === undefined,
    );
    if (incompleteSalaryFacts || spouseProfessionalMonthlyThreshold === null || spouseProfessionalMonthlyThreshold === undefined) {
      return { ...spouseBase, status: "needs_information", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "information_required") };
    }
    const belowThreshold = salaried.every((member) => (member.professionalIncomeAmount as number) <= spouseProfessionalMonthlyThreshold);
    if (!belowThreshold) return { ...spouseBase, status: "probable", expectedCategory: "B", operationalArticle: "none", incomeAssessment: "relevant", monthlyPaymentAssessment: "B_RATE", recommendedAction: action(officialOnemCode, "declaration_required") };
    const fixedCdi = salaried.every((member) => member.professionalIncomeContract === "cdi" && member.professionalIncomeVariable === false);
    if (fixedCdi) return { ...spouseBase, status: "probable", expectedCategory: "A", operationalArticle: "60A", incomeAssessment: "not_relevant", monthlyPaymentAssessment: "A_RATE", recommendedAction: action(officialOnemCode, "declaration_required") };
    const variableIncome = salaried.some((member) => member.professionalIncomeVariable === true);
    if (variableIncome) {
      const c110aReceived = salaried.every((member) => member.c110aReceived === true);
      const c110aIncome = salaried.length === 1 ? salaried[0].c110aMonthlyDeclaredIncome : undefined;
      const document = {
        document: "C110A" as const,
        status: c110aReceived ? "received" as const : "required" as const,
        url: "https://www.onem.be/formulaires-attestations/c110a",
      };
      if (!c110aReceived) return {
        ...spouseBase,
        status: "needs_review",
        expectedCategory: "B",
        operationalArticle: "60B",
        incomeAssessment: "relevant",
        monthlyPaymentAssessment: "NEEDS_C110A",
        requiredExternalDocument: { ...document, reason: "Le revenu est variable : le C110A officiel est requis pour apprécier le taux du mois." },
        recommendedAction: action(officialOnemCode, "review_required"),
      };
      if (!Number.isFinite(c110aIncome)) return {
        ...spouseBase,
        status: "needs_review",
        expectedCategory: "B",
        operationalArticle: "60B",
        incomeAssessment: "relevant",
        monthlyPaymentAssessment: "NEEDS_REVIEW",
        requiredExternalDocument: { ...document, reason: "Le C110A est indiqué comme reçu, mais son revenu mensuel doit être vérifié." },
        recommendedAction: action(officialOnemCode, "review_required"),
      };
      const assessedC110aIncome = c110aIncome as number;
      return {
        ...spouseBase,
        status: "needs_review",
        expectedCategory: "B",
        operationalArticle: "60B",
        incomeAssessment: "relevant",
        monthlyPaymentAssessment: assessedC110aIncome <= spouseProfessionalMonthlyThreshold ? "A_RATE" : "B_RATE",
        monthlyC110aIncome: assessedC110aIncome,
        requiredExternalDocument: {
          ...document,
          reason: "Le C110A permet d'apprécier le taux applicable pour ce mois sans modifier le traitement de base B / 60B.",
        },
        recommendedAction: action(officialOnemCode, "review_required"),
      };
    }
    return { ...spouseBase, status: "needs_review", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "review_required") };
  }

  if (composition.kind === "children_only") {
    const familyAllowanceChild = composition.members.some((member) => member.relation === "child" && member.receivesFamilyAllowances === true);
    const hasRelevantIncome = composition.members.some((member) =>
      member.relation === "child"
      && (member.hasProfessionalIncome === true || hasRelevantReplacementIncome(member) === true)
      && !neutralisedChildFactKeys.includes(member.factKey)
    );
    if (familyAllowanceChild || (!hasRelevantIncome && activeChildIncomeNeutralisation)) {
      return { ...base, status: "probable", expectedCategory: "A", operationalArticle: "none", incomeAssessment: "no_income", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "declaration_required") };
    }
    if (!hasRelevantIncome) return { ...base, status: "probable", expectedCategory: "A", operationalArticle: "none", incomeAssessment: "no_income", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "declaration_required") };
    return { ...base, status: "probable", expectedCategory: "B", operationalArticle: "none", incomeAssessment: "relevant", monthlyPaymentAssessment: "B_RATE", recommendedAction: action(officialOnemCode, "declaration_required") };
  }

  if (composition.kind === "relatives_only" || composition.kind === "children_and_relatives") {
    const relativeBase = { ...base, sourceRuleIds: [...base.sourceRuleIds, "situation_familiale_ascendants_pensions"] };
    const relatives = composition.members.filter((member) => member.relation === "relative");
    // With children and relatives, Article 110 requires a child for whom family
    // allowances are due as well as relatives without relevant income. A child
    // with income cannot be silently neutralised outside its own 110&1M period.
    if (composition.kind === "children_and_relatives" && !composition.members.some(
      (member) => member.relation === "child" && member.receivesFamilyAllowances === true,
    )) {
      return { ...relativeBase, status: "probable", expectedCategory: "B", operationalArticle: "none", incomeAssessment: "relevant", monthlyPaymentAssessment: "B_RATE", recommendedAction: action(officialOnemCode, "declaration_required") };
    }
    if (relatives.some((member) => member.hasProfessionalIncome === true)) return { ...relativeBase, status: "probable", expectedCategory: "B", operationalArticle: "none", incomeAssessment: "relevant", monthlyPaymentAssessment: "B_RATE", recommendedAction: action(officialOnemCode, "declaration_required") };
    const relevantNonPension = relatives.some((member) => hasRelevantReplacementIncome(member) === true && member.replacementIncomeType !== "pension");
    if (relevantNonPension) return { ...relativeBase, status: "probable", expectedCategory: "B", operationalArticle: "none", incomeAssessment: "relevant", monthlyPaymentAssessment: "B_RATE", recommendedAction: action(officialOnemCode, "declaration_required") };
    const pensions = relatives.filter((member) => member.replacementIncomeType === "pension");
    if (pensions.length === 0) return { ...relativeBase, status: "probable", expectedCategory: "A", operationalArticle: "none", incomeAssessment: "no_income", monthlyPaymentAssessment: "A_RATE", recommendedAction: action(officialOnemCode, "declaration_required") };
    if (pensions.some((member) => member.isAscendant !== true)) return { ...relativeBase, status: "needs_review", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "review_required") };
    const declaredDisabilityWithoutProof = pensions.some((member) => member.disabilityDeclared === true && member.disabilityProofAvailable !== true);
    if (declaredDisabilityWithoutProof) return { ...relativeBase, status: "needs_information", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "information_required") };
    const threshold = composition.kind === "children_and_relatives"
      ? ascendantPensionWithChildMonthlyThreshold
      : pensions.some((member) => member.disabilityProofAvailable === true)
        ? ascendantDisabledPensionMonthlyThreshold
        : ascendantPensionMonthlyThreshold;
    const proofMissing = pensions.some((member) => member.pensionProofAvailable !== true);
    if (proofMissing) return { ...relativeBase, status: "needs_information", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "information_required"), pensionAssessment: { status: "NEEDS_DOCUMENT", document: "SPF_PENSIONS_PROOF", proofStatus: "required" } };
    const grossAmountMissing = pensions.some((member) => member.pensionGrossAmountConfirmed !== true);
    const totalPension = pensions.reduce((sum, member) => sum + (member.replacementIncomeAmount ?? Number.NaN), 0);
    if (grossAmountMissing || !Number.isFinite(totalPension) || threshold === null || threshold === undefined) return { ...relativeBase, status: "needs_information", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "information_required"), pensionAssessment: { status: "NEEDS_INFORMATION", document: "SPF_PENSIONS_PROOF", proofStatus: "received" } };
    return totalPension <= threshold
      ? { ...relativeBase, status: "probable", expectedCategory: "A", operationalArticle: "none", incomeAssessment: "not_relevant", monthlyPaymentAssessment: "A_RATE", recommendedAction: action(officialOnemCode, "declaration_required"), pensionAssessment: { status: "VERIFIED", grossTotal: totalPension, threshold, document: "SPF_PENSIONS_PROOF", proofStatus: "received" } }
      : { ...relativeBase, status: "probable", expectedCategory: "B", operationalArticle: "none", incomeAssessment: "relevant", monthlyPaymentAssessment: "B_RATE", recommendedAction: action(officialOnemCode, "declaration_required"), pensionAssessment: { status: "VERIFIED", grossTotal: totalPension, threshold, document: "SPF_PENSIONS_PROOF", proofStatus: "received" } };
  }

  if (composition.kind === "children_and_third_parties" || composition.kind === "relatives_and_third_parties" || composition.kind === "children_relatives_and_third_parties") {
    const thirdParties = composition.members.filter((member) => member.relation === "third_party");
    const unknownIncome = thirdParties.some((member) => member.hasProfessionalIncome === undefined && hasRelevantReplacementIncome(member) === undefined);
    const relevantThirdIncome = thirdParties.some((member) => member.hasProfessionalIncome === true || hasRelevantReplacementIncome(member) === true);
    const thirdBase = { ...base, sourceRuleIds: [...base.sourceRuleIds, "situation_familiale_third_parties"] };
    if (unknownIncome) return { ...thirdBase, status: "needs_information", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "information_required") };
    if (relevantThirdIncome) return { ...thirdBase, status: "probable", expectedCategory: "B", operationalArticle: "none", incomeAssessment: "relevant", monthlyPaymentAssessment: "B_RATE", recommendedAction: action(officialOnemCode, "declaration_required") };
    const withoutThirdParties = classifyHouseholdComposition(composition.members.filter((member) => member.relation !== "third_party"));
    const baseAssessment = assessHouseholdBranch({
      ...input,
      composition: withoutThirdParties,
      neutralisedChildFactKeys,
    });
    return { ...baseAssessment, composition: composition.kind, factKeys: composition.factKeys, sourceRuleIds: [...baseAssessment.sourceRuleIds, "situation_familiale_third_parties"] };
  }

  return { ...base, status: "needs_review", expectedCategory: null, operationalArticle: "needs_review", incomeAssessment: "needs_review", monthlyPaymentAssessment: "NEEDS_REVIEW", recommendedAction: action(officialOnemCode, "review_required") };
}
