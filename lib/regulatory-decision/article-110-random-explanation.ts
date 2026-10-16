import type { Locale } from "@/i18n/config";
import { formatCurrency, formatDate } from "@/lib/i18n/format";

import type { Article110RandomMessage } from "./article-110-random-presentation";
import type { Article110VerifierInput, Article110VerifierPerson, evaluateArticle110Verifier } from "./article-110-verifier";

type Article110VerifierResult = ReturnType<typeof evaluateArticle110Verifier>;

export type Article110RandomExplanation = {
  paragraphs: Article110RandomMessage[];
};

function personReference(person: Article110VerifierPerson): Article110RandomMessage["person"] {
  if (person.relation === "spouse") return { key: "article110RandomPersonReferenceSpouse" };
  if (person.relation === "partner") return { key: "article110RandomPersonReferencePartner" };
  if (person.relation === "child") return { key: "article110RandomPersonReferenceChild" };
  if (person.relation === "relative") return { key: "article110RandomPersonReferenceRelative" };
  if (person.relation === "third_party") return { key: "article110RandomPersonReferenceThirdParty" };
  return { key: "article110RandomPersonReferenceUnknown" };
}

function baremeDate(result: Article110VerifierResult, locale: Locale) {
  const validFrom = result.householdAssessment.baremeSource?.validFrom;
  return validFrom ? formatDate(validFrom, locale) : undefined;
}

function comparison(amount: number, threshold: number) {
  return amount <= threshold ? "article110RandomExplanationAtOrBelow" : "article110RandomExplanationAbove";
}

/**
 * Presents the conclusion already reached by the common evaluator. It never
 * calls an evaluator or derives a new category: every paragraph is anchored in
 * the normalized input and the existing structured assessment.
 */
export function explainArticle110RandomResult(
  input: Article110VerifierInput,
  result: Article110VerifierResult,
  locale: Locale,
): Article110RandomExplanation {
  const paragraphs: Article110RandomMessage[] = [];
  const assessment = result.householdAssessment;
  const partner = input.people.find((person) => person.relation === "spouse" || person.relation === "partner");

  if (assessment.sourceRuleIds.includes("situation_familiale_cohousing_a_verifier") && input.cohousing === true) {
    if (result.category === "N" && input.cohousingAutonomousLiving === true) {
      if (assessment.administrativeTreatment?.decisionNeeded === true) {
        paragraphs.push({ key: "article110RandomExplanationCohousingPending" });
      } else if (assessment.administrativeTreatment?.recognition === "recognised_same_address") {
        paragraphs.push({ key: "article110RandomExplanationCohousingRecognised" });
      } else {
        paragraphs.push({ key: "article110RandomExplanationCohousingAutonomous" });
      }
    } else if (result.category === null) {
      paragraphs.push({ key: "article110RandomExplanationCohousingIncomplete" });
    }

    if (input.alimony?.enabled === true && input.alimony.beneficiary === undefined) {
      paragraphs.push({ key: "article110RandomExplanationAlimonyBeneficiaryMissing" });
    }
    return { paragraphs };
  }

  if (assessment.sourceRuleIds.includes("situation_familiale_conjoint_revenu_am60") && partner) {
    const person = personReference(partner);
    paragraphs.push({ key: "article110RandomExplanationPartnerPriority", person });
    const amount = partner.professionalIncomeAmount;
    const threshold = input.thresholds.spouseProfessionalMonthly;
    const date = baremeDate(result, locale) ?? formatDate(input.asOf ?? "1970-01-01", locale);
    if (typeof amount === "number" && Number.isFinite(amount) && typeof threshold === "number" && Number.isFinite(threshold)) {
      paragraphs.push({
        key: "article110RandomExplanationPartnerIncomeThreshold",
        person,
        values: {
          amount: formatCurrency(amount, locale),
          threshold: formatCurrency(threshold, locale),
          comparison: comparison(amount, threshold),
          date,
        },
      });
    }
    if (partner.professionalIncomeType === "independent" && typeof amount === "number" && Number.isFinite(amount)) {
      paragraphs.push({ key: "article110RandomExplanationIndependentIncome", person, values: { amount: formatCurrency(amount, locale) } });
    } else if (partner.hasProfessionalIncome === false && partner.hasReplacementIncome === false) {
      paragraphs.push({ key: "article110RandomExplanationPartnerNoIncome" });
    } else if (result.category === null) {
      paragraphs.push({ key: "article110RandomExplanationPartnerIncomplete" });
    }
    if (assessment.operationalArticle === "60A") {
      paragraphs.push({ key: "article110RandomExplanation60A" });
    } else if (assessment.operationalArticle === "60B") {
      if (Number.isFinite(assessment.monthlyC110aIncome)) {
        const payment = assessment.monthlyPaymentAssessment === "A_RATE"
          ? "article110RandomExplanationPaymentA"
          : "article110RandomExplanationPaymentB";
        paragraphs.push({
          key: "article110RandomExplanation60BMonthly",
          values: { amount: formatCurrency(assessment.monthlyC110aIncome as number, locale), payment },
        });
      } else {
        paragraphs.push({ key: "article110RandomExplanation60BMissingMonthly" });
      }
    }
    return { paragraphs };
  }

  if (assessment.pensionAssessment?.status === "VERIFIED" && typeof assessment.pensionAssessment.grossTotal === "number" && Number.isFinite(assessment.pensionAssessment.grossTotal) && typeof assessment.pensionAssessment.threshold === "number" && Number.isFinite(assessment.pensionAssessment.threshold)) {
    const person = input.people.find((candidate) => candidate.relation === "relative");
    const grossTotal = assessment.pensionAssessment.grossTotal as number;
    const threshold = assessment.pensionAssessment.threshold as number;
    const exclusivelyOneRelative = assessment.composition === "relatives_only" && input.people.length === 1 && person !== undefined;
    paragraphs.push({
      key: exclusivelyOneRelative
        ? result.category === "A"
          ? "article110RandomExplanationAscendantPensionA"
          : "article110RandomExplanationAscendantPensionB"
        : "article110RandomExplanationPensionThreshold",
      ...(person ? { person: personReference(person) } : {}),
      values: {
        amount: formatCurrency(grossTotal, locale),
        threshold: formatCurrency(threshold, locale),
        comparison: comparison(grossTotal, threshold),
        date: baremeDate(result, locale) ?? formatDate(input.asOf ?? "1970-01-01", locale),
      },
    });
    return { paragraphs };
  }

  if (assessment.sourceRuleIds.includes("situation_familiale_children_only")) {
    if (input.people.some((person) => person.receivesFamilyAllowances === true)) {
      paragraphs.push({ key: "article110RandomExplanationChildAllowances" });
    } else if (result.category === "B") {
      paragraphs.push({ key: "article110RandomExplanationChildRelevantIncome" });
    } else if (result.category === null) {
      paragraphs.push({ key: "article110RandomExplanationChildIncomplete" });
    }
    const childWithFirstIncome = input.people.find((person) => person.relation === "child" && person.firstProfessionalIncome === true && person.neutralisationRequested === true);
    if (childWithFirstIncome) {
      paragraphs.push({ key: result.appliedTreatments.neutralisedChildIds.includes(childWithFirstIncome.id) ? "article110RandomExplanation1101M" : "article110RandomExplanation1101V" });
    }
    return { paragraphs };
  }

  if (assessment.sourceRuleIds.includes("situation_familiale_isole_pension_alimentaire")) {
    paragraphs.push({ key: result.category === "A" ? "article110RandomExplanationAlimonyEstablished" : result.category === "N" ? "article110RandomExplanationAlimonyNotEstablished" : "article110RandomExplanationAlimonyIncomplete" });
    return { paragraphs };
  }

  if (assessment.sourceRuleIds.includes("situation_familiale_isole_garde_alternee")) {
    paragraphs.push({ key: result.category === "A" ? "article110RandomExplanationAlternatingCareA" : result.category === "B" ? "article110RandomExplanationAlternatingCareB" : "article110RandomExplanationAlternatingCareIncomplete" });
    return { paragraphs };
  }

  if (assessment.sourceRuleIds.includes("situation_familiale_third_parties")) {
    paragraphs.push({ key: result.category === "B" ? "article110RandomExplanationThirdPartyIncome" : result.category === null ? "article110RandomExplanationThirdPartyIncomplete" : "article110RandomExplanationThirdPartyNoRelevantIncome" });
    return { paragraphs };
  }

  if (input.people.some((person) => person.relation === "relative" && person.replacementIncomeType === "disability_allowance") && result.category === "A") {
    paragraphs.push({ key: "article110RandomExplanationSpfDisability" });
    return { paragraphs };
  }

  if (result.category === null) paragraphs.push({ key: "article110RandomExplanationIncomplete" });
  else paragraphs.push({ key: "article110RandomExplanationResultOnly" });
  return { paragraphs };
}
