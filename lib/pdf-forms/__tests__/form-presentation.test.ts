import { describe, it, expect } from "vitest";
import {
  getFormPresentation,
  stepGroupTitle,
  stepGroupDescription,
  stepAnchorField,
  stepTitleReplacesFieldLabel,
} from "../form-presentation";
import { C1A_QUESTIONS } from "../seed/c1a-routing";

/// Le C1 pilotait sa présentation depuis trois fichiers, par des tests de slug
/// en dur. Un second formulaire à macro-étapes aurait affiché ses identifiants
/// bruts en guise de titres, dans un ordre arbitraire. Ces tests fixent les
/// DEUX comportements qui comptent : celui du C1, et celui d'un formulaire qui
/// n'est pas (encore) enregistré.
describe("form-presentation", () => {
  const traduire = (key: string) => `t:${key}`;

  describe("formulaire enregistré (C1)", () => {
    const c1 = getFormPresentation("c1-changement-situation");

    it("garde son ordre canonique — celui du PDF n'est pas celui du parcours", () => {
      expect(c1.stepGroupOrder).toEqual([
        "motif",
        "identite",
        "activites-revenus",
        "famille",
        "final",
      ]);
    });

    it("traduit ses titres et descriptions par clé i18n", () => {
      expect(stepGroupTitle(c1, "famille", "fr", traduire)).toBe("t:runnerGroupFamille");
      expect(stepGroupDescription(c1, "famille", traduire)).toBe("t:runnerGroupFamilleDesc");
    });

    it("masque la liste d'étapes (parcours volontairement linéaire)", () => {
      expect(c1.hideStepList).toBe(true);
    });
  });

  describe("formulaire non enregistré", () => {
    const inconnu = getFormPresentation("un-nouveau-formulaire");

    it("n'impose aucun ordre : les étapes suivent l'ordre des champs", () => {
      expect(inconnu.stepGroupOrder).toBeUndefined();
    });

    it("affiche la navigation par étapes — c'est le défaut, pas une option", () => {
      expect(inconnu.hideStepList).toBeFalsy();
    });

    it("retombe sur le libellé de section plutôt qu'un identifiant brut", () => {
      // « identite » est une clé de section connue : le citoyen voit un vrai
      // libellé traduit, pas `identite`.
      expect(stepGroupTitle(inconnu, "identite", "fr", traduire)).toBe("Identité");
      expect(stepGroupTitle(inconnu, "identite", "nl", traduire)).toBe("Identiteit");
      // Un groupe inconnu est au moins capitalisé — lisible en attendant que
      // le formulaire soit enregistré, et assez proche de l'identifiant pour
      // qu'on comprenne ce qu'il reste à faire.
      expect(stepGroupTitle(inconnu, "groupe-maison", "fr", traduire)).toBe("Groupe-maison");
    });

    it("n'invente pas de description", () => {
      expect(stepGroupDescription(inconnu, "identite", traduire)).toBeUndefined();
    });
  });

  describe("formulaire d'une question par étape (C1A)", () => {
    const c1a = getFormPresentation("c1a");

    it("suit l'ordre du document, l'identité en tête", () => {
      expect(c1a.stepGroupOrder).toEqual(["identite", ...C1A_QUESTIONS]);
      // L'ordre vient de l'arbre de renvois, jamais d'une liste recopiée.
      expect(c1a.stepGroupOrder?.[1]).toBe("aideIndependant"); // Q1
      expect(c1a.stepGroupOrder?.at(-1)).toBe("affirmationSincerite"); // Q24
    });

    it("ne déclare qu'une clé i18n : celle du bloc qui n'est pas une question", () => {
      expect(Object.keys(c1a.stepGroupTitleKey ?? {})).toEqual(["identite"]);
    });
  });

  describe("titre d'étape emprunté à la question", () => {
    const c1a = getFormPresentation("c1a");
    const question = "Aidez-vous un indépendant ?";

    it("la clé i18n prime sur tout", () => {
      expect(stepGroupTitle(c1a, "identite", "fr", traduire, question)).toBe(
        "t:runnerGroupC1aIdentite",
      );
    });

    it("à défaut de clé, l'étape prend pour titre la question elle-même", () => {
      expect(stepGroupTitle(c1a, "aideIndependant", "fr", traduire, question)).toBe(question);
    });

    it("sans ancre ni clé, on retombe sur le libellé de section", () => {
      // Repli de dernier recours : mieux vaut « Identité » que `identite`.
      expect(stepGroupTitle(c1a, "identite", "fr", (k) => k, undefined)).toBe(
        "runnerGroupC1aIdentite",
      );
      expect(stepGroupTitle({}, "adresse", "fr", traduire)).toBe("Adresse");
    });

    it("l'ancre est le champ qui porte l'identifiant du groupe", () => {
      const champs = [{ id: "autre" }, { id: "aideIndependant" }];
      expect(stepAnchorField("aideIndependant", champs)?.id).toBe("aideIndependant");
      expect(stepAnchorField("groupe-sans-ancre", champs)).toBeUndefined();
    });

    it("le libellé n'est retiré de l'écran que si la question est seule sur l'étape", () => {
      // Seule : le titre EST son libellé, l'afficher deux fois ferait doublon.
      expect(stepTitleReplacesFieldLabel(c1a, "aideIndependant", 1)).toBe(true);
      // Entourée d'autres champs : son libellé la distingue de ses voisines,
      // le retirer laisserait une case sans nom à l'écran.
      expect(stepTitleReplacesFieldLabel(c1a, "independantNom", 5)).toBe(false);
      // Étape titrée par clé i18n : le libellé du champ ne fait jamais doublon.
      expect(stepTitleReplacesFieldLabel(c1a, "identite", 1)).toBe(false);
    });
  });
});
