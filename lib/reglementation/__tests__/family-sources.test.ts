import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type RiolexArticle = {
  riolexId: string;
  url?: string;
  version?: string;
  texte?: string;
  commentaireOnem?: string;
  commentaireTronque?: boolean;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as T;
}

describe("sources familiales Article 110", () => {
  it("conserve le commentaire historique séparé et ajoute une norme consolidée traçable", () => {
    const historical = readJson<{ articles: RiolexArticle[] }>(
      "private/riolex/staging/articles-b300.json",
    ).articles.find((article) => article.riolexId === "25_11_1991-1-art_110");
    const current = readJson<{ articles: RiolexArticle[] }>(
      "private/riolex/staging/articles-family-2026.json",
    ).articles.find((article) => article.riolexId === "25_11_1991-1-art_110");

    expect(historical?.commentaireOnem).toBeTruthy();
    expect(historical?.commentaireTronque).toBe(true);
    expect(current).toMatchObject({
      version: "Justel consolidé au 18/06/2026",
      url: "https://www.ejustice.just.fgov.be/eli/arrete/1991/11/25/1991013192/justel",
    });
    expect(current?.commentaireOnem).toBe("");
    expect(current?.texte).toContain("§ 3. Par travailleur cohabitant");
  });

  it("préserve le pont Article 110 vers la table Lookup d'indemnisation", () => {
    const refs = readJson<Record<string, Array<{ tableSlug: string; code: string }>>>(
      "lib/data/riolex-lookup-refs.json",
    )["25_11_1991-1-art_110"];

    expect(refs).toEqual(expect.arrayContaining([
      expect.objectContaining({ tableSlug: "s04-s36-article-indemnisation", code: "110&1A" }),
      expect.objectContaining({ tableSlug: "s04-s36-article-indemnisation", code: "110&1M", label: "Revenu enfant neutralisé" }),
      expect.objectContaining({ tableSlug: "s04-s36-article-indemnisation", code: "110&1V" }),
      expect.objectContaining({ tableSlug: "s04-s36-article-indemnisation", code: "110&2" }),
      expect.objectContaining({ tableSlug: "s04-s36-article-indemnisation", code: "110&3" }),
    ]));
  });
});
