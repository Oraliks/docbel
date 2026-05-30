import { describe, it, expect } from "vitest";
import { buildValidator, isFieldVisible, anchoredRegex } from "../validation";
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
