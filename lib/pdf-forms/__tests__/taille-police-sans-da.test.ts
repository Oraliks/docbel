// Un widget AcroForm sans `/DA` propre doit quand même recevoir la taille de
// police uniforme.
//
// `pdf-lib` refuse `setFontSize` sur un champ dépourvu de `/DA` (« No /DA
// (default appearance) entry found »), alors que l'AcroForm en porte un GLOBAL
// (`/Helv 0 Tf 0 g` sur les quinze PDF de `private/pdfs/`) dont la spec dit
// qu'il s'hérite. L'échec était avalé par un `catch {}` : la taille uniforme
// n'était pas posée et `updateAppearances` retombait sur l'auto-dimensionnement
// de pdf-lib.
//
// Mesuré sur un C46 généré avant correction : « Commission du travail des
// arts » sortait en 5 pt, entre deux voisins en 10 pt — sur la même rubrique,
// pour trois mandats du même formulaire. Quatre widgets de la famille sont
// dans ce cas (un par document : C1, C1C, C46, C1-Partenaire).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { applyC46Improvements } from "../seed/c46-fields";
import { fillForm } from "../filler";
import { parsePdf } from "../acroform-parser";

const C46_PDF = join(process.cwd(), "private", "pdfs", "C46_FR.pdf");

/// Le widget sans `/DA` du C46 (vérifié à pypdf sur le fichier source).
const WIDGET_SANS_DA = "lorganismes suivants";
/// Un voisin qui, lui, porte son `/DA` — le témoin.
const WIDGET_TEMOIN = "Moniteur Belge du";

describe("taille de police sur un widget sans /DA", () => {
  it("le C46 a bien un widget sans /DA propre (sinon ce test ne prouve rien)", async ({ skip }) => {
    if (!existsSync(C46_PDF)) skip();
    const doc = await PDFDocument.load(readFileSync(C46_PDF), { ignoreEncryption: true });
    const form = doc.getForm();
    expect(form.getField(WIDGET_SANS_DA).acroField.getDefaultAppearance()).toBeUndefined();
    expect(form.getField(WIDGET_TEMOIN).acroField.getDefaultAppearance()).toBeTruthy();
  });

  it("reçoit la même taille que ses voisins une fois rempli", async ({ skip }) => {
    if (!existsSync(C46_PDF)) skip();
    const source = readFileSync(C46_PDF);
    const parsed = await parsePdf(source);
    const fields = applyC46Improvements([]);

    // Deux lignes d'organisme de longueur comparable, sur deux widgets dont un
    // seul porte un `/DA`. Sans flatten : les champs restent lisibles.
    const { bytes } = await fillForm(
      source,
      fields,
      { organisme1: "Commission du travail des arts", organisme2: "Conseil de la Musique" },
      { flatten: false, technicalSchema: parsed.fields }
    );

    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = doc.getForm();
    const taille = (nom: string) => {
      const da = form.getField(nom).acroField.getDefaultAppearance() ?? "";
      const m = /(\d+(?:\.\d+)?)\s+Tf/.exec(da);
      return m ? Number(m[1]) : null;
    };

    expect(taille(WIDGET_TEMOIN), "le témoin doit porter la taille uniforme").toBe(10);
    expect(
      taille(WIDGET_SANS_DA),
      "un widget sans /DA doit recevoir la MÊME taille que son voisin, pas l'auto-dimensionnement"
    ).toBe(10);
  });
});
