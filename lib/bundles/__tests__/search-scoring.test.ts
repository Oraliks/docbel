import { describe, it, expect } from "vitest";
import {
  scoreBundleMatch,
  searchBundles,
  type BundleMatchInput,
} from "../vocabulary";

function bundle(p: Partial<BundleMatchInput> & Pick<BundleMatchInput, "slug" | "name">): BundleMatchInput {
  return { id: p.slug, ...p } as BundleMatchInput;
}

describe("scoreBundleMatch — champs migration 53", () => {
  it("matche par mot-clé (keywords) comme un tag", () => {
    const b = bundle({
      slug: "chomage-temporaire",
      name: "Chômage temporaire",
      keywords: ["intempéries"],
    });
    expect(scoreBundleMatch("intemperies", b).score).toBeGreaterThan(0);
  });

  it("matche par synonyme (synonyms)", () => {
    const b = bundle({
      slug: "chomage-complet",
      name: "Chômage complet",
      synonyms: ["fin de contrat"],
    });
    expect(scoreBundleMatch("fin de contrat", b).score).toBeGreaterThan(0);
  });

  it("matche par organisme (recherche 'ONEM')", () => {
    const onem = bundle({ slug: "a", name: "Allocations", organism: "ONEM" });
    const autre = bundle({ slug: "b", name: "Allocations", organism: "CAPAC" });
    expect(scoreBundleMatch("onem", onem).score).toBeGreaterThan(0);
    expect(scoreBundleMatch("onem", autre).score).toBe(0);
  });

  it("ne score pas un terme absent", () => {
    const b = bundle({ slug: "x", name: "Chômage complet", keywords: ["licenciement"] });
    expect(scoreBundleMatch("logement social", b).score).toBe(0);
  });

  it("le tag exact pèse plus que la description seule", () => {
    const parTag = bundle({ slug: "t", name: "Dossier", keywords: ["intempéries"] });
    const parDesc = bundle({
      slug: "d",
      name: "Dossier",
      description: "concerne les intempéries hivernales",
    });
    expect(scoreBundleMatch("intemperies", parTag).score).toBeGreaterThan(
      scoreBundleMatch("intemperies", parDesc).score,
    );
  });
});

describe("searchBundles — ranking", () => {
  const bundles: BundleMatchInput[] = [
    bundle({ slug: "ct", name: "Chômage temporaire", keywords: ["intempéries", "chômage technique"] }),
    bundle({ slug: "cc", name: "Chômage complet", synonyms: ["perte d'emploi"] }),
    bundle({ slug: "apl", name: "Aide au logement", organism: "Région" }),
  ];

  it("classe le meilleur match en tête et exclut les scores nuls", () => {
    const res = searchBundles("intempéries", bundles);
    expect(res.length).toBe(1);
    expect(res[0].slug).toBe("ct");
  });

  it("retourne vide pour une requête vide", () => {
    expect(searchBundles("   ", bundles)).toEqual([]);
  });
});
