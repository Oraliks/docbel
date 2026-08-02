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

/// La section « demande » est PARTAGÉE : le C1 y pose le motif du changement de
/// situation, le C47 y pose le cadre d'une demande d'inaptitude permanente. Le
/// texte d'aide, écrit pour le C1, s'affichait tel quel sur le C47 — un citoyen
/// déclarant une incapacité de travail de 33 % lisait « Indiquez la nature du
/// changement intervenu dans votre situation », avec pour exemples un mariage,
/// un déménagement ou une naissance (relevé le 2026-08-02).
describe("getSectionHelp — surcharge par formulaire", () => {
  it("garde le texte du C1 sur la section « demande »", () => {
    const c1 = getSectionHelp("demande", "fr", "c1-changement-situation");
    expect(c1.body).toContain("changement");
    // Contrôle négatif : sans slug, on obtient le même texte qu'avant.
    expect(getSectionHelp("demande", "fr").body).toBe(c1.body);
  });

  it("donne au C47 un texte qui parle de SA demande", () => {
    const c47 = getSectionHelp("demande", "fr", "c47");
    expect(c47.body).not.toBe(getSectionHelp("demande", "fr").body);
    expect(c47.body.toLowerCase()).toContain("inaptitude");
    // Les exemples du C1 (mariage, déménagement…) n'ont rien à faire ici.
    expect(JSON.stringify(c47.examples ?? [])).not.toContain("Mariage");
  });

  it("ignore une surcharge posée sur une AUTRE section du même formulaire", () => {
    // La surcharge est indexée par (slug, section) : l'identité du C47 garde le
    // texte commun, il n'y a pas de raison de le dupliquer.
    expect(getSectionHelp("identite", "fr", "c47").body).toBe(
      getSectionHelp("identite", "fr").body,
    );
  });

  it("traduit la surcharge en NL et DE", () => {
    for (const lang of ["nl", "de"] as const) {
      const help = getSectionHelp("demande", lang, "c47");
      expect(help.body.length).toBeGreaterThan(0);
      expect(help.body).not.toBe(getSectionHelp("demande", "fr", "c47").body);
    }
  });
});
