import type { FieldValueRecord, FormPayload } from "@/lib/pdf-forms/types";
import {
  decideArticle110ChildFirstProfessionalIncome,
  activeFirstProfessionalIncomePersonIds,
  preserveArticle110TemporalHistory,
} from "./article-110-child-income";
import {
  evaluateFamilySituation,
  householdCompositionFromFamilyFacts,
  type FamilyFacts,
  type FamilyIncome,
  type FamilyPerson,
} from "./household-composition";
import type { RegulatoryDecision, RegulatoryFacts } from "./types";
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

const RELATION_BY_C1_VALUE: Record<string, FamilyPerson["relation"]> = {
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

function stableC1PersonId(person: Record<string, unknown>, relation: FamilyPerson["relation"], index: number): string {
  for (const key of ["id", "personId", "niss"]) {
    const value = person[key];
    if (typeof value === "string" && value.trim()) return `c1:${key}:${value.trim()}`;
  }
  const name = [person.prenom, person.nom, person.dateNaissance]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase())
    .join("|");
  return name ? `c1:person:${relation}:${name}` : `c1:row:${index}:${relation}`;
}

/** Per-income declarations for traces; global inventory completeness stays in the evaluator. */
function c1IncomePresence(value: unknown): boolean | undefined {
  const answer = typeof value === "string" ? value.trim() : "";
  return answer ? answer !== "aucun" : undefined;
}

function c1PeopleById(payload: FormPayload): Map<string, FieldValueRecord> {
  const people = new Map<string, FieldValueRecord>();
  if (!Array.isArray(payload.cohabitants)) return people;
  payload.cohabitants.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const person = entry;
    const relation = RELATION_BY_C1_VALUE[typeof person.lien === "string" ? person.lien : ""] ?? "unknown";
    people.set(stableC1PersonId(person, relation, index), person);
  });
  return people;
}

/** C1 adapter: maps declarations to the common family contract, never to a category. */
export function deriveFamilyFactsFromC1(payload: FormPayload, asOf = new Date().toISOString().slice(0, 10)): FamilyFacts {
  const explicitlyAlone = text(payload, "statutFamilial") === "isole";
  const cohabitants = Array.isArray(payload.cohabitants) ? payload.cohabitants : [];
  return {
    asOf,
    people: cohabitants.flatMap<FamilyPerson>((entry, index): FamilyPerson[] => {
      if (!entry || typeof entry !== "object") return [{ id: `c1:row:${index}:unknown`, relation: "unknown" as const, incomeInventoryComplete: false }];
      const person = entry as Record<string, unknown>;
      const relation = RELATION_BY_C1_VALUE[typeof person.lien === "string" ? person.lien : ""] ?? "unknown";
      const professionalAnswer = typeof person.typeRevenuPro === "string" ? person.typeRevenuPro.trim() || undefined : undefined;
      const replacementAnswer = typeof person.revenuRemplacement === "string" ? person.revenuRemplacement.trim() || undefined : undefined;
      const professional = professionalAnswer !== undefined && professionalAnswer !== "aucun";
      const replacement = replacementAnswer !== undefined && replacementAnswer !== "aucun";
      const replacementType = replacementAnswer;
      const incomeAmount = typeof person.montantRevenuPro === "number" ? person.montantRevenuPro : undefined;
      const replacementAmount = typeof person.montantRevenuRemplacement === "number" ? person.montantRevenuRemplacement : undefined;
      const professionalContract: FamilyIncome["contract"] = person.typeContratRevenuPro === "cdi" || person.typeContratRevenuPro === "cdd"
        ? person.typeContratRevenuPro
        : person.typeRevenuPro === "independant" ? "independent" : "other";
      const incomes: FamilyIncome[] = [
        ...(professional ? [{ kind: "professional" as const, active: true, amount: incomeAmount, monthlyAmount: typeof person.montantMensuelC110a === "number" ? person.montantMensuelC110a : undefined, contract: professionalContract, variable: person.revenuProfessionnelVariable === "oui" ? true : person.revenuProfessionnelVariable === "non" ? false : undefined, firstProfessionalIncome: person.premierRevenuProfessionnel === "oui", neutralisationRequested: person.demandeNeutralisationPremierRevenu === "oui", startedAt: typeof person.dateDebutPremiereActivite === "string" ? person.dateDebutPremiereActivite : undefined, studiesEndedAt: typeof person.dateFinEtudes === "string" ? person.dateFinEtudes : undefined }] : []),
        ...(replacementType === "allocation-handicap" ? [{ kind: "spf_disability" as const, active: true }] : []),
        ...(replacementType === "pension" ? [{ kind: "pension" as const, active: true, amount: replacementAmount, amountKind: person.montantPensionNature === "brut" ? "gross" as const : person.montantPensionNature === "net" ? "net" as const : undefined }] : []),
        ...(replacement && replacementType !== "pension" && replacementType !== "allocation-handicap" ? [{ kind: "replacement" as const, active: true, amount: replacementAmount }] : []),
      ];
      return [{
        id: stableC1PersonId(person, relation, index),
        relation,
        ...(relation === "partner" ? { partnerEstablished: person.partenaireConditionsEtablies === "oui" } : {}),
        ...(person.allocationsFamiliales === "oui" || person.allocationsFamiliales === "non" ? { receivesFamilyAllowances: person.allocationsFamiliales === "oui" } : {}),
        ...(person.handicapReconnu === "oui" || person.handicapReconnu === "non" ? { disabilityRelevant: person.handicapReconnu === "oui" } : {}),
        ...(person.lien === "pere" || person.lien === "mere" ? { isAscendant: true } : {}),
        // C1 hides the replacement axis once a professional income is selected.
        // That selected income completes the visible inventory even though the
        // hidden replacement answer is removed. With no professional income,
        // the explicit replacement answer (including "aucun") is still needed.
        incomeInventoryComplete: professionalAnswer !== undefined &&
          (professional || replacementAnswer !== undefined),
        incomes,
      }];
    }),
    // An absent or empty inventory cannot establish an isolated household.
    ...(!explicitlyAlone ? { householdDeclared: true } : {}),
    ...(explicitlyAlone ? {
      isolated: {
        ...(text(payload, "pensionAlimentaire") === "oui" ? {
          alimony: {
            paid: text(payload, "pensionAlimentairePaiementEffectif") === "oui" ? true : text(payload, "pensionAlimentairePaiementEffectif") === "non" ? false : undefined,
            admissibleBasis: ["decision-judiciaire", "acte-notarie-divorce", "acte-notarie-enfant"].includes(text(payload, "pensionAlimentaireBaseJuridique") ?? "") || undefined,
            beneficiary: text(payload, "pensionAlimentaireBeneficiaire") === "enfant-mineur" ? "minor_child" : text(payload, "pensionAlimentaireBeneficiaire") === "enfant-majeur" ? "adult_child" : text(payload, "pensionAlimentaireBeneficiaire") ? "other" : undefined,
            adultChildInNeed: text(payload, "pensionAlimentaireEnfantMajeurBesoin") === "oui" ? true : text(payload, "pensionAlimentaireEnfantMajeurBesoin") === "non" ? false : undefined,
          },
        } : {}),
        ...(text(payload, "hebergementAlterneEnfant") === "oui" ? {
          alternatingCare: {
            averageDaysPerWeek: typeof payload.hebergementAlterneJoursMoyensSemaine === "number" ? payload.hebergementAlterneJoursMoyensSemaine : undefined,
            cycle: text(payload, "hebergementAlterneCycle") === "mensuel" ? "monthly" : text(payload, "hebergementAlterneCycle") === "trimestriel" ? "quarterly" : text(payload, "hebergementAlterneCycle") === "semestriel" ? "semiannual" : text(payload, "hebergementAlterneCycle") === "annuel" ? "annual" : undefined,
            familyAllowances: text(payload, "hebergementAlterneAllocationsFamiliales") === "oui" ? true : text(payload, "hebergementAlterneAllocationsFamiliales") === "non" ? false : undefined,
            childHasRelevantIncome: text(payload, "hebergementAlterneEnfantRevenuPertinent") === "oui" ? true : text(payload, "hebergementAlterneEnfantRevenuPertinent") === "non" ? false : undefined,
          },
        } : {}),
      },
    } : {}),
  };
}

/** Compatibility reader for traces: category-relevant C1 data has one mapping only. */
export function deriveHouseholdCompositionFromC1(payload: FormPayload) {
  return householdCompositionFromFamilyFacts(deriveFamilyFactsFromC1(payload));
}

type ChildIncomeExpiry = NonNullable<RegulatoryDecision["reportedChildIncomeExpiries"]>[number];

function childIncomeExpiryKey(expiry: ChildIncomeExpiry) {
  return JSON.stringify([expiry.factKey, expiry.periodStartedAt, expiry.reassessmentAt]);
}

function establishedChildIncomeExpiry(factKey: string, temporalFacts: RegulatoryFacts, now: Date): ChildIncomeExpiry | undefined {
  const current = decideArticle110ChildFirstProfessionalIncome(temporalFacts, now).temporalEffect;
  if (current?.onemCode !== "110&1V" || !current.reassessmentAt) return undefined;
  const occupationStartedAt = temporalFacts["family.child.firstProfessionalIncomeStartedAt"]?.value;
  if (typeof occupationStartedAt !== "object" || occupationStartedAt.kind !== "date") return undefined;
  // Reuse the existing decision at occupation start to obtain the canonical
  // period start, including occupations begun before the end of studies.
  const initial = decideArticle110ChildFirstProfessionalIncome(temporalFacts, new Date(`${occupationStartedAt.value}T00:00:00Z`)).temporalEffect;
  if (initial?.onemCode !== "110&1M") return undefined;
  return { factKey, periodStartedAt: initial.effectiveFrom, reassessmentAt: current.reassessmentAt };
}

function deriveChildIncomeExpiryEvents(payload: FormPayload, previous: ChildIncomeExpiry[], now: Date) {
  const history = [...previous];
  const reported = new Set(history.map(childIncomeExpiryKey));
  const newlyExpired = new Map<string, ChildIncomeExpiry>();
  for (const [factKey, declaration] of c1PeopleById(payload)) {
    const temporalFacts = deriveArticle110FactsFromC1({ cohabitants: [declaration] });
    if (!temporalFacts) continue;
    const expiry = establishedChildIncomeExpiry(factKey, temporalFacts, now);
    if (!expiry || reported.has(childIncomeExpiryKey(expiry))) continue;
    reported.add(childIncomeExpiryKey(expiry));
    history.push(expiry);
    newlyExpired.set(factKey, expiry);
  }
  return { history, newlyExpired };
}

function deriveChildrenOnlyAssessmentUpdate(
  previous: RegulatoryDecision["childrenOnlyAssessment"] | undefined,
  previouslyReportedExpiries: ChildIncomeExpiry[],
  composition: ReturnType<typeof deriveHouseholdCompositionFromC1>,
  householdAssessment: ReturnType<typeof evaluateFamilySituation>,
  payload: FormPayload,
  neutralisedChildFactKeys: string[],
  now: Date,
): { assessment?: RegulatoryDecision["childrenOnlyAssessment"]; reportedExpiries: ChildIncomeExpiry[] } {
  if (composition.kind !== "children_only") return { reportedExpiries: previouslyReportedExpiries };
  const expiries = deriveChildIncomeExpiryEvents(payload, previouslyReportedExpiries, now);
  const expectedCategory = householdAssessment.expectedCategory === "A" || householdAssessment.expectedCategory === "B" ? householdAssessment.expectedCategory : null;
  const declarations = c1PeopleById(payload);
  const facts = composition.members.map((member) => ({
    factKey: member.factKey,
    receivesFamilyAllowances: member.receivesFamilyAllowances,
    hasProfessionalIncome: c1IncomePresence(declarations.get(member.factKey)?.typeRevenuPro),
    hasReplacementIncome: c1IncomePresence(declarations.get(member.factKey)?.revenuRemplacement),
    firstProfessionalIncome: declarations.get(member.factKey)?.premierRevenuProfessionnel === "oui" ? true : declarations.get(member.factKey)?.premierRevenuProfessionnel === "non" ? false : undefined,
    studiesEndedAt: member.studiesEndedAt,
    neutralisedBy110_1M: neutralisedChildFactKeys.includes(member.factKey) || undefined,
  }));
  const before = new Map((previous?.facts ?? []).map((fact) => [fact.factKey, fact]));
  const after = new Map(facts.map((fact) => [fact.factKey, fact]));
  const changes: NonNullable<RegulatoryDecision["childrenOnlyAssessment"]>["changes"] = [];
  const effectiveDate = text(payload, "dateModificationSituationFamilialeEffective") ?? text(payload, "dateModificationEffective");
  for (const [factKey, current] of after) {
    const prior = before.get(factKey);
    const expiry = expiries.newlyExpired.get(factKey);
    if (expiry) changes.push({ reason: "CHILD_110_1M_ENDED", factKey, ...(prior ? { previous: prior } : {}), current: { ...current, periodStartedAt: expiry.periodStartedAt, reassessmentAt: expiry.reassessmentAt }, effectiveDate });
    if (!prior) continue;
    if (prior.hasProfessionalIncome !== true && current.hasProfessionalIncome === true) changes.push({ reason: "CHILD_STARTED_WORK", factKey, previous: prior, current, effectiveDate });
    if (prior.hasProfessionalIncome === true && current.hasProfessionalIncome === false) changes.push({ reason: "CHILD_STOPPED_WORK", factKey, previous: prior, current, effectiveDate });
    if (prior.receivesFamilyAllowances === true && current.receivesFamilyAllowances === false) changes.push({ reason: "CHILD_LOST_FAMILY_ALLOWANCE", factKey, previous: prior, current, effectiveDate });
    if (prior.receivesFamilyAllowances !== true && current.receivesFamilyAllowances === true) changes.push({ reason: "CHILD_GAINED_FAMILY_ALLOWANCE", factKey, previous: prior, current, effectiveDate });
    if (prior.hasReplacementIncome !== current.hasReplacementIncome) changes.push({ reason: "INCOME_CHANGED", factKey, previous: prior, current, effectiveDate });
    if (prior.studiesEndedAt !== current.studiesEndedAt && current.studiesEndedAt) changes.push({ reason: "CHILD_STUDIES_ENDED", factKey, previous: prior, current, effectiveDate: current.studiesEndedAt });
  }
  if (previous) {
    for (const [factKey, prior] of before) if (!after.has(factKey)) changes.push({ reason: "HOUSEHOLD_MEMBER_CHANGED", factKey, previous: prior, effectiveDate });
    for (const [factKey, current] of after) if (!before.has(factKey)) changes.push({ reason: "HOUSEHOLD_MEMBER_CHANGED", factKey, current, effectiveDate });
  }
  return {
    reportedExpiries: expiries.history,
    assessment: {
      expectedCategory,
      categoryChanged: previous ? previous.expectedCategory !== expectedCategory : false,
      declarationRequired: changes.length > 0,
      facts,
      changes,
      sourceRuleIds: ["situation_familiale_children_only"],
    },
  };
}

function deriveRelativeHouseholdAssessment(
  previous: RegulatoryDecision["relativeHouseholdAssessment"] | undefined,
  composition: ReturnType<typeof deriveHouseholdCompositionFromC1>,
  householdAssessment: ReturnType<typeof evaluateFamilySituation>,
  payload: FormPayload,
  familyFacts: FamilyFacts,
): RegulatoryDecision["relativeHouseholdAssessment"] | undefined {
  if (composition.kind !== "relatives_only" && composition.kind !== "children_and_relatives") return undefined;
  const expectedCategory = householdAssessment.expectedCategory === "A" || householdAssessment.expectedCategory === "B" ? householdAssessment.expectedCategory : null;
  const declarations = c1PeopleById(payload);
  const facts = composition.members.filter((member) => member.relation === "relative").map((member) => ({
    factKey: member.factKey,
    professional: c1IncomePresence(declarations.get(member.factKey)?.typeRevenuPro),
    replacementType: member.replacementIncomeType,
    // Keep the declared amount: the compact composition can aggregate a missing
    // pension amount to zero, which is not evidence of a changed amount.
    pensionGrossAmount: familyFacts.people.find((person) => person.id === member.factKey)?.incomes?.find((income) => income.kind === "pension")?.amount,
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
    const replacementKnownAbsent = c1IncomePresence(declarations.get(current.factKey)?.revenuRemplacement) === false;
    if (prior.replacementType === "pension" && (replacementKnownAbsent || (current.replacementType !== undefined && current.replacementType !== "pension"))) changes.push({ reason: "PENSION_STOPPED", factKey: current.factKey, previous: prior, current, effectiveDate });
    if (Number.isFinite(prior.pensionGrossAmount) && Number.isFinite(current.pensionGrossAmount) && prior.pensionGrossAmount !== current.pensionGrossAmount) changes.push({ reason: "PENSION_AMOUNT_CHANGED", factKey: current.factKey, previous: prior, current, effectiveDate });
    if (prior.replacementType !== current.replacementType || prior.professional !== current.professional) changes.push({ reason: "INCOME_CHANGED", factKey: current.factKey, previous: prior, current, effectiveDate });
    if (prior.disabilityProof !== current.disabilityProof) changes.push({ reason: "DISABILITY_PROOF_CHANGED", factKey: current.factKey, previous: prior, current, effectiveDate });
  }
  if (previous) {
    const afterKeys = new Set(facts.map((fact) => fact.factKey));
    for (const [factKey, prior] of before) if (!afterKeys.has(factKey)) changes.push({ reason: "HOUSEHOLD_MEMBER_CHANGED", factKey, previous: prior, effectiveDate });
    for (const current of facts) if (!before.has(current.factKey)) changes.push({ reason: "HOUSEHOLD_MEMBER_CHANGED", factKey: current.factKey, current, effectiveDate });
  }
  return { composition: composition.kind, expectedCategory, categoryChanged: previous ? previous.expectedCategory !== expectedCategory : false, declarationRequired: changes.length > 0, facts, changes, sourceRuleIds: ["situation_familiale_ascendants_pensions"] };
}

function deriveThirdPartyHouseholdAssessment(
  previous: RegulatoryDecision["thirdPartyHouseholdAssessment"] | undefined,
  previousComposition: RegulatoryDecision["householdAssessment"] | undefined,
  composition: ReturnType<typeof deriveHouseholdCompositionFromC1>,
  householdAssessment: ReturnType<typeof evaluateFamilySituation>,
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
    expectedCategory: supported && (householdAssessment.expectedCategory === "A" || householdAssessment.expectedCategory === "B") ? householdAssessment.expectedCategory : null,
    categoryChanged: previous ? previous.expectedCategory !== (supported && (householdAssessment.expectedCategory === "A" || householdAssessment.expectedCategory === "B") ? householdAssessment.expectedCategory : null) : false,
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
  // Bundle document completion is intentionally outside the theoretical family result.
  void options;
  const {
    isolatedHouseholdAssessment: legacyIsolatedAssessment,
    isolatedHouseholdAssessmentHistory: legacyIsolatedHistory,
    // Recompute current derived assessments instead of retaining an older conclusion
    // when the category is unresolved or the household has changed branch.
    childrenOnlyAssessment: previousChildrenAssessment,
    relativeHouseholdAssessment: previousRelativeAssessment,
    thirdPartyHouseholdAssessment: previousThirdPartyAssessment,
    ...currentDecision
  } = decision;
  const article110Facts = deriveArticle110FactsFromC1(payload);
  const article110Decision = article110Facts
    ? preserveArticle110TemporalHistory(
        decision.article110Decision,
        decideArticle110ChildFirstProfessionalIncome(article110Facts, now),
      )
    : undefined;
  const familyFacts = deriveFamilyFactsFromC1(payload, now.toISOString().slice(0, 10));
  const composition = deriveHouseholdCompositionFromC1(payload);
  const neutralisedChildFactKeys = activeFirstProfessionalIncomePersonIds(familyFacts.people, familyFacts.asOf);
  const householdAssessment = evaluateFamilySituation({
    facts: familyFacts,
    activeChildIncomeNeutralisation: neutralisedChildFactKeys.length > 0,
    spouseProfessionalMonthlyThreshold: thresholds?.spouseProfessionalMonthly,
    // null means unavailable; undefined would enable the engine's legacy fallback.
    childProfessionalMonthlyThreshold: thresholds?.childProfessionalMonthly ?? null,
    childReplacementMonthlyThreshold: thresholds?.childReplacementMonthly ?? null,
    ascendantPensionWithChildMonthlyThreshold: thresholds?.ascendantPensionWithChildMonthly,
    ascendantPensionMonthlyThreshold: thresholds?.ascendantPensionMonthly,
    ascendantDisabledPensionMonthlyThreshold: thresholds?.ascendantDisabledPensionMonthly,
    baremeSource: thresholds?.source,
    neutralisedChildIds: neutralisedChildFactKeys,
  });
  // Only the explicit ledger proves which child/period was reported. A legacy
  // global temporal decision has no reliable person association.
  const { assessment: childrenOnlyAssessment, reportedExpiries } = deriveChildrenOnlyAssessmentUpdate(previousChildrenAssessment, decision.reportedChildIncomeExpiries ?? [], composition, householdAssessment, payload, neutralisedChildFactKeys, now);
  const relativeHouseholdAssessment = deriveRelativeHouseholdAssessment(previousRelativeAssessment, composition, householdAssessment, payload, familyFacts);
  const thirdPartyHouseholdAssessment = deriveThirdPartyHouseholdAssessment(previousThirdPartyAssessment, decision.householdAssessment, composition, householdAssessment, payload);
  return {
    ...currentDecision,
    personalSituationTrace: derivePersonalSituationTrace(payload),
    ...(article110Decision ? { article110Decision } : {}),
    householdAssessment,
    ...(childrenOnlyAssessment ? { childrenOnlyAssessment } : {}),
    ...(reportedExpiries.length > 0 ? { reportedChildIncomeExpiries: reportedExpiries } : {}),
    ...(relativeHouseholdAssessment ? { relativeHouseholdAssessment } : {}),
    ...(thirdPartyHouseholdAssessment ? { thirdPartyHouseholdAssessment } : {}),
    ...(legacyIsolatedAssessment || legacyIsolatedHistory
      ? { isolatedHouseholdAssessmentHistory: [...(legacyIsolatedHistory ?? []), ...(legacyIsolatedAssessment ? [legacyIsolatedAssessment] : [])] }
      : {}),
  };
}
