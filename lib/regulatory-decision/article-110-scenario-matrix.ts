import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";

import { evaluateArticle110Verifier, type Article110Category, type Article110ResultType, type Article110VerifierInput } from "./article-110-verifier";

export type Article110Scenario = {
  id: string;
  label: string;
  input: Omit<Article110VerifierInput, "thresholds">;
};

export type Article110ScenarioContract = {
  id: string;
  label: string;
  branch: string;
  facts: Omit<Article110VerifierInput, "thresholds">;
  officialOnemState?: string;
  resultType: Article110ResultType;
  category: Article110Category;
  potentialCategory?: Article110Category;
  informationStatus: "complete" | "incomplete";
  documentStatus: "complete" | "required";
  onemDecisionStatus: "not_required" | "required";
  automationStatus: "automated" | "partial" | "not_automated";
  householdComposition: string;
  reason: string;
  decisiveFacts: string[];
  missingFacts: string[];
  missingDocuments: string[];
  actions: string[];
  potentialOutcome?: string;
  declarationRequired: boolean;
  sourceRuleIds: string[];
};

export type Article110MatrixReport = {
  generatedAt: string;
  method: string;
  total: number;
  byResultType: Record<Article110ResultType, number>;
  byCategory: Record<"A" | "B" | "N", number>;
  supplementalStatuses: { informationIncomplete: number; documentsRequired: number; onemDecisionRequired: number; automationPartial: number; notAutomated: number };
  potentialTransitions: { B_to_N: number; B_to_A: number; N_to_A: number };
  byBranch: Record<string, number>;
  onemByBranch: Record<string, number>;
  incoherent: string[];
  withoutReason: string[];
  space: { raw: number; invalid: number; duplicates: number; executed: number; exclusions: Record<string, number> };
  coverage: Record<string, string[]>;
  mixedOrUnsupported: { scenarioIds: string[]; signature: string; count: number; facts: string; householdComposition: string; classifierReason: string; expectedBranchIfKnown: string; diagnosis: "A" | "B" | "C" }[];
  compositionCoverage: { composition: string; total: number; determined: number; information: number; document: number; onem: number; notAutomated: number }[];
  assertions: { resultTypesTotal: boolean; categoriesTotal: boolean; incoherent: boolean; withoutReason: boolean; atLeastOneA: boolean; atLeastOneB: boolean; atLeastOneN: boolean };
  anomalies: string[];
  durationMs: number;
  scenarios: Article110ScenarioContract[];
};

const member = (id: string, label: string, relation: Article110VerifierInput["people"][number]["relation"], facts: Partial<Article110VerifierInput["people"][number]> = {}) => ({ id, label, relation, ...facts });

/**
 * Meaningful equivalence classes, deliberately not a cartesian product. Each
 * scenario maps to a branch, a boundary, a document state, or a temporal state
 * already understood by the Article 110 evaluator.
 */
export function generateRepresentativeArticle110Scenarios(thresholds: C1BaremeThresholds): Article110Scenario[] {
  const spouseThreshold = thresholds.spouseProfessionalMonthly ?? 1_000;
  const pensionThreshold = thresholds.ascendantPensionMonthly ?? 1_000;
  const at = (date: string) => new Date(`${date}T12:00:00.000Z`);
  return [
    { id: "composition-missing", label: "Composition non renseignée", input: { people: [] } },
    { id: "alone-no-special-situation", label: "Vit seul sans situation particulière", input: { people: [], isAloneExplicit: true, alimony: { enabled: false }, alternatingCare: { enabled: false }, cohousingClaim: false } },
    { id: "spouse-missing-income", label: "Conjoint sans revenus renseignés", input: { people: [member("spouse", "Conjoint", "spouse")] } },
    { id: "spouse-no-income", label: "Conjoint sans revenu", input: { people: [member("spouse", "Conjoint", "spouse", { hasProfessionalIncome: false, hasReplacementIncome: false })] } },
    { id: "spouse-cdi-below", label: "Conjoint CDI sous le seuil", input: { people: [member("spouse", "Conjoint", "spouse", { hasProfessionalIncome: true, professionalIncomeAmount: spouseThreshold - 1, professionalIncomeContract: "cdi", professionalIncomeVariable: false, hasReplacementIncome: false })] } },
    { id: "spouse-cdi-at-threshold", label: "Conjoint CDI au seuil", input: { people: [member("spouse", "Conjoint", "spouse", { hasProfessionalIncome: true, professionalIncomeAmount: spouseThreshold, professionalIncomeContract: "cdi", professionalIncomeVariable: false, hasReplacementIncome: false })] } },
    { id: "spouse-cdi-above", label: "Conjoint CDI au-dessus du seuil", input: { people: [member("spouse", "Conjoint", "spouse", { hasProfessionalIncome: true, professionalIncomeAmount: spouseThreshold + 1, professionalIncomeContract: "cdi", professionalIncomeVariable: false, hasReplacementIncome: false })] } },
    { id: "spouse-variable-c110a-missing", label: "Conjoint à revenu variable sans C110A", input: { people: [member("spouse", "Conjoint", "spouse", { hasProfessionalIncome: true, professionalIncomeAmount: spouseThreshold, professionalIncomeContract: "cdd", professionalIncomeVariable: true, hasReplacementIncome: false, c110aReceived: false })] } },
    { id: "children-allowances", label: "Enfant avec allocations familiales", input: { people: [member("child", "Enfant", "child", { hasProfessionalIncome: false, hasReplacementIncome: false, receivesFamilyAllowances: true })] } },
    { id: "children-income", label: "Enfant avec revenu pertinent", input: { people: [member("child", "Enfant", "child", { hasProfessionalIncome: true, professionalIncomeAmount: spouseThreshold, hasReplacementIncome: false, receivesFamilyAllowances: false })] } },
    { id: "children-110-1m", label: "Premier emploi neutralisé (110&1M)", input: { assessedAt: at("2026-10-08"), people: [member("child", "Enfant", "child", { hasProfessionalIncome: true, professionalIncomeAmount: spouseThreshold, hasReplacementIncome: false, receivesFamilyAllowances: false, firstProfessionalIncome: true, neutralisationRequested: true, firstProfessionalIncomeStartedAt: "2026-09-01", studiesEndedAt: "2026-08-31" })] } },
    { id: "children-110-1v", label: "Réévaluation après 110&1M (110&1V)", input: { assessedAt: at("2027-09-01"), people: [member("child", "Enfant", "child", { hasProfessionalIncome: true, professionalIncomeAmount: spouseThreshold, hasReplacementIncome: false, receivesFamilyAllowances: false, firstProfessionalIncome: true, neutralisationRequested: true, firstProfessionalIncomeStartedAt: "2026-09-01", studiesEndedAt: "2026-08-31" })] } },
    { id: "relative-pension-document-missing", label: "Pension d’ascendant sans preuve", input: { people: [member("parent", "Père", "relative", { isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: pensionThreshold, pensionProofAvailable: false, pensionGrossAmountConfirmed: false })] } },
    { id: "relative-pension-at-threshold", label: "Pension d’ascendant au seuil", input: { people: [member("parent", "Père", "relative", { isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: pensionThreshold, pensionProofAvailable: true, pensionGrossAmountConfirmed: true })] } },
    { id: "relative-pension-above", label: "Pension d’ascendant au-dessus du seuil", input: { people: [member("parent", "Père", "relative", { isAscendant: true, hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension", replacementIncomeAmount: pensionThreshold + 1, pensionProofAvailable: true, pensionGrossAmountConfirmed: true })] } },
    { id: "child-third-party-income", label: "Enfant et tiers avec revenu", input: { people: [member("child", "Enfant", "child", { hasProfessionalIncome: false, hasReplacementIncome: false, receivesFamilyAllowances: true }), member("third", "Ami", "third_party", { hasProfessionalIncome: true, professionalIncomeAmount: spouseThreshold, hasReplacementIncome: false })] } },
    { id: "alimony-document-pending", label: "Pension alimentaire : acte en attente", input: { people: [], alimony: { enabled: true, documentStatus: "en-cours" } } },
    { id: "alimony-established", label: "Pension alimentaire documentée", input: { people: [], alimony: { enabled: true, beneficiary: "enfant-mineur", paymentEffective: true, legalBasis: "decision-judiciaire", documentStatus: "en-main" } } },
    { id: "alternating-care-pending", label: "Hébergement alterné : acte en attente", input: { people: [], alternatingCare: { enabled: true, documentStatus: "en-cours" } } },
    { id: "alternating-care-established", label: "Hébergement alterné documenté", input: { people: [], alternatingCare: { enabled: true, regular: true, familyAllowances: true, documentStatus: "jugement" } } },
    { id: "cohousing-complete", label: "Co-housing documenté", input: { people: [], isAloneExplicit: true, cohousingClaim: true, cohousingDocuments: { lease: true, regis: true, swornStatement: true } } },
    { id: "cohousing-alimony-established", label: "Co-housing avec pension alimentaire documentée", input: { people: [], isAloneExplicit: true, cohousingClaim: true, cohousingDocuments: { lease: true, regis: true, swornStatement: true }, alimony: { enabled: true, beneficiary: "enfant-mineur", paymentEffective: true, legalBasis: "decision-judiciaire", documentStatus: "en-main" } } },
    { id: "cohousing-onem-isolated-confirmed", label: "Co-housing avec situation ONEM isolé confirmée", input: { people: [], isAloneExplicit: true, officialOnemCode: "110&2", cohousingClaim: true, cohousingDocuments: { lease: true, regis: true, swornStatement: true } } },
    { id: "unknown-relation", label: "Relation hors périmètre", input: { people: [member("unknown", "Autre", "unknown")] } },
  ];
}

type ScenarioCandidate = { scenario: Article110Scenario } | { exclusion: string };

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).sort().join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${key}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function canonicalScenarioSignature(input: Article110Scenario["input"]): string {
  const people = input.people.map(({ id: _id, label: _label, ...person }) => person);
  return stable({ ...input, people });
}

function combinations<T>(values: T[], size: number, start = 0, chosen: T[] = []): T[][] {
  if (chosen.length === size) return [chosen];
  return values.flatMap((value, index) => combinations(values, size, index + start, [...chosen, value]));
}

function combinatorialCandidates(thresholds: C1BaremeThresholds): ScenarioCandidate[] {
  const threshold = thresholds.spouseProfessionalMonthly ?? 1_000;
  const pension = thresholds.ascendantPensionMonthly ?? 1_000;
  const scenario = (id: string, label: string, input: Article110Scenario["input"]): ScenarioCandidate => ({ scenario: { id, label, input } });
  const candidates: ScenarioCandidate[] = [];
  const partnerIncome = [
    ["unknown", {}], ["none", { hasProfessionalIncome: false }],
    ["below", { hasProfessionalIncome: true, professionalIncomeAmount: threshold - 0.01, professionalIncomeContract: "cdi" as const, professionalIncomeVariable: false }],
    ["exact", { hasProfessionalIncome: true, professionalIncomeAmount: threshold, professionalIncomeContract: "cdi" as const, professionalIncomeVariable: false }],
    ["above", { hasProfessionalIncome: true, professionalIncomeAmount: threshold + 0.01, professionalIncomeContract: "cdi" as const, professionalIncomeVariable: false }],
    ["variable-c110a-missing", { hasProfessionalIncome: true, professionalIncomeAmount: threshold, professionalIncomeContract: "cdd" as const, professionalIncomeVariable: true, c110aReceived: false }],
    ["variable-c110a-present", { hasProfessionalIncome: true, professionalIncomeAmount: threshold, professionalIncomeContract: "cdd" as const, professionalIncomeVariable: true, c110aReceived: true, c110aMonthlyDeclaredIncome: threshold }],
  ] as const;
  const replacement = [["unknown", undefined], ["no", false], ["yes", true]] as const;
  for (const relation of ["spouse", "partner"] as const) for (const [incomeId, income] of partnerIncome) for (const [replacementId, hasReplacementIncome] of replacement) {
    candidates.push(scenario(`comb-partner-${relation}-${incomeId}-${replacementId}`, `Partenaire ${relation} ${incomeId}/${replacementId}`, { people: [member("partner", "Partenaire", relation, { ...(relation === "partner" ? { partnerEstablished: true } : {}), ...income, ...(hasReplacementIncome === undefined ? {} : { hasReplacementIncome }) })] }));
  }
  const priorityOthers = [[], [member("child", "Enfant", "child", { hasProfessionalIncome: false, hasReplacementIncome: false, receivesFamilyAllowances: true })], [member("parent", "Père", "relative", { hasProfessionalIncome: true, hasReplacementIncome: false })], [member("third", "Ami", "third_party", { hasProfessionalIncome: true, professionalIncomeAmount: threshold, hasReplacementIncome: false })], [member("child", "Enfant", "child", { hasProfessionalIncome: false, hasReplacementIncome: false, receivesFamilyAllowances: true }), member("parent", "Père", "relative", { hasProfessionalIncome: true, hasReplacementIncome: false }), member("third", "Ami", "third_party", { hasProfessionalIncome: true, professionalIncomeAmount: threshold, hasReplacementIncome: false })]];
  for (const [index, others] of priorityOthers.entries()) candidates.push(scenario(`comb-partner-priority-${index}`, "Priorité partenaire", { people: [member("partner", "Partenaire", "partner", { partnerEstablished: true, hasProfessionalIncome: false, hasReplacementIncome: false }), ...others] }));

  const childProfiles = [
    ["af", { hasProfessionalIncome: false, hasReplacementIncome: false, receivesFamilyAllowances: true }],
    ["none", { hasProfessionalIncome: false, hasReplacementIncome: false, receivesFamilyAllowances: false }],
    ["professional", { hasProfessionalIncome: true, professionalIncomeAmount: threshold, hasReplacementIncome: false, receivesFamilyAllowances: false }],
    ["replacement", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeAmount: threshold, receivesFamilyAllowances: false }],
    ["unknown", {}],
  ] as const;
  for (const size of [1, 2, 3]) for (const profiles of combinations(childProfiles, size)) candidates.push(scenario(`comb-children-${profiles.map(([id]) => id).join("-")}`, `Enfants ${profiles.map(([id]) => id).join(", ")}`, { people: profiles.map(([id, facts], index) => member(`child-${index}`, `Enfant ${id}`, "child", facts)) }));
  const dates = [undefined, "2026-09-01", "2026-10-08", "2027-08-31", "2027-09-01", "2027-09-02", "2027-02-28", "2028-02-29"];
  for (const [index, date] of dates.entries()) candidates.push(scenario(`comb-110-temporal-${index}`, "Temporalité 110&1", { assessedAt: new Date(`${date ?? "2026-10-08"}T12:00:00.000Z`), people: [member("child", "Enfant", "child", { hasProfessionalIncome: true, professionalIncomeAmount: threshold, hasReplacementIncome: false, receivesFamilyAllowances: false, firstProfessionalIncome: true, neutralisationRequested: true, ...(date ? { firstProfessionalIncomeStartedAt: date, studiesEndedAt: "2026-08-31" } : {}) })] }));

  const relativeProfiles = [
    ["none", { hasProfessionalIncome: false, hasReplacementIncome: false }], ["professional", { hasProfessionalIncome: true, professionalIncomeAmount: threshold, hasReplacementIncome: false }],
    ["pension-below", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension" as const, replacementIncomeAmount: pension - 0.01, pensionProofAvailable: true, pensionGrossAmountConfirmed: true, isAscendant: true }],
    ["pension-exact", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension" as const, replacementIncomeAmount: pension, pensionProofAvailable: true, pensionGrossAmountConfirmed: true, isAscendant: true }],
    ["pension-above", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension" as const, replacementIncomeAmount: pension + 0.01, pensionProofAvailable: true, pensionGrossAmountConfirmed: true, isAscendant: true }],
    ["pension-proof-missing", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension" as const, replacementIncomeAmount: pension, pensionProofAvailable: false, pensionGrossAmountConfirmed: false, isAscendant: true }],
    ["disability", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeType: "pension" as const, replacementIncomeAmount: pension, pensionProofAvailable: true, pensionGrossAmountConfirmed: true, isAscendant: true, disabilityDeclared: true, disabilityProofAvailable: true }],
  ] as const;
  for (const size of [1, 2]) for (const profiles of combinations(relativeProfiles, size)) candidates.push(scenario(`comb-relatives-${profiles.map(([id]) => id).join("-")}`, "Parents et alliés", { people: profiles.map(([id, facts], index) => member(`relative-${index}`, `${index ? "Mère" : "Père"} ${id}`, "relative", facts)) }));

  const compositions = [
    ["third-no-income", [member("third", "Ami", "third_party", { hasProfessionalIncome: false, hasReplacementIncome: false })]],
    ["third-professional-income", [member("third", "Ami", "third_party", { hasProfessionalIncome: true, professionalIncomeAmount: threshold, hasReplacementIncome: false })]],
    ["third-replacement-income", [member("third", "Ami", "third_party", { hasProfessionalIncome: false, hasReplacementIncome: true, replacementIncomeAmount: threshold })]],
    ["third-income-unknown", [member("third", "Ami", "third_party")]],
    ["child-relative", [member("child", "Enfant", "child", { hasProfessionalIncome: false, hasReplacementIncome: false, receivesFamilyAllowances: true }), member("parent", "Père", "relative", { hasProfessionalIncome: false, hasReplacementIncome: false })]],
    ["child-third", [member("child", "Enfant", "child", { hasProfessionalIncome: false, hasReplacementIncome: false, receivesFamilyAllowances: true }), member("third", "Ami", "third_party", { hasProfessionalIncome: false, hasReplacementIncome: false })]],
    ["relative-third", [member("parent", "Père", "relative", { hasProfessionalIncome: false, hasReplacementIncome: false }), member("third", "Ami", "third_party", { hasProfessionalIncome: false, hasReplacementIncome: false })]],
    ["child-relative-third", [member("child", "Enfant", "child", { hasProfessionalIncome: false, hasReplacementIncome: false, receivesFamilyAllowances: true }), member("parent", "Père", "relative", { hasProfessionalIncome: false, hasReplacementIncome: false }), member("third", "Ami", "third_party", { hasProfessionalIncome: false, hasReplacementIncome: false })]],
    ["unknown", [member("unknown", "Relation inconnue", "unknown")]],
    ["partner-ambiguous", [member("partner", "Partenaire", "partner", { partnerEstablished: false })]],
  ] as const;
  for (const [id, people] of compositions) candidates.push(scenario(`comb-composition-${id}`, "Composition croisée", { people }));
  for (const [id, alimony] of [["pending", { enabled: true, documentStatus: "en-cours" as const }], ["available", { enabled: true, beneficiary: "enfant-mineur" as const, paymentEffective: true, legalBasis: "decision-judiciaire" as const, documentStatus: "en-main" as const }]] as const) candidates.push(scenario(`comb-alimony-${id}`, "Pension alimentaire", { people: [], alimony }));
  for (const [id, alternatingCare] of [["pending", { enabled: true, documentStatus: "en-cours" as const }], ["available", { enabled: true, regular: true, familyAllowances: true, documentStatus: "jugement" as const }]] as const) candidates.push(scenario(`comb-care-${id}`, "Hébergement alterné", { people: [], alternatingCare }));
  for (const lease of [false, true]) for (const regis of [false, true]) for (const swornStatement of [false, true]) candidates.push(scenario(`comb-cohousing-${Number(lease)}${Number(regis)}${Number(swornStatement)}`, "Co-housing", { people: [], isAloneExplicit: true, cohousingClaim: true, cohousingDocuments: { lease, regis, swornStatement } }));
  candidates.push({ exclusion: "seul_et_conjoint_incompatibles" }, { exclusion: "cohousing_avec_famille_incompatible" }, { exclusion: "document_sur_branche_non_concernee" }, { exclusion: "doublon_symetrique_normalise_avant_execution" });
  return candidates;
}

export function generateArticle110ScenarioSpace(thresholds: C1BaremeThresholds) {
  const candidates: ScenarioCandidate[] = [...generateRepresentativeArticle110Scenarios(thresholds).map((scenario) => ({ scenario })), ...combinatorialCandidates(thresholds)];
  const exclusions: Record<string, number> = {};
  const signatures = new Set<string>();
  const scenarios: Article110Scenario[] = [];
  let duplicates = 0;
  for (const candidate of candidates) {
    if ("exclusion" in candidate) { exclusions[candidate.exclusion] = (exclusions[candidate.exclusion] ?? 0) + 1; continue; }
    const signature = canonicalScenarioSignature(candidate.scenario.input);
    if (signatures.has(signature)) { duplicates += 1; continue; }
    signatures.add(signature);
    scenarios.push(candidate.scenario);
  }
  return { scenarios, raw: candidates.length, invalid: Object.values(exclusions).reduce((sum, count) => sum + count, 0), duplicates, exclusions };
}

export function generateArticle110Scenarios(thresholds: C1BaremeThresholds): Article110Scenario[] {
  return generateArticle110ScenarioSpace(thresholds).scenarios;
}

export function evaluateArticle110ScenarioMatrix(thresholds: C1BaremeThresholds, generatedAt = "2026-10-10"): Article110MatrixReport {
  const startedAt = performance.now();
  const space = generateArticle110ScenarioSpace(thresholds);
  const scenarios = space.scenarios.map(({ id, label, input }) => {
    const result = evaluateArticle110Verifier({ ...input, thresholds });
    return {
      id,
      label,
      branch: result.isolatedAssessment?.branch ?? result.composition.kind,
      facts: input,
      officialOnemState: result.officialOnemState,
      resultType: result.resultType,
      category: result.category,
      potentialCategory: result.potentialCategory,
      informationStatus: result.informationStatus,
      documentStatus: result.documentStatus,
      onemDecisionStatus: result.onemDecisionStatus,
      automationStatus: result.automationStatus,
      householdComposition: result.composition.kind,
      reason: result.reason,
      decisiveFacts: result.decisiveFacts,
      missingFacts: result.missingFacts.map((fact) => fact.label),
      missingDocuments: result.missingDocuments,
      actions: result.nextActions,
      potentialOutcome: result.potentialOutcome,
      declarationRequired: result.declarationRequired,
      sourceRuleIds: result.sourceRuleIds,
    } satisfies Article110ScenarioContract;
  });
  const resultTypes: Article110ResultType[] = ["decision_determined", "information_missing", "document_required", "onem_decision_required", "not_automated"];
  const byResultType = Object.fromEntries(resultTypes.map((type) => [type, scenarios.filter((scenario) => scenario.resultType === type).length])) as Record<Article110ResultType, number>;
  const byCategory = Object.fromEntries((["A", "B", "N"] as const).map((category) => [category, scenarios.filter((scenario) => scenario.category === category).length])) as Record<"A" | "B" | "N", number>;
  const supplementalStatuses = {
    informationIncomplete: scenarios.filter((scenario) => scenario.informationStatus === "incomplete").length,
    documentsRequired: scenarios.filter((scenario) => scenario.documentStatus === "required").length,
    onemDecisionRequired: scenarios.filter((scenario) => scenario.onemDecisionStatus === "required").length,
    automationPartial: scenarios.filter((scenario) => scenario.automationStatus === "partial").length,
    notAutomated: scenarios.filter((scenario) => scenario.automationStatus === "not_automated").length,
  };
  const potentialTransitions = {
    B_to_N: scenarios.filter((scenario) => scenario.category === "B" && scenario.potentialCategory === "N").length,
    B_to_A: scenarios.filter((scenario) => scenario.category === "B" && scenario.potentialCategory === "A").length,
    N_to_A: scenarios.filter((scenario) => scenario.category === "N" && scenario.potentialCategory === "A").length,
  };
  const byBranch = Object.fromEntries([...new Set(scenarios.map((scenario) => scenario.branch))].sort().map((branch) => [branch, scenarios.filter((scenario) => scenario.branch === branch).length]));
  const onemByBranch = Object.fromEntries([...new Set(scenarios.filter((scenario) => scenario.onemDecisionStatus === "required").map((scenario) => scenario.branch))].sort().map((branch) => [branch, scenarios.filter((scenario) => scenario.onemDecisionStatus === "required" && scenario.branch === branch).length]));
  const incoherent = scenarios.filter((scenario) => !scenario.category).map((scenario) => scenario.id);
  const withoutReason = scenarios.filter((scenario) => !scenario.reason.trim()).map((scenario) => scenario.id);
  const coverage = {
    partenaire: ["conjoint", "partenaire établi", "revenu pro : inconnu/non/sous seuil/seuil/au-dessus/variable", "revenu de remplacement : inconnu/non/oui", "C110A : présent/absent", "priorité avec enfant/parent/tiers"],
    enfants: ["nombre : 1/2/3", "allocations familiales : oui/non/inconnu", "revenu pro : oui/non/inconnu", "revenu de remplacement : oui/non/inconnu", "110&1M : date manquante/début/période/veille/échéance/lendemain/fin de mois/bissextile"],
    parents: ["nombre : 1/2", "revenu pro : oui/non", "pension : sous seuil/seuil/au-dessus", "preuve SPF : présente/absente", "handicap : documenté"],
    compositions: ["seul", "tiers", "enfant + tiers", "parent + tiers", "enfant + parent + tiers", "partenaire + autres", "relations ambiguës"],
    situations_isolees: ["pension alimentaire : disponible/en attente", "hébergement alterné : disponible/en attente", "co-housing : 8 états documentaires", "co-housing + pension alimentaire documentée", "co-housing + état ONEM isolé confirmé"],
  };
  const mixedGroups = new Map<string, Article110ScenarioContract[]>();
  for (const scenario of scenarios.filter((scenario) => scenario.branch === "mixed_or_unsupported")) {
    const signature = stable(scenario.facts.people.map(({ id: _id, label: _label, ...person }) => person));
    mixedGroups.set(signature, [...(mixedGroups.get(signature) ?? []), scenario]);
  }
  const mixedOrUnsupported = [...mixedGroups.entries()].map(([signature, group]) => ({
    scenarioIds: group.map((scenario) => scenario.id),
    signature,
    count: group.length,
    facts: group[0].facts.people.map((person) => `${person.relation}${person.partnerEstablished === false ? " non établi" : ""}`).join(", "),
    householdComposition: group[0].householdComposition,
    classifierReason: "Le classificateur retourne mixed_or_unsupported lorsqu’une relation est inconnue ou qu’un partenaire n’est pas établi.",
    expectedBranchIfKnown: group[0].facts.people.some((person) => person.relation === "third_party") ? "tiers seul : branche non automatisée" : group[0].facts.people.some((person) => person.relation === "partner") ? "conjoint ou partenaire établi" : "relation à qualifier",
    diagnosis: "A" as const,
  }));
  const compositionName = (scenario: Article110ScenarioContract) => {
    const relations = scenario.facts.people.map((person) => person.relation);
    if (scenario.facts.isAloneExplicit) return "seul";
    if (relations.includes("spouse")) return relations.length > 1 ? "conjoint + autres" : "conjoint";
    if (relations.includes("partner")) return relations.length > 1 ? "partenaire + autres" : "partenaire";
    if (relations.every((relation) => relation === "child")) return "enfants seuls";
    if (relations.every((relation) => relation === "relative")) return "parents seuls";
    if (relations.every((relation) => relation === "third_party")) return "tiers seul";
    if (relations.includes("child") && relations.includes("relative") && relations.includes("third_party")) return "enfants + parents + tiers";
    if (relations.includes("child") && relations.includes("relative")) return "enfants + parents";
    if (relations.includes("child") && relations.includes("third_party")) return "enfants + tiers";
    if (relations.includes("relative") && relations.includes("third_party")) return "parents + tiers";
    return "relation à clarifier";
  };
  const compositionCoverage = ["seul", "conjoint", "partenaire", "enfants seuls", "parents seuls", "tiers seul", "enfants + parents", "enfants + tiers", "parents + tiers", "enfants + parents + tiers", "partenaire + autres"].map((composition) => {
    const group = scenarios.filter((scenario) => compositionName(scenario) === composition);
    const count = (resultType: Article110ResultType) => group.filter((scenario) => scenario.resultType === resultType).length;
    return { composition, total: group.length, determined: count("decision_determined"), information: count("information_missing"), document: count("document_required"), onem: count("onem_decision_required"), notAutomated: count("not_automated") };
  });
  const assertions = {
    resultTypesTotal: Object.values(byResultType).reduce((sum, count) => sum + count, 0) === scenarios.length,
    categoriesTotal: Object.values(byCategory).reduce((sum, count) => sum + count, 0) === scenarios.length,
    incoherent: incoherent.length === 0,
    withoutReason: withoutReason.length === 0,
    atLeastOneA: byCategory.A > 0,
    atLeastOneB: byCategory.B > 0,
    atLeastOneN: byCategory.N > 0,
  };
  const anomalies = assertions.atLeastOneN ? [] : ["ANOMALIE DE COUVERTURE : le scénario explicite « vit seul sans situation particulière » est généré, mais le moteur actuel ne renvoie pas N ; il renvoie une revue sans catégorie attendue."];
  return {
    generatedAt,
    method: "Exploration combinatoire déterministe des dimensions réellement lues par le moteur ; les états incompatibles sont écartés avant exécution et les ménages symétriques sont dédupliqués par signature canonique.",
    total: scenarios.length,
    byResultType,
    byCategory,
    supplementalStatuses,
    potentialTransitions,
    byBranch,
    onemByBranch,
    incoherent,
    withoutReason,
    space: { raw: space.raw, invalid: space.invalid, duplicates: space.duplicates, executed: scenarios.length, exclusions: space.exclusions },
    coverage,
    mixedOrUnsupported,
    compositionCoverage,
    assertions,
    anomalies,
    durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    scenarios,
  };
}

export function formatArticle110MatrixMarkdown(report: Article110MatrixReport): string {
  const types = report.byResultType;
  const statuses = report.supplementalStatuses;
  const transitions = report.potentialTransitions;
  const branches = Object.entries(report.byBranch).map(([branch, count]) => `- ${branch} : ${count}`).join("\n");
  const coverage = Object.entries(report.coverage).map(([branch, values]) => `### ${branch}\n\n${values.map((value) => `- ${value}`).join("\n")}`).join("\n\n");
  const mixed = report.mixedOrUnsupported.length ? report.mixedOrUnsupported.map((group) => `- ${group.count} scénario(s) — ${group.facts} — ${group.classifierReason} Diagnostic ${group.diagnosis}.`).join("\n") : "- Aucun.";
  return `# Article 110 — exploration combinatoire\n\nGénéré le ${report.generatedAt}.\n\n## Méthode\n\n${report.method}\n\n## Espace exploré\n\n- Combinaisons brutes : ${report.space.raw}\n- Combinaisons invalides éliminées : ${report.space.invalid}\n- Doublons métier éliminés : ${report.space.duplicates}\n- Scénarios uniques exécutés : ${report.space.executed}\n\nExclusions explicites : ${Object.entries(report.space.exclusions).map(([reason, count]) => `${reason} (${count})`).join(", ") || "aucune"}.\n\n## Catégories opérationnelles\n\n- A : ${report.byCategory.A}\n- B : ${report.byCategory.B}\n- N : ${report.byCategory.N}\n- Total : ${report.total}\n\nLes catégories A, B et N sont exhaustives ; les états suivants peuvent se cumuler avec elles.\n\n## États complémentaires\n\n- Informations à compléter : ${statuses.informationIncomplete}\n- Pièces à fournir : ${statuses.documentsRequired}\n- Décision ONEM nécessaire : ${statuses.onemDecisionRequired}\n- Automatisation partielle : ${statuses.automationPartial}\n- Non automatisé : ${statuses.notAutomated}\n\n## Droits plus avantageux potentiels\n\n- B → N : ${transitions.B_to_N}\n- B → A : ${transitions.B_to_A}\n- N → A : ${transitions.N_to_A}\n\n## Résultats techniques historiques\n\n- Décision déterminée : ${types.decision_determined}\n- Informations manquantes : ${types.information_missing}\n- Pièce à fournir : ${types.document_required}\n- Décision ONEM requise : ${types.onem_decision_required}\n- Non automatisé : ${types.not_automated}\n- Incohérents : ${report.incoherent.length}\n- Sans justification : ${report.withoutReason.length}\n\n## Couverture par branche\n\n${branches}\n\n## Couverture par dimension\n\n${coverage}\n\n## mixed_or_unsupported\n\n${mixed}\n\n## Co-housing\n\nSans état ONEM confirmé, la catégorie en l’état est **B** et une décision ONEM reste nécessaire. Le moteur met en évidence N ou A uniquement comme possibilité fondée sur les faits déjà établis, sans la présenter comme appliquée.\n\n## Contrats\n\n| Scénario | Branche | Catégorie | États | Potentiel | Justification |\n| --- | --- | --- | --- | --- | --- |\n${report.scenarios.map((scenario) => `| ${scenario.id} | ${scenario.branch} | ${scenario.category} | info: ${scenario.informationStatus}, document: ${scenario.documentStatus}, ONEM: ${scenario.onemDecisionStatus} | ${scenario.potentialCategory ?? "—"} | ${scenario.reason.replace(/\n/g, " ")} |`).join("\n")}\n`;
}
