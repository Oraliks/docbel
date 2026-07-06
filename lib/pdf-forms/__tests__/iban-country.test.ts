import { describe, expect, it } from "vitest";
import { countryNameFromIban } from "../iban-country";

describe("countryNameFromIban", () => {
  it("détecte le pays depuis le préfixe à 2 lettres (Revolut = Lituanie)", () => {
    expect(countryNameFromIban("LT601010012345678901")).toBe("Lituanie");
  });

  it("fonctionne avec des espaces (format masqué par groupes de 4)", () => {
    expect(countryNameFromIban("FR76 3000 6000 0112 3456 7890 189")).toBe("France");
  });

  it("est insensible à la casse", () => {
    expect(countryNameFromIban("nl91abna0417164300")).toBe("Pays-Bas");
  });

  it("renvoie null pour un préfixe non reconnu (pays hors du périmètre SEPA/EEE géré)", () => {
    expect(countryNameFromIban("US64SVBKUS6S3300958879")).toBeNull();
  });

  it("renvoie null si trop court pour extraire un préfixe", () => {
    expect(countryNameFromIban("F")).toBeNull();
    expect(countryNameFromIban("")).toBeNull();
  });

  it("reconnaît la Belgique elle-même (cas limite : IBAN belge saisi dans le champ étranger)", () => {
    expect(countryNameFromIban("BE68539007547034")).toBe("Belgique");
  });
});
