import { describe, it, expect } from "vitest";
import { dossierQuestionsToEligibility } from "@/lib/dossiers/types";
import type { DossierQuestion } from "@/lib/dossiers/types";

describe("dossierQuestionsToEligibility — passthrough canonique", () => {
  it("transmet canonicalKey + canonicalValue d'un select", () => {
    const questions: DossierQuestion[] = [
      {
        id: "statut",
        label: { fr: "Tu fais ta demande comme…" },
        type: "select",
        canonicalKey: "a_deja_travaille",
        options: [
          { value: "salarie", label: { fr: "Salarié" }, canonicalValue: "oui" },
          { value: "premiere", label: { fr: "Première inscription" }, canonicalValue: "non" },
        ],
      },
    ];
    const [q] = dossierQuestionsToEligibility(questions);
    expect(q.canonicalKey).toBe("a_deja_travaille");
    expect(q.type === "select" && q.options[0].canonicalValue).toBe("oui");
    expect(q.type === "select" && q.options[1].canonicalValue).toBe("non");
  });

  it("transmet canonicalKey + canonicalTrue/False d'un boolean", () => {
    const questions: DossierQuestion[] = [
      {
        id: "trav",
        label: { fr: "Avez-vous déjà travaillé ?" },
        type: "boolean",
        canonicalKey: "a_deja_travaille",
        canonicalTrue: "oui",
        canonicalFalse: "non",
      },
    ];
    const [q] = dossierQuestionsToEligibility(questions);
    expect(q.canonicalKey).toBe("a_deja_travaille");
    expect(q.type === "boolean" && q.canonicalTrue).toBe("oui");
    expect(q.type === "boolean" && q.canonicalFalse).toBe("non");
  });

  it("laisse les champs canoniques absents (rétro-compat)", () => {
    const questions: DossierQuestion[] = [
      { id: "x", label: { fr: "X" }, type: "boolean" },
    ];
    const [q] = dossierQuestionsToEligibility(questions);
    expect(q.canonicalKey).toBeUndefined();
  });
});
