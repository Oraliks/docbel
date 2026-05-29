import { describe, it, expect } from "vitest";
import {
  validateVisualFieldsDoc,
  generateFieldName,
  findNameCollisions,
  isDocDirtyVsMaterialized,
  isNameAvailable,
  FIELD_NAME_RE,
} from "../validation";
import type { VisualFieldsDoc } from "../types";

const makeDoc = (fields: VisualFieldsDoc["fields"], materializedNames?: string[]): VisualFieldsDoc => ({
  version: 1,
  fields,
  materializedNames,
});

const textField = (over: Partial<{ id: string; name: string; page: number }> = {}) => ({
  id: over.id ?? "f1",
  name: over.name ?? "nom",
  type: "text" as const,
  page: over.page ?? 0,
  rect: { x: 10, y: 10, w: 100, h: 20 },
});

describe("FIELD_NAME_RE", () => {
  it("accepte alphanum + _ -", () => {
    expect(FIELD_NAME_RE.test("nom_du-champ_1")).toBe(true);
  });
  it("refuse les espaces et les points", () => {
    expect(FIELD_NAME_RE.test("nom du champ")).toBe(false);
    expect(FIELD_NAME_RE.test("parent.child")).toBe(false);
  });
  it("refuse vide ou >127 chars", () => {
    expect(FIELD_NAME_RE.test("")).toBe(false);
    expect(FIELD_NAME_RE.test("a".repeat(128))).toBe(false);
  });
});

describe("validateVisualFieldsDoc", () => {
  it("accepte un doc minimal valide", () => {
    const r = validateVisualFieldsDoc(makeDoc([textField()]));
    expect(r.ok).toBe(true);
  });

  it("refuse un rect trop petit", () => {
    const f = textField();
    f.rect = { x: 0, y: 0, w: 2, h: 2 };
    const r = validateVisualFieldsDoc(makeDoc([f]));
    expect(r.ok).toBe(false);
  });

  it("refuse les noms dupliqués", () => {
    const r = validateVisualFieldsDoc(
      makeDoc([textField({ id: "a", name: "x" }), textField({ id: "b", name: "x" })])
    );
    expect(r.ok).toBe(false);
    expect(r.errors!.some((e) => e.message.includes("dupliqué"))).toBe(true);
  });

  it("refuse les identifiants dupliqués", () => {
    const r = validateVisualFieldsDoc(
      makeDoc([textField({ id: "a", name: "x" }), textField({ id: "a", name: "y" })])
    );
    expect(r.ok).toBe(false);
  });

  it("refuse un type inconnu", () => {
    const bad = { ...textField(), type: "dropdown" } as unknown;
    const r = validateVisualFieldsDoc(makeDoc([bad as never]));
    expect(r.ok).toBe(false);
  });

  it("accepte une checkbox valide", () => {
    const r = validateVisualFieldsDoc(
      makeDoc([{ id: "c1", name: "ok", type: "checkbox", page: 0, rect: { x: 5, y: 5, w: 14, h: 14 } }])
    );
    expect(r.ok).toBe(true);
  });
});

describe("generateFieldName", () => {
  it("renvoie le préfixe si libre", () => {
    expect(generateFieldName(makeDoc([]), "nom")).toBe("nom");
  });
  it("incrémente si pris", () => {
    const doc = makeDoc([textField({ id: "x", name: "nom" }), textField({ id: "y", name: "nom_2" })]);
    expect(generateFieldName(doc, "nom")).toBe("nom_3");
  });
  it("sanitize les caractères interdits", () => {
    expect(generateFieldName(makeDoc([]), "Mon Champ.1")).toBe("Mon_Champ_1");
  });
});

describe("findNameCollisions", () => {
  it("détecte les chevauchements avec un schéma AcroForm existant", () => {
    const doc = makeDoc([textField({ name: "deja_la" }), textField({ id: "z", name: "ok" })]);
    expect(findNameCollisions(doc, ["deja_la", "autre"])).toEqual(["deja_la"]);
  });
});

describe("isDocDirtyVsMaterialized", () => {
  it("dirty si jamais matérialisé", () => {
    expect(isDocDirtyVsMaterialized(makeDoc([textField()]))).toBe(true);
  });
  it("clean si noms identiques", () => {
    expect(isDocDirtyVsMaterialized(makeDoc([textField({ name: "a" })], ["a"]))).toBe(false);
  });
  it("dirty si on a renommé un champ", () => {
    expect(isDocDirtyVsMaterialized(makeDoc([textField({ name: "a" })], ["b"]))).toBe(true);
  });
});

describe("isNameAvailable", () => {
  it("ignore le champ courant lors de la vérification", () => {
    const doc = makeDoc([textField({ id: "x", name: "n" })]);
    expect(isNameAvailable(doc, "n")).toBe(false);
    expect(isNameAvailable(doc, "n", "x")).toBe(true);
  });
});
