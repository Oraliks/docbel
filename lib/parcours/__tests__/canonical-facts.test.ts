import { describe, it, expect } from "vitest";
import {
  collectCanonicalFacts,
  prefillEligibilityAnswers,
} from "@/lib/parcours/canonical-facts";
import type { EligibilityQuestion } from "@/lib/bundles/eligibility";

describe("collectCanonicalFacts", () => {
  it("rassemble les tags valides des options choisies", () => {
    const facts = collectCanonicalFacts([
      { canonical: { key: "age_bracket", value: "under_25" } },
      { canonical: { key: "a_deja_travaille", value: "non" } },
      undefined,
      {},
    ]);
    expect(facts).toEqual({ age_bracket: "under_25", a_deja_travaille: "non" });
  });

  it("ignore un tag invalide (clé/valeur hors registre)", () => {
    const facts = collectCanonicalFacts([
      { canonical: { key: "age_bracket", value: "bogus" } },
      { canonical: { key: "inconnue", value: "x" } },
    ]);
    expect(facts).toEqual({});
  });

  it("dernier gagnant sur clé en conflit", () => {
    const facts = collectCanonicalFacts([
      { canonical: { key: "age_bracket", value: "under_25" } },
      { canonical: { key: "age_bracket", value: "25_plus" } },
    ]);
    expect(facts).toEqual({ age_bracket: "25_plus" });
  });
});

describe("prefillEligibilityAnswers", () => {
  const selectQ: EligibilityQuestion = {
    id: "age", label: "Âge", type: "select", canonicalKey: "age_bracket",
    options: [
      { value: "j", label: "Jeune", verdict: "neutral", canonicalValue: "under_25" },
      { value: "a", label: "Autre", verdict: "neutral", canonicalValue: "25_plus" },
    ],
  };
  const boolQ: EligibilityQuestion = {
    id: "trav", label: "Travaillé ?", type: "boolean",
    verdictTrue: "eligible", verdictFalse: "neutral",
    canonicalKey: "a_deja_travaille", canonicalTrue: "oui", canonicalFalse: "non",
  };

  it("pré-remplit un select via canonicalValue", () => {
    expect(prefillEligibilityAnswers([selectQ], { age_bracket: "under_25" })).toEqual({ age: "j" });
  });

  it("pré-remplit un boolean via canonicalTrue/False", () => {
    expect(prefillEligibilityAnswers([boolQ], { a_deja_travaille: "non" })).toEqual({ trav: "false" });
  });

  it("ignore une question sans canonicalKey", () => {
    const q: EligibilityQuestion = { id: "z", label: "Z", type: "boolean", verdictTrue: "neutral", verdictFalse: "neutral" };
    expect(prefillEligibilityAnswers([q], { age_bracket: "under_25" })).toEqual({});
  });

  it("ignore une clé absente des faits", () => {
    expect(prefillEligibilityAnswers([selectQ], { autre: "x" })).toEqual({});
  });

  it("ignore un fait sans option correspondante", () => {
    expect(prefillEligibilityAnswers([selectQ], { age_bracket: "valeur_sans_option" })).toEqual({});
  });
});
