import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFStream, PDFRawStream, PDFName } from "pdf-lib";
import { fillForm } from "../filler";
import type { PdfFormField } from "../types";

/// Ce que le PDF DESSINE vraiment, pas ce que le code croit avoir écrit.
///
/// Le mode de panne corrigé ici ne produit ni exception ni valeur fausse :
/// fontkit mappe un caractère absent sur le glyphe 0, dont le contour est vide
/// dans la police. Le champ contient la bonne chaîne, `unicodeFont` vaut `true`,
/// et la case part BLANCHE. Aucune assertion sur le payload ou sur le retour de
/// `fillForm` ne peut le voir — il faut lire le flux d'apparence.
///
/// D'où ces tests : ils décompressent l'apparence du widget et regardent quelle
/// police a servi et quels identifiants de glyphes ont été émis. `<0000…>` =
/// des `.notdef`, donc du vide.

const C1 = join(process.cwd(), "private", "pdfs", "C1_FR.pdf");
const source = existsSync(C1) ? readFileSync(C1) : null;
const skip = source ? it : it.skip;

function champ(id: string, widget: string): PdfFormField {
  return { id, pdfFieldName: widget, type: "text", required: false, label: { fr: id } };
}

/// Police et glyphes réellement émis pour un widget donné.
async function rendu(bytes: Buffer, widget: string): Promise<{ police: string; glyphes: string }> {
  const doc = await PDFDocument.load(bytes);
  const objet = doc.context.lookup(
    doc.getForm().getField(widget).acroField.getWidgets()[0].getNormalAppearance()
  );
  if (!(objet instanceof PDFStream)) throw new Error("apparence absente pour " + widget);

  let brut = objet instanceof PDFRawStream ? Buffer.from(objet.contents) : Buffer.from(objet.getContents());
  if ((objet.dict.get(PDFName.of("Filter"))?.toString() ?? "").includes("FlateDecode")) {
    brut = inflateSync(brut);
  }
  const m = brut
    .toString("latin1")
    .match(/\/(\S+)\s+[\d.]+\s+Tf[\s\S]{0,80}?<([0-9A-Fa-f]*)>\s*Tj/);
  if (!m) throw new Error("aucun texte dessiné dans l'apparence de " + widget);
  return { police: m[1], glyphes: m[2] };
}

/// Vrai si TOUS les glyphes émis sont des `.notdef` — autrement dit si la case
/// est visuellement vide malgré une valeur correcte dans le champ.
function toutEnBlanc(glyphes: string): boolean {
  return glyphes.length > 0 && /^0+$/.test(glyphes);
}

describe("filler — repli de police pour les noms non latins", () => {
  skip("un nom cyrillique est réellement dessiné, plus blanc", async () => {
    const { bytes, diagnostics } = await fillForm(
      source!,
      [champ("nom", "Nom")],
      { nom: "Владимиров" },
      { flatten: false }
    );
    const { police, glyphes } = await rendu(bytes, "Nom");

    expect(police).toMatch(/Noto/i);
    expect(toutEnBlanc(glyphes)).toBe(false);
    expect(diagnostics).toEqual([]);
  });

  skip("un nom grec aussi", async () => {
    const { bytes, diagnostics } = await fillForm(
      source!,
      [champ("nom", "Nom")],
      { nom: "Παπαδόπουλος" },
      { flatten: false }
    );
    const { police, glyphes } = await rendu(bytes, "Nom");

    expect(police).toMatch(/Noto/i);
    expect(toutEnBlanc(glyphes)).toBe(false);
    expect(diagnostics).toEqual([]);
  });

  skip("un nom latin garde la police d'origine — aucun document existant ne change", async () => {
    // Le point le plus important du lot : le repli COMPLÈTE la police
    // principale, il ne la remplace pas. Un dossier belge courant doit sortir
    // exactement comme avant, à la typographie près comme au pixel près.
    const { bytes } = await fillForm(
      source!,
      [champ("nom", "Nom")],
      { nom: "Lemaître-Ștefănescu" },
      { flatten: false }
    );
    const { police, glyphes } = await rendu(bytes, "Nom");

    expect(police).toMatch(/DejaVu/i);
    expect(toutEnBlanc(glyphes)).toBe(false);
  });

  skip("une écriture non couverte reste signalée plutôt que silencieuse", async () => {
    // Le chinois demande un fichier Noto séparé de ~16 Mo, écarté. Il ne doit
    // pas pour autant redevenir invisible : la case sortira blanche, mais avec
    // une trace.
    const { bytes, diagnostics } = await fillForm(
      source!,
      [champ("nom", "Nom")],
      { nom: "李伟" },
      { flatten: false }
    );
    const { glyphes } = await rendu(bytes, "Nom");

    expect(toutEnBlanc(glyphes)).toBe(true);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ fieldId: "nom", kind: "caracteres-non-rendus" });
  });

  skip("le repli s'applique aussi aux lignes de grille", async () => {
    // Un cohabitant a un nom lui aussi. Le pré-contrôle doit descendre dans les
    // lignes, sinon seul le titulaire du dossier bénéficie du correctif.
    const grille: PdfFormField = {
      id: "cohabitants",
      pdfFieldName: "",
      type: "array",
      required: false,
      label: { fr: "Cohabitants" },
      maxRows: 5,
      itemFields: [
        {
          id: "nom",
          pdfFieldName: "",
          pdfFieldNameTemplate: "Personne{index}_Nom",
          type: "text",
          required: false,
          label: { fr: "Nom" },
        },
      ],
    };
    const { bytes, diagnostics } = await fillForm(
      source!,
      [grille],
      { cohabitants: [{ nom: "Παπαδόπουλος" }] },
      { flatten: false }
    );

    expect(diagnostics).toEqual([]);
    const { police, glyphes } = await rendu(bytes, "Personne1_Nom");
    expect(police).toMatch(/Noto/i);
    expect(toutEnBlanc(glyphes)).toBe(false);
  });
});
