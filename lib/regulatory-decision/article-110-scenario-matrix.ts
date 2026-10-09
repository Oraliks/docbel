import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";

import { evaluateArticle110Verifier, type Article110ResultType, type Article110VerifierInput } from "./article-110-verifier";

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
  category: "A" | "B" | "N" | null;
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
  byBranch: Record<string, number>;
  incoherent: string[];
  withoutReason: string[];
  scenarios: Article110ScenarioContract[];
};

const member = (id: string, label: string, relation: Article110VerifierInput["people"][number]["relation"], facts: Partial<Article110VerifierInput["people"][number]> = {}) => ({ id, label, relation, ...facts });

/**
 * Meaningful equivalence classes, deliberately not a cartesian product. Each
 * scenario maps to a branch, a boundary, a document state, or a temporal state
 * already understood by the Article 110 evaluator.
 */
export function generateArticle110Scenarios(thresholds: C1BaremeThresholds): Article110Scenario[] {
  const spouseThreshold = thresholds.spouseProfessionalMonthly ?? 1_000;
  const pensionThreshold = thresholds.ascendantPensionMonthly ?? 1_000;
  const at = (date: string) => new Date(`${date}T12:00:00.000Z`);
  return [
    { id: "composition-missing", label: "Composition non renseignée", input: { people: [] } },
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
    { id: "unknown-relation", label: "Relation hors périmètre", input: { people: [member("unknown", "Autre", "unknown")] } },
  ];
}

export function evaluateArticle110ScenarioMatrix(thresholds: C1BaremeThresholds, generatedAt = "2026-10-10"): Article110MatrixReport {
  const scenarios = generateArticle110Scenarios(thresholds).map(({ id, label, input }) => {
    const result = evaluateArticle110Verifier({ ...input, thresholds });
    return {
      id,
      label,
      branch: result.isolatedAssessment?.branch ?? result.composition.kind,
      facts: input,
      officialOnemState: result.officialOnemState,
      resultType: result.resultType,
      category: result.expectedCategory,
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
  const byBranch = Object.fromEntries([...new Set(scenarios.map((scenario) => scenario.branch))].sort().map((branch) => [branch, scenarios.filter((scenario) => scenario.branch === branch).length]));
  const incoherent = scenarios.filter((scenario) => scenario.resultType === "decision_determined" && scenario.category === null).map((scenario) => scenario.id);
  const withoutReason = scenarios.filter((scenario) => !scenario.reason.trim()).map((scenario) => scenario.id);
  return {
    generatedAt,
    method: "Classes d’équivalence des branches, seuils réels fournis au moteur, états documentaires et dates 110&1M/110&1V ; aucune combinaison cartésienne.",
    total: scenarios.length,
    byResultType,
    byBranch,
    incoherent,
    withoutReason,
    scenarios,
  };
}

export function formatArticle110MatrixMarkdown(report: Article110MatrixReport): string {
  const types = report.byResultType;
  const branches = Object.entries(report.byBranch).map(([branch, count]) => `- ${branch} : ${count}`).join("\n");
  return `# Article 110 — matrice exhaustive de scénarios\n\nGénéré le ${report.generatedAt}.\n\n## Méthode\n\n${report.method}\n\n## Résultats\n\n- Scénarios : ${report.total}\n- Décision déterminée : ${types.decision_determined}\n- Informations manquantes : ${types.information_missing}\n- Pièce à fournir : ${types.document_required}\n- Décision ONEM requise : ${types.onem_decision_required}\n- Non automatisé : ${types.not_automated}\n- Incohérents : ${report.incoherent.length}\n- Sans justification : ${report.withoutReason.length}\n\n## Couverture par branche\n\n${branches}\n\n## Co-housing\n\nÉtat : **Décision ONEM requise**. Le Bureau du chômage peut effectuer une enquête sur la situation réelle avant de décider si le chômeur peut être considéré comme isolé.\n\n## Trous du moteur\n\n- Les compositions mixed_or_unsupported restent explicitement non automatisées ; aucune catégorie n’est devinée.\n- Les catégories issues d’une appréciation de fait (dont le co-housing) restent soumises à la décision ONEM.\n\n## Contrats\n\n| Scénario | Branche | Résultat | Catégorie | Justification |\n| --- | --- | --- | --- | --- |\n${report.scenarios.map((scenario) => `| ${scenario.id} | ${scenario.branch} | ${scenario.resultType} | ${scenario.category ?? "—"} | ${scenario.reason.replace(/\n/g, " ")} |`).join("\n")}\n`;
}
