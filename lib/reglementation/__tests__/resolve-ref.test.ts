// lib/reglementation/__tests__/resolve-ref.test.ts
import { describe, it, expect } from "vitest";
import {
  loiToPrefix,
  articleToRiolexId,
  linkifyRefs,
  linkifyCrossRefs,
  collectRefTargets,
  type RefContext,
} from "../resolve-ref";
import { parseInline } from "../parse-amendments";

describe("loiToPrefix", () => {
  it("dérive le préfixe du riolexId depuis la loi", () => {
    expect(loiToPrefix("AR 25/11/1991")).toBe("25_11_1991");
    expect(loiToPrefix("AM 26/11/1991")).toBe("26_11_1991");
    expect(loiToPrefix("AR 12/06/2024")).toBe("12_06_2024");
    expect(loiToPrefix("")).toBeNull();
    expect(loiToPrefix(null)).toBeNull();
  });
});

describe("articleToRiolexId", () => {
  it("construit le slug cible", () => {
    expect(articleToRiolexId("25_11_1991", "84")).toBe("25_11_1991-1-art_84");
    expect(articleToRiolexId("25_11_1991", "75TER")).toBe("25_11_1991-1-art_75ter");
  });
});

describe("linkifyRefs", () => {
  const all = new Set(["25_11_1991-1-art_36", "25_11_1991-1-art_71", "26_11_1991-1-art_15"]);
  const ctx: RefContext = {
    currentPrefix: "25_11_1991",
    exists: (id) => all.has(id),
  };

  function link(text: string) {
    return linkifyRefs(parseInline(text), ctx);
  }

  it("relie un renvoi non qualifié à la loi courante", () => {
    const segs = link("comme prévu à l'article 36 du présent arrêté");
    const ref = segs.find((s) => s.t === "ref");
    expect(ref).toMatchObject({ t: "ref", riolexId: "25_11_1991-1-art_36" });
  });

  it("ne relie pas un renvoi vers une autre loi", () => {
    const segs = link("visé à l'article 15 de la loi du 25 avril 1963");
    expect(segs.some((s) => s.t === "ref")).toBe(false);
    // le texte reste intact
    expect(segs.map((s) => (s.t === "text" ? s.text : "")).join("")).toContain("article 15");
  });

  it("résout « de l'arrêté royal » vers l'AR principal", () => {
    const segs = link("conformément à l'article 71 de l'arrêté royal");
    expect(segs.find((s) => s.t === "ref")).toMatchObject({
      riolexId: "25_11_1991-1-art_71",
    });
  });

  it("ne relie pas une fiche inexistante", () => {
    const segs = link("voir l'article 999");
    expect(segs.some((s) => s.t === "ref")).toBe(false);
  });

  it("laisse passer les amendements sans les casser", () => {
    const segs = link("l'article 36 (AR 30.7.2022 - MB 23.8 - EV 1.10)");
    expect(segs.some((s) => s.t === "ref")).toBe(true);
    expect(segs.some((s) => s.t === "amendment")).toBe(true);
  });

  it("linkifyCrossRefs relie « AR art. N » / « AM art. N » du VOIR AUSSI", () => {
    const exists = (id: string) =>
      id === "25_11_1991-1-art_71" || id === "26_11_1991-1-art_15";
    const segs = linkifyCrossRefs("Voir AR art. 71 et AM art. 15", exists);
    const refs = segs.filter((s) => s.t === "ref");
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({ riolexId: "25_11_1991-1-art_71" });
    expect(refs[1]).toMatchObject({ riolexId: "26_11_1991-1-art_15" });
  });

  it("collectRefTargets retourne les cibles uniques résolues", () => {
    const targets = collectRefTargets(
      "voir l'article 36 et l'article 71, mais pas l'article 15 de la loi du 25 avril 1963",
      ctx,
    );
    expect(targets.sort()).toEqual([
      "25_11_1991-1-art_36",
      "25_11_1991-1-art_71",
    ]);
  });
});
