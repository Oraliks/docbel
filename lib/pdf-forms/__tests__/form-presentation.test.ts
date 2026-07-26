import { describe, it, expect } from "vitest";
import {
  getFormPresentation,
  stepGroupTitle,
  stepGroupDescription,
} from "../form-presentation";

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
});
