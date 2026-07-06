import { describe, it, expect } from "vitest";
import { buildValidator, isFieldVisible, anchoredRegex, validateFieldFormat, isFieldComplete } from "../validation";
import { PdfFormField } from "../types";

function field(p: Partial<PdfFormField> & Pick<PdfFormField, "id" | "type">): PdfFormField {
  return { pdfFieldName: p.id, required: false, label: { fr: p.id }, ...p } as PdfFormField;
}

describe("buildValidator", () => {
  it("valide un NISS correct et rejette un mauvais", () => {
    const v = buildValidator([field({ id: "niss", type: "niss", required: true })], "fr");
    expect(v.safeParse({ niss: "85073003328" }).success).toBe(true);
    expect(v.safeParse({ niss: "00000000000" }).success).toBe(false);
  });

  it("explique un NISS trop court (longueur) avec le nombre saisi", () => {
    const v = buildValidator([field({ id: "niss", type: "niss", required: true })], "fr");
    const res = v.safeParse({ niss: "850730" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toMatch(/11 chiffres/);
      expect(res.error.issues[0].message).toMatch(/saisi 6/);
    }
  });

  it("explique un NISS à 11 chiffres mais mauvais checksum (erreur de frappe)", () => {
    const v = buildValidator([field({ id: "niss", type: "niss", required: true })], "fr");
    const res = v.safeParse({ niss: "85073003329" }); // 1 chiffre faux
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].message).toMatch(/erreur de frappe/i);
  });

  it("respecte un message NISS personnalisé par l'admin", () => {
    const v = buildValidator(
      [field({ id: "niss", type: "niss", required: true, errorMsg: { fr: "Mon message à moi" } })],
      "fr"
    );
    const res = v.safeParse({ niss: "850730" });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].message).toBe("Mon message à moi");
  });

  it("exige les champs requis visibles", () => {
    const v = buildValidator([field({ id: "nom", type: "text", required: true })], "fr");
    expect(v.safeParse({ nom: "" }).success).toBe(false);
    expect(v.safeParse({ nom: "Dupont" }).success).toBe(true);
  });

  it("n'exige pas un champ requis masqué par visibleIf", () => {
    const fields = [
      field({ id: "a", type: "checkbox" }),
      field({ id: "b", type: "text", required: true, visibleIf: { fieldId: "a", op: "equals", value: true } }),
    ];
    const v = buildValidator(fields, "fr");
    expect(v.safeParse({ a: false, b: "" }).success).toBe(true);
    expect(v.safeParse({ a: true, b: "" }).success).toBe(false);
  });

  it("restreint un select aux options autorisées", () => {
    const f = field({ id: "s", type: "select", options: [{ value: "x", label: { fr: "X" } }] });
    const v = buildValidator([f], "fr");
    expect(v.safeParse({ s: "x" }).success).toBe(true);
    expect(v.safeParse({ s: "z" }).success).toBe(false);
  });

  it("utilise le message d'erreur localisé (NL)", () => {
    const v = buildValidator([field({ id: "iban", type: "iban", required: true })], "nl");
    const res = v.safeParse({ iban: "BE00" });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].message).toMatch(/IBAN/i);
  });

  it("fullname requis exige prénom ET nom", () => {
    const v = buildValidator([field({ id: "name", type: "fullname", required: true })], "fr");
    expect(v.safeParse({ name: { first: "Jean", last: "Dupont" } }).success).toBe(true);
    expect(v.safeParse({ name: { first: "Jean", last: "" } }).success).toBe(false);
    expect(v.safeParse({ name: { first: "", last: "Dupont" } }).success).toBe(false);
    expect(v.safeParse({ name: {} }).success).toBe(false);
  });

  it("fullname optionnel accepte une valeur vide", () => {
    const v = buildValidator([field({ id: "name", type: "fullname" })], "fr");
    expect(v.safeParse({ name: { first: "", last: "" } }).success).toBe(true);
    expect(v.safeParse({}).success).toBe(true);
  });

  it.each([
    ["text", "", false],
    ["text", "x", true],
    ["textarea", "", false],
    ["textarea", "hello", true],
    ["niss", "", false],
    ["iban", "", false],
    ["postal_be", "", false],
    ["tva_be", "", false],
    ["bce", "", false],
    ["phone_be", "", false],
    ["email", "", false],
    ["date", "", false],
    ["number", "", false],
    ["number", "0", true],
    ["select", "", false],
    ["radio", "", false],
  ] as const)("required '%s' avec input %p → success=%s", (type, input, expected) => {
    const f = field({
      id: "x",
      type: type as never,
      required: true,
      options: type === "select" || type === "radio" ? [{ value: "x", label: { fr: "X" } }] : undefined,
    });
    const v = buildValidator([f], "fr");
    expect(v.safeParse({ x: input }).success).toBe(expected);
  });

  it("required: checkbox non cochée échoue, cochée passe", () => {
    const v = buildValidator([field({ id: "c", type: "checkbox", required: true })], "fr");
    expect(v.safeParse({ c: false }).success).toBe(false);
    expect(v.safeParse({ c: true }).success).toBe(true);
  });

  it("texte trop court : message pédagogique avec les deux nombres", () => {
    const v = buildValidator([field({ id: "t", type: "text", minLength: 5 })], "fr");
    const res = v.safeParse({ t: "abc" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toMatch(/au moins 5/);
      expect(res.error.issues[0].message).toMatch(/écrit 3/);
    }
  });

  it("texte trop long : message pédagogique avec les deux nombres", () => {
    const v = buildValidator([field({ id: "t", type: "text", maxLength: 3 })], "fr");
    const res = v.safeParse({ t: "abcdef" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toMatch(/maximum 3/);
      expect(res.error.issues[0].message).toMatch(/écrit 6/);
    }
  });

  it("nombre hors plage : messages clairs en français", () => {
    const v = buildValidator([field({ id: "n", type: "number", min: 18, max: 65 })], "fr");
    const tooLow = v.safeParse({ n: 10 });
    expect(tooLow.success).toBe(false);
    if (!tooLow.success) expect(tooLow.error.issues[0].message).toMatch(/au moins.*18/);
    const tooHigh = v.safeParse({ n: 99 });
    expect(tooHigh.success).toBe(false);
    if (!tooHigh.success) expect(tooHigh.error.issues[0].message).toMatch(/pas dépasser 65/);
  });
});

describe("anchoredRegex", () => {
  it("ancre la regex (^...$) pour éviter les correspondances partielles", () => {
    const rx = anchoredRegex("\\d{4}");
    expect(rx?.test("1234")).toBe(true);
    expect(rx?.test("abc1234xyz")).toBe(false);
  });
  it("renvoie null pour une regex invalide", () => {
    expect(anchoredRegex("(")).toBeNull();
  });
});

describe("isFieldVisible", () => {
  it("gère in / notIn", () => {
    expect(isFieldVisible({ fieldId: "t", op: "in", value: ["a", "b"] }, { t: "a" })).toBe(true);
    expect(isFieldVisible({ fieldId: "t", op: "notIn", value: ["a", "b"] }, { t: "c" })).toBe(true);
  });
});

describe("validateFieldFormat — validation par champ (blur)", () => {
  it("champ vide → null (pas d'erreur de format ; le requis se gère à l'envoi)", () => {
    expect(validateFieldFormat(field({ id: "niss", type: "niss", required: true }), "", "fr")).toBeNull();
  });

  it("NISS valide → null, NISS invalide → message", () => {
    const f = field({ id: "niss", type: "niss" });
    expect(validateFieldFormat(f, "85073003328", "fr")).toBeNull();
    expect(validateFieldFormat(f, "00000000000", "fr")).not.toBeNull();
  });

  it("IBAN belge invalide → message ; date invalide → message", () => {
    expect(validateFieldFormat(field({ id: "iban", type: "iban" }), "BE00", "fr")).not.toBeNull();
    expect(validateFieldFormat(field({ id: "d", type: "date" }), "pas-une-date", "fr")).not.toBeNull();
  });

  it("type non validable (text) → toujours null", () => {
    expect(validateFieldFormat(field({ id: "t", type: "text" }), "n'importe quoi", "fr")).toBeNull();
  });
});

describe("isFieldComplete — complétion d'un champ (pour le stepper)", () => {
  it("texte non vide = complet, vide = non complet", () => {
    const f = field({ id: "t", type: "text" });
    expect(isFieldComplete(f, "abc", "fr")).toBe(true);
    expect(isFieldComplete(f, "", "fr")).toBe(false);
    expect(isFieldComplete(f, "   ", "fr")).toBe(false);
  });

  it("NISS : complet seulement si valide", () => {
    const f = field({ id: "niss", type: "niss" });
    expect(isFieldComplete(f, "85073003328", "fr")).toBe(true);
    expect(isFieldComplete(f, "850730", "fr")).toBe(false);
  });

  it("checkbox : complet seulement si coché", () => {
    const f = field({ id: "c", type: "checkbox" });
    expect(isFieldComplete(f, true, "fr")).toBe(true);
    expect(isFieldComplete(f, false, "fr")).toBe(false);
  });

  it("fullname : complet seulement si prénom ET nom", () => {
    const f = field({ id: "n", type: "fullname" });
    expect(isFieldComplete(f, { first: "Jean", last: "Dupont" }, "fr")).toBe(true);
    expect(isFieldComplete(f, { first: "Jean", last: "" }, "fr")).toBe(false);
  });
});
