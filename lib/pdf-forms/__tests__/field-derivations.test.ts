import { describe, expect, it } from "vitest";
import { FIELD_DERIVATIONS, applyFieldDerivations } from "../field-derivations";

describe("FIELD_DERIVATIONS.niss-birth-date", () => {
  it("dérive la date de naissance d'un NISS valide", () => {
    expect(FIELD_DERIVATIONS["niss-birth-date"]("42012205181")).toBe("1942-01-22");
  });

  it("renvoie null pour un NISS invalide, vide, ou une valeur non-string", () => {
    expect(FIELD_DERIVATIONS["niss-birth-date"]("42012205182")).toBeNull();
    expect(FIELD_DERIVATIONS["niss-birth-date"]("")).toBeNull();
    expect(FIELD_DERIVATIONS["niss-birth-date"](true)).toBeNull();
  });
});

describe("FIELD_DERIVATIONS.nationalite-hors-eee", () => {
  it("renvoie 'non' pour une nationalité EEE/Suisse reconnue", () => {
    expect(FIELD_DERIVATIONS["nationalite-hors-eee"]("Belge")).toBe("non");
    expect(FIELD_DERIVATIONS["nationalite-hors-eee"]("Française")).toBe("non");
    expect(FIELD_DERIVATIONS["nationalite-hors-eee"]("Suisse")).toBe("non");
  });

  it("renvoie 'oui' pour une nationalité hors EEE/Suisse (reconnue ou non)", () => {
    expect(FIELD_DERIVATIONS["nationalite-hors-eee"]("Marocaine")).toBe("oui");
    expect(FIELD_DERIVATIONS["nationalite-hors-eee"]("xyz123")).toBe("oui");
  });

  it("renvoie null pour une valeur vide, blanche, ou non-string (champ reste éditable)", () => {
    expect(FIELD_DERIVATIONS["nationalite-hors-eee"]("")).toBeNull();
    expect(FIELD_DERIVATIONS["nationalite-hors-eee"]("   ")).toBeNull();
    expect(FIELD_DERIVATIONS["nationalite-hors-eee"](true)).toBeNull();
  });
});

describe("applyFieldDerivations", () => {
  const fields = [
    { id: "date_de_naissance", derivedFrom: { fieldId: "niss", via: "niss-birth-date" as const } },
    { id: "autre_champ" },
  ];

  it("écrase la valeur du champ dérivé quand la source produit une valeur valide", () => {
    const values = { niss: "42012205181", date_de_naissance: "2000-01-01" };
    const result = applyFieldDerivations(values, fields);
    expect(result.date_de_naissance).toBe("1942-01-22");
  });

  it("ne touche pas au champ dérivé si la source ne produit rien (NISS vide/invalide)", () => {
    const values = { niss: "", date_de_naissance: "1999-05-05" };
    const result = applyFieldDerivations(values, fields);
    expect(result.date_de_naissance).toBe("1999-05-05");
  });

  it("ne mute pas l'objet original", () => {
    const values = { niss: "42012205181", date_de_naissance: "2000-01-01" };
    const result = applyFieldDerivations(values, fields);
    expect(result).not.toBe(values);
    expect(values.date_de_naissance).toBe("2000-01-01");
  });

  it("renvoie le MÊME objet (référence) si aucun champ n'a de derivedFrom (no-op rapide)", () => {
    const values = { a: "1" };
    const result = applyFieldDerivations(values, [{ id: "a" }]);
    expect(result).toBe(values);
  });

  it("no-op si la valeur dérivée est déjà celle stockée (pas de nouvel objet inutile)", () => {
    const values = { niss: "42012205181", date_de_naissance: "1942-01-22" };
    const result = applyFieldDerivations(values, fields);
    expect(result).toBe(values);
  });
});
