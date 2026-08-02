// Ce que le citoyen ne voit plus ne doit pas s'imprimer — Y COMPRIS quand la
// question a disparu par RICOCHET.
//
// Le C1 pose « je paie une pension alimentaire » au seul isolé, puis, si la
// réponse est oui, « avez-vous le jugement en main ? ». Un citoyen qui répond
// aux deux PUIS revient déclarer qu'il cohabite ne voit plus ni l'une ni
// l'autre : la première parce que sa condition (`statutFamilial === "isole"`)
// est tombée, la seconde parce que SA condition porte sur la première.
//
// Le filler testait la visibilité champ par champ, contre le payload brut :
// `pensionAlimentaire` y valait toujours « oui », donc la sous-question passait
// pour visible et sa case s'imprimait. Le PDF sortait avec « je joins une
// copie » coché sous une rubrique « j'habite seul » qui, elle, n'était pas
// cochée — une pièce jointe annoncée à l'ONEM sans la déclaration qui la
// justifie (relevé à la relecture du C1 le 2026-08-02).
//
// `visiblePayload` connaissait déjà la bonne réponse : il itère jusqu'au point
// fixe et supprime en cascade. Le moteur de règles serveur s'en servait ; le
// filler, non. Ce fichier tient les deux bouts sur le VRAI C1_FR.pdf.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFCheckBox } from "pdf-lib";
import { parsePdf } from "../acroform-parser";
import { applyC1Improvements } from "../seed/c1-fields-improvements";
import { fillForm } from "../filler";
import type { FormPayload, PdfFormField } from "../types";

const C1 = join(process.cwd(), "private", "pdfs", "C1_FR.pdf");
const W_JOINS_COPIE = "je joins une copie";
const W_PENSION =
  "je paie une pension alimentaire en exécution dune décision judiciaire ou dun acte notarié 10";

/// Remplit le vrai C1 (sans aplatir, pour pouvoir relire l'état des cases) et
/// rend une fonction qui dit si une case est cochée.
async function cochees(payload: FormPayload): Promise<(widget: string) => boolean> {
  const source = readFileSync(C1);
  const parsed = await parsePdf(source);
  const fields = applyC1Improvements([], {
    defaultMotif: "modification",
    restrictMotifTo5Situations: true,
    technicalSchema: parsed.fields,
  }) as PdfFormField[];

  const { bytes } = await fillForm(source, fields, payload, {
    flatten: false,
    technicalSchema: parsed.fields,
  });

  const form = (await PDFDocument.load(bytes)).getForm();
  return (widget: string) => {
    const champ = form.getFieldMaybe(widget);
    return champ instanceof PDFCheckBox && champ.isChecked();
  };
}

// Ces tests lisent un PDF ONEM non versionné hors du dépôt de travail : on les
// saute proprement plutôt que de faire échouer une CI qui ne l'a pas.
const siPdf = existsSync(C1) ? describe : describe.skip;

siPdf("visibilité en cascade — le statut du jugement de pension alimentaire", () => {
  it("coche « je joins une copie » pour un isolé qui paie une pension", async () => {
    // Contrôle négatif d'abord : sans lui, un filtre trop large ferait passer
    // le test suivant sans jamais rien imprimer.
    const coche = await cochees({
      statutFamilial: "isole",
      pensionAlimentaire: "oui",
      statutJugementPensionAlimentaire: "en-main",
    });

    expect(coche(W_PENSION)).toBe(true);
    expect(coche(W_JOINS_COPIE)).toBe(true);
  });

  it("ne coche plus rien dès que le citoyen déclare cohabiter", async () => {
    // Le parcours réel : les deux réponses restent dans le state du runner, et
    // Zod ne les strippe pas — elles arrivent telles quelles au filler.
    const coche = await cochees({
      statutFamilial: "cohabite",
      cohabiteType: "menage-commun",
      pensionAlimentaire: "oui",
      statutJugementPensionAlimentaire: "en-main",
    });

    // La question de premier niveau tombait déjà correctement…
    expect(coche(W_PENSION)).toBe(false);
    // …c'est la sous-question qui survivait à la disparition de son parent.
    expect(coche(W_JOINS_COPIE)).toBe(false);
  });
}, 60_000);
