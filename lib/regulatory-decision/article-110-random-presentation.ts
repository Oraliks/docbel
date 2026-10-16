import type { Locale } from "@/i18n/config";
import { formatCurrency, formatDate } from "@/lib/i18n/format";

import type { Article110VerifierInput, Article110VerifierPerson } from "./article-110-verifier";

export type Article110RandomMessage = {
  key: string;
  values?: Record<string, string | number>;
  relationKey?: string;
  person?: { relationKey: string; index: number };
};

export type Article110RandomPresentation = {
  family: Article110RandomMessage[];
  incomes: Article110RandomMessage[];
  particulars: Article110RandomMessage[];
  incomplete: boolean;
};

function personLabel(person: Article110VerifierPerson, index: number): Article110RandomMessage {
  const relation = person.relation === "spouse" ? "article110RandomRelationSpouse"
    : person.relation === "partner" ? "article110RandomRelationPartner"
      : person.relation === "child" ? "article110RandomRelationChild"
        : person.relation === "relative" ? "article110RandomRelationRelative"
          : person.relation === "third_party" ? "article110RandomRelationThirdParty"
            : "article110RandomRelationUnknown";
  return { key: "article110RandomPerson", values: { index: index + 1 }, relationKey: relation };
}

function personReference(person: Article110VerifierPerson, index: number): { relationKey: string; index: number } {
  return { relationKey: personLabel(person, index).relationKey!, index: index + 1 };
}

/**
 * Turns the exact normalized verifier input into user-facing facts. It does
 * not inspect the legacy matrix payload, so a displayed fact is always a fact
 * that reaches the shared Article 110 evaluator.
 */
export function presentArticle110RandomInput(input: Article110VerifierInput, locale: Locale): Article110RandomPresentation {
  const family: Article110RandomMessage[] = [];
  const incomes: Article110RandomMessage[] = [];
  const particulars: Article110RandomMessage[] = [];
  let incomplete = false;

  if (input.isAloneExplicit === true) family.push({ key: "article110RandomHouseholdAlone" });
  else if (input.people.length === 0) {
    family.push({ key: "article110RandomHouseholdNotReported" });
    incomplete = true;
  } else {
    family.push({ key: "article110RandomHouseholdPeople", values: { count: input.people.length } });
  }

  input.people.forEach((person, index) => {
    const personRef = personReference(person, index);
    family.push(personLabel(person, index));
    if (person.relation === "unknown") incomplete = true;
    if (person.receivesFamilyAllowances !== undefined) {
      incomes.push({ key: person.receivesFamilyAllowances ? "article110RandomFamilyAllowancesYes" : "article110RandomFamilyAllowancesNo", person: personRef });
    }
    if (person.hasProfessionalIncome === true) {
      const amount = person.professionalIncomeAmount === undefined ? undefined : formatCurrency(person.professionalIncomeAmount, locale);
      incomes.push({ key: amount ? "article110RandomProfessionalIncomeAmount" : "article110RandomProfessionalIncomeWithoutAmount", values: amount ? { amount } : undefined, person: personRef });
      if (person.professionalIncomeVariable === true) incomes.push({ key: "article110RandomProfessionalIncomeVariable", person: personRef });
      if (person.c110aReceived === true && person.c110aMonthlyDeclaredIncome !== undefined) incomes.push({ key: "article110RandomC110aIncome", values: { amount: formatCurrency(person.c110aMonthlyDeclaredIncome, locale) }, person: personRef });
      if (person.firstProfessionalIncome === true && person.firstProfessionalIncomeStartedAt) incomes.push({ key: "article110RandomFirstProfessionalIncome", values: { date: formatDate(person.firstProfessionalIncomeStartedAt, locale) }, person: personRef });
    } else if (person.hasProfessionalIncome === false) incomes.push({ key: "article110RandomNoProfessionalIncome", person: personRef });
    if (person.hasReplacementIncome === true) {
      const amount = person.replacementIncomeAmount === undefined ? undefined : formatCurrency(person.replacementIncomeAmount, locale);
      incomes.push({ key: amount ? "article110RandomReplacementIncomeAmount" : "article110RandomReplacementIncomeWithoutAmount", values: amount ? { amount } : undefined, person: personRef });
    } else if (person.hasReplacementIncome === false) incomes.push({ key: "article110RandomNoReplacementIncome", person: personRef });
  });

  if (input.cohousing === true) {
    particulars.push({ key: "article110RandomCohousingDeclared" });
    if (input.cohousingAutonomousLiving === true) particulars.push({ key: "article110RandomCohousingAutonomous" });
    else if (input.cohousingAutonomousLiving === false) particulars.push({ key: "article110RandomCohousingNotAutonomous" });
    else {
      particulars.push({ key: "article110RandomCohousingAutonomyMissing" });
      incomplete = true;
    }
    if (input.cohousingRecognition === "recognised_same_address") particulars.push({ key: "article110RandomCohousingRecognised" });
    else if (input.cohousingRecognition === "not_recognised") particulars.push({ key: "article110RandomCohousingNotRecognised" });
    else if (input.cohousingRecognition === "pending") particulars.push({ key: "article110RandomCohousingRecognitionPending" });
  }

  if (input.alimony?.enabled === true) {
    particulars.push({ key: "article110RandomAlimonyPaid" });
    if (input.alimony.legalConditionEstablished === true) particulars.push({ key: "article110RandomAlimonyLegalBasisEstablished" });
    else if (input.alimony.legalConditionEstablished === false) particulars.push({ key: "article110RandomAlimonyLegalBasisNotEstablished" });
    else {
      particulars.push({ key: "article110RandomAlimonyLegalBasisMissing" });
      incomplete = true;
    }
    if (input.alimony.beneficiary === "minor_child") particulars.push({ key: "article110RandomAlimonyMinorChild" });
    else if (input.alimony.beneficiary === "adult_child") {
      particulars.push({ key: "article110RandomAlimonyAdultChild" });
      if (input.alimony.adultChildInNeed !== true) incomplete = true;
    } else if (input.alimony.beneficiary === "other") particulars.push({ key: "article110RandomAlimonyOtherBeneficiary" });
    else {
      particulars.push({ key: "article110RandomAlimonyBeneficiaryMissing" });
      incomplete = true;
    }
  }

  if (input.alternatingCare?.enabled === true) {
    particulars.push({ key: "article110RandomAlternatingCareDeclared" });
    if (input.alternatingCare.averageDaysPerWeek !== undefined) particulars.push({ key: "article110RandomAlternatingCareDays", values: { days: input.alternatingCare.averageDaysPerWeek } });
    else incomplete = true;
    if (input.alternatingCare.cycle) particulars.push({ key: "article110RandomAlternatingCareCycle" });
    else incomplete = true;
  }

  return { family, incomes, particulars, incomplete };
}
