import { describe, expect, it } from "vitest";
import { getSectionHelp } from "../section-help";

describe("getSectionHelp", () => {
  it("renvoie un texte pour une section connue (demande)", () => {
    const help = getSectionHelp("demande", "fr");
    expect(help.body.length).toBeGreaterThan(0);
  });

  it("renvoie un texte de repli générique pour une section inconnue", () => {
    const help = getSectionHelp("section-jamais-vue-xyz", "fr");
    expect(help.body.length).toBeGreaterThan(0);
  });

  it("renvoie un texte de repli générique si la clé est absente", () => {
    const help = getSectionHelp(undefined, "fr");
    expect(help.body.length).toBeGreaterThan(0);
  });

  it("renvoie la traduction NL d'une section connue, distincte du FR", () => {
    const fr = getSectionHelp("identite", "fr");
    const nl = getSectionHelp("identite", "nl");
    expect(nl.body.length).toBeGreaterThan(0);
    expect(nl.title).not.toBe(fr.title);
  });

  it("renvoie la traduction DE d'une section connue, distincte du FR", () => {
    const fr = getSectionHelp("mode-paiement", "fr");
    const de = getSectionHelp("mode-paiement", "de");
    expect(de.body.length).toBeGreaterThan(0);
    expect(de.title).not.toBe(fr.title);
  });

  it("retombe sur le FR générique (jamais vide) pour NL/DE sur une section inconnue", () => {
    for (const lang of ["nl", "de"] as const) {
      const help = getSectionHelp("section-jamais-vue-xyz", lang);
      expect(help.body.length).toBeGreaterThan(0);
    }
  });
});
