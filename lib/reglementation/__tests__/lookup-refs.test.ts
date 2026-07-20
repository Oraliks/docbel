import { describe, expect, it } from "vitest";
import { normalizeLookupRefs } from "../lookup-refs";

describe("normalizeLookupRefs", () => {
  it("renvoie [] pour une valeur non-tableau (undefined/null/objet)", () => {
    expect(normalizeLookupRefs(undefined)).toEqual([]);
    expect(normalizeLookupRefs(null)).toEqual([]);
    expect(normalizeLookupRefs({ tableSlug: "x", label: "y" })).toEqual([]);
    expect(normalizeLookupRefs("s04")).toEqual([]);
  });

  it("garde une référence valide et trim les chaînes", () => {
    expect(
      normalizeLookupRefs([
        { tableSlug: "  signaletic-sanction-article ", code: " 153,1 ", label: "  Sanction art. 153 " },
      ]),
    ).toEqual([
      { tableSlug: "signaletic-sanction-article", code: "153,1", label: "Sanction art. 153" },
    ]);
  });

  it("écarte les entrées sans tableSlug ou sans label", () => {
    expect(
      normalizeLookupRefs([
        { tableSlug: "", label: "sans slug" },
        { tableSlug: "s04-s36-article-indemnisation", label: "" },
        { tableSlug: "s04-s36-article-indemnisation", label: "   " },
        { code: "44", label: "sans slug non plus" },
        { tableSlug: "ok", label: "valide" },
      ]),
    ).toEqual([{ tableSlug: "ok", label: "valide" }]);
  });

  it("préserve le contexte optionnel mais drop les chaînes vides", () => {
    expect(
      normalizeLookupRefs([
        { tableSlug: "t", label: "l", context: " Temps plein " },
        { tableSlug: "t2", label: "l2", context: "   " },
      ]),
    ).toEqual([
      { tableSlug: "t", label: "l", context: "Temps plein" },
      { tableSlug: "t2", label: "l2" },
    ]);
  });

  it("dédoublonne par (tableSlug, code) — code absent traité comme vide", () => {
    const out = normalizeLookupRefs([
      { tableSlug: "t", code: "44", label: "A" },
      { tableSlug: "t", code: "44", label: "doublon ignoré" },
      { tableSlug: "t", label: "sans code" },
      { tableSlug: "t", label: "sans code doublon ignoré" },
      { tableSlug: "t", code: "45", label: "autre code gardé" },
    ]);
    expect(out.map((r) => r.label)).toEqual(["A", "sans code", "autre code gardé"]);
  });

  it("plafonne à 12 références", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      tableSlug: "t",
      code: String(i),
      label: `ref ${i}`,
    }));
    expect(normalizeLookupRefs(many)).toHaveLength(12);
  });

  it("ignore les éléments non-objets dans le tableau", () => {
    expect(
      normalizeLookupRefs(["x", 3, null, undefined, { tableSlug: "t", label: "l" }]),
    ).toEqual([{ tableSlug: "t", label: "l" }]);
  });
});
