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
});
