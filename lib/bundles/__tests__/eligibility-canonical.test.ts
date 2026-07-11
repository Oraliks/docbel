import { describe, it, expect } from "vitest";
import { parseEligibilityQuestions } from "@/lib/bundles/eligibility";

describe("parseEligibilityQuestions — champs canoniques", () => {
  it("lit canonicalKey + canonicalValue sur un select", () => {
    const [q] = parseEligibilityQuestions([
      {
        id: "age",
        label: "Votre âge ?",
        type: "select",
        canonicalKey: "age_bracket",
        options: [
          { value: "j", label: "Jeune", verdict: "neutral", canonicalValue: "under_25" },
          { value: "v", label: "Autre", verdict: "neutral" },
        ],
      },
    ]);
    expect(q.canonicalKey).toBe("age_bracket");
    expect(q.type === "select" && q.options[0].canonicalValue).toBe("under_25");
    expect(q.type === "select" && q.options[1].canonicalValue).toBeUndefined();
  });

  it("lit canonicalTrue/canonicalFalse sur un boolean", () => {
    const [q] = parseEligibilityQuestions([
      {
        id: "trav",
        label: "Avez-vous déjà travaillé ?",
        type: "boolean",
        verdictTrue: "eligible",
        verdictFalse: "neutral",
        canonicalKey: "a_deja_travaille",
        canonicalTrue: "oui",
        canonicalFalse: "non",
      },
    ]);
    expect(q.canonicalKey).toBe("a_deja_travaille");
    expect(q.type === "boolean" && q.canonicalTrue).toBe("oui");
    expect(q.type === "boolean" && q.canonicalFalse).toBe("non");
  });

  it("tolère l'absence de champs canoniques (rétro-compat)", () => {
    const [q] = parseEligibilityQuestions([
      { id: "x", label: "X", type: "boolean", verdictTrue: "neutral", verdictFalse: "neutral" },
    ]);
    expect(q.canonicalKey).toBeUndefined();
  });
});
