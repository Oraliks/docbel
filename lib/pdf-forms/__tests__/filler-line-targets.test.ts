// Répartition `lineTargets` : un `textarea` unique (grilles horaires du C1A,
// "pendant les périodes suivantes" / "irrégulièrement, à savoir") réparti à
// la génération sur les lignes pointillées physiques du PDF officiel.
//
// Avant ce lot, chaque ligne pointillée était un champ numéroté distinct
// ("Période 1", "Période 2"…) — retour Oraliks : « juste un input plus grand
// en mode texte suffit et à toi d'adapter pour que sur la C1 ça apparaisse
// correctement ». Ce fichier vérifie le bout en bout sur le VRAI
// C1A_FR.pdf : le citoyen écrit dans UN champ, le texte se retrouve réparti
// sur les bonnes lignes, dans l'ordre, sans perte ni chevauchement.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFTextField } from "pdf-lib";
import { parsePdf } from "../acroform-parser";
import { applyC1AImprovements } from "../seed/c1a-fields";
import { fillForm } from "../filler";
import type { FormPayload } from "../types";

const C1A_PDF = join(process.cwd(), "private", "pdfs", "C1A_FR.pdf");

async function schema() {
  return applyC1AImprovements([]);
}

/// Relit un widget texte du PDF généré. `""` si jamais écrit (comportement
/// pdf-lib normal pour un champ AcroForm vierge du template officiel).
function texteDe(acro: ReturnType<PDFDocument["getForm"]>, widget: string): string {
  return (acro.getField(widget) as PDFTextField).getText() ?? "";
}

describe("fillForm — lineTargets (grilles horaires C1A, vrai PDF)", () => {
  it("une valeur longue se répartit sur les 4 lignes « périodes » de Q4, dans l'ordre, sans perte ni chevauchement", async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF)) skip();
    const fields = await schema();
    const source = readFileSync(C1A_PDF);
    const parsed = await parsePdf(source);

    // 60 mots courts : largement plus que ce que 4 lignes de ~210 pt utiles
    // peuvent contenir à la taille uniforme (10 pt) — force le repli sur
    // plusieurs cibles ET le débordement (fusion + réduction) sur la 4e.
    const mots = Array.from({ length: 60 }, (_, i) => `mot${i}`);
    const valeur = mots.join(" ");
    const payload: FormPayload = {
      aideIndependant: "oui",
      aideraPendantChomage: "oui",
      q4periode: "periodes",
      q4periodesTexte: valeur,
    };

    const { bytes, diagnostics } = await fillForm(source, fields, payload, {
      flatten: false,
      technicalSchema: parsed.fields,
    });
    expect(diagnostics.filter((d) => d.fieldId === "q4periodesTexte")).toEqual([]);

    const acro = (await PDFDocument.load(bytes)).getForm();
    const lignes = ["1", "2", "3", "4"].map((w) => texteDe(acro, w));

    // Aucun mot perdu, aucun dupliqué, ordre préservé : la concaténation des
    // 4 lignes (chacune re-scindée par mots) reconstruit exactement la
    // valeur d'origine.
    expect(lignes.flatMap((l) => l.split(/\s+/).filter(Boolean))).toEqual(mots);

    // La répartition a réellement eu lieu sur PLUSIEURS lignes (pas tout
    // entassé sur la 1re avec une police minuscule).
    expect(lignes[0].length).toBeLessThan(valeur.length);
    expect(lignes[1], "la 2e ligne doit être utilisée").not.toBe("");
    expect(lignes[3], "la 4e ligne (débordement fondu) doit être utilisée").not.toBe("");
  });

  it("une valeur courte tient sur la 1re ligne « périodes » de Q4 ; les cibles suivantes restent vides", async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF)) skip();
    const fields = await schema();
    const source = readFileSync(C1A_PDF);
    const parsed = await parsePdf(source);

    const payload: FormPayload = {
      aideIndependant: "oui",
      aideraPendantChomage: "oui",
      q4periode: "periodes",
      q4periodesTexte: "Juillet",
    };

    const { bytes, diagnostics } = await fillForm(source, fields, payload, {
      flatten: false,
      technicalSchema: parsed.fields,
    });
    expect(diagnostics.filter((d) => d.fieldId === "q4periodesTexte")).toEqual([]);

    const acro = (await PDFDocument.load(bytes)).getForm();
    expect(texteDe(acro, "1")).toBe("Juillet");
    expect(texteDe(acro, "2")).toBe("");
    expect(texteDe(acro, "3")).toBe("");
    expect(texteDe(acro, "4")).toBe("");
  });

  it("un saut de ligne explicite force le passage à la ligne suivante, même si la précédente avait de la place", async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF)) skip();
    const fields = await schema();
    const source = readFileSync(C1A_PDF);
    const parsed = await parsePdf(source);

    const payload: FormPayload = {
      aideIndependant: "oui",
      aideraPendantChomage: "oui",
      q4periode: "periodes",
      q4periodesTexte: "Premiere ligne\nDeuxieme ligne",
    };

    const { bytes } = await fillForm(source, fields, payload, {
      flatten: false,
      technicalSchema: parsed.fields,
    });

    const acro = (await PDFDocument.load(bytes)).getForm();
    expect(texteDe(acro, "1")).toBe("Premiere ligne");
    expect(texteDe(acro, "2")).toBe("Deuxieme ligne");
    expect(texteDe(acro, "3")).toBe("");
  });

  it("Q4 « irrégulièrement » (5 cibles, la 1re — « undefined » — est étroite) : aucun mot perdu", async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF)) skip();
    const fields = await schema();
    const source = readFileSync(C1A_PDF);
    const parsed = await parsePdf(source);

    const mots = Array.from({ length: 50 }, (_, i) => `x${i}`);
    const payload: FormPayload = {
      aideIndependant: "oui",
      aideraPendantChomage: "oui",
      q4periode: "irregulier",
      q4irregulierementTexte: mots.join(" "),
    };

    const { bytes, diagnostics } = await fillForm(source, fields, payload, {
      flatten: false,
      technicalSchema: parsed.fields,
    });
    expect(diagnostics.filter((d) => d.fieldId === "q4irregulierementTexte")).toEqual([]);

    const acro = (await PDFDocument.load(bytes)).getForm();
    const lignes = ["undefined", "1_2", "2_2", "3_2", "4_2"].map((w) => texteDe(acro, w));
    expect(lignes.flatMap((l) => l.split(/\s+/).filter(Boolean))).toEqual(mots);
  });

  it("Q18 « périodes » (1re cible en drawAt, les 3 suivantes sur widget) : pas de perte après la cible positionnelle", async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF)) skip();
    const fields = await schema();
    const source = readFileSync(C1A_PDF);
    const parsed = await parsePdf(source);

    // 3 sauts de ligne explicites : la 1re (drawAt, illisible par ce test —
    // page content, pas un champ AcroForm) reçoit "AAAA", les 3 lignes
    // suivantes (widgets réels) reçoivent chacune la leur.
    const payload: FormPayload = {
      autreActiviteAccessoire: "oui",
      exerceraPendantChomage: "oui",
      q18periode: "periodes",
      q18periodesTexte: "AAAA\nBBBB\nCCCC",
    };

    const { bytes, diagnostics } = await fillForm(source, fields, payload, {
      flatten: false,
      technicalSchema: parsed.fields,
    });
    expect(diagnostics.filter((d) => d.fieldId === "q18periodesTexte")).toEqual([]);
    // Le PDF doit rester chargeable et avoir grossi (le dessin positionnel de
    // la 1re ligne a bien ajouté du contenu), même si son texte ne se relit
    // pas comme un champ de formulaire.
    expect(bytes.length).toBeGreaterThan(source.length);

    const acro = (await PDFDocument.load(bytes)).getForm();
    expect(texteDe(acro, "2_3")).toBe("BBBB");
    expect(texteDe(acro, "3_3")).toBe("CCCC");
    expect(texteDe(acro, "4_3")).toBe("");
  });

  it("un champ visibleIf non satisfait n'écrit rien (branche non empruntée)", async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const fields = await schema();
    const source = readFileSync(C1A_PDF);
    const parsed = await parsePdf(source);

    // q4periode="irregulier" → periodesTexte (visibleIf periode=periodes)
    // n'est pas visible, même si une valeur traîne dans le payload (ex.
    // brouillon changé d'avis) : elle ne doit pas s'imprimer. "Variable"
    // tient largement dans la largeur (étroite, ~122 pt utiles) de la 1re
    // cible "irrégulièrement" : ce test porte sur la visibilité, pas sur le
    // repli par mots (couvert par les autres tests de ce fichier).
    const payload: FormPayload = {
      aideIndependant: "oui",
      aideraPendantChomage: "oui",
      q4periode: "irregulier",
      q4periodesTexte: "Ne doit pas apparaître",
      q4irregulierementTexte: "Variable",
    };

    const { bytes } = await fillForm(source, fields, payload, {
      flatten: false,
      technicalSchema: parsed.fields,
    });

    const acro = (await PDFDocument.load(bytes)).getForm();
    expect(texteDe(acro, "1")).toBe("");
    expect(texteDe(acro, "undefined")).toBe("Variable");
  });
});
