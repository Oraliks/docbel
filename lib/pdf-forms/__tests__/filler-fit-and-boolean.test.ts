import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFTextField } from "pdf-lib";
import { fillForm } from "../filler";
import type { PdfFormField } from "../types";

/// Ce que le PDF affiche RÉELLEMENT, mesuré sur les documents officiels.
///
/// Deux défauts corrigés le 2026-07-26, tous deux invisibles côté code et
/// visibles seulement sur le papier envoyé à l'ONEM :
///
///   1. Un texte plus large que sa case n'était pas réduit — pdf-lib pose une
///      clôture de découpe et le coupe en plein glyphe. À 10 pt, TOUTE date
///      `DD/MM/YYYY` débordait des colonnes de la grille cohabitants, et
///      « Époux/se » — le lien de parenté le plus fréquent — aussi.
///   2. Un booléen posé sur un widget TEXTE imprimait le mot « true ».
///
/// Les tests confrontent les vrais PDF de `private/pdfs/`, pas des documents
/// synthétiques : c'est la géométrie officielle qui fait foi.

const PDF_DIR = join(process.cwd(), "private", "pdfs");

function realPdf(name: string): Buffer | null {
  const p = join(PDF_DIR, name);
  return existsSync(p) ? readFileSync(p) : null;
}

/// Taille de police effectivement inscrite dans l'apparence du widget.
async function fontSizeOf(bytes: Buffer, widget: string): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  const da = doc.getForm().getField(widget).acroField.getDefaultAppearance() ?? "";
  const m = da.match(/\/\S+\s+([\d.]+)\s+Tf/);
  if (!m) throw new Error(`aucun opérateur Tf dans le DA de « ${widget} » : ${da}`);
  return Number(m[1]);
}

async function textOf(bytes: Buffer, widget: string): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const f = doc.getForm().getField(widget);
  if (!(f instanceof PDFTextField)) throw new Error(`« ${widget} » n'est pas un champ texte`);
  return f.getText() ?? "";
}

async function widgetWidth(source: Buffer, widget: string): Promise<number> {
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });
  return doc.getForm().getField(widget).acroField.getWidgets()[0].getRectangle().width;
}

describe("filler — le texte tient dans la case (PDF réels)", () => {
  const c1 = realPdf("C1_FR.pdf");
  const skip = c1 ? it : it.skip;

  skip("réduit la police d'une date qui déborde de la colonne « date de naissance »", async () => {
    const fields: PdfFormField[] = [
      {
        id: "dateNaissanceCohab",
        pdfFieldName: "Personne1_DateNaissance",
        type: "date",
        required: false,
        label: { fr: "Date de naissance" },
      },
    ];
    const { bytes } = await fillForm(c1!, fields, { dateNaissanceCohab: "1985-06-12" }, { flatten: false });

    expect(await textOf(bytes, "Personne1_DateNaissance")).toBe("12/06/1985");
    // La case fait ~51 pt utiles, la date en fait 58 à 10 pt : sans réduction
    // elle sortait coupée. On exige une police strictement plus petite que la
    // taille uniforme, et jamais nulle (0 = auto-fit délégué au lecteur, ce
    // n'est pas ce qu'on veut ici).
    const size = await fontSizeOf(bytes, "Personne1_DateNaissance");
    expect(size).toBeLessThan(10);
    expect(size).toBeGreaterThan(0);
  });

  skip("réduit la police du lien de parenté le plus fréquent (« Époux/se »)", async () => {
    const fields: PdfFormField[] = [
      {
        id: "lien",
        pdfFieldName: "Personne1_LienParente_Ligne1",
        type: "select",
        required: false,
        label: { fr: "Lien de parenté" },
        options: [{ value: "epoux", label: { fr: "Époux/se" } }],
        stampMap: { epoux: "Époux/se" },
      },
    ];
    const { bytes } = await fillForm(c1!, fields, { lien: "epoux" }, { flatten: false });

    expect(await textOf(bytes, "Personne1_LienParente_Ligne1")).toBe("Époux/se");
    expect(await fontSizeOf(bytes, "Personne1_LienParente_Ligne1")).toBeLessThan(10);
  });

  skip("garde la taille uniforme quand le texte tient déjà", async () => {
    const fields: PdfFormField[] = [
      {
        id: "nom",
        pdfFieldName: "Nom",
        type: "text",
        required: false,
        label: { fr: "Nom" },
      },
    ];
    const { bytes } = await fillForm(c1!, fields, { nom: "Dupont" }, { flatten: false });
    expect(await fontSizeOf(bytes, "Nom")).toBe(10);
  });

  skip("un nom composé tient dans « NomPrenom » (chemin des règles serveur)", async () => {
    const NOM = "Jean-Baptiste Vandenberghe";
    const { bytes } = await fillForm(
      c1!,
      [],
      {},
      { flatten: false, extraStamps: new Map([["NomPrenom", NOM]]) }
    );

    expect(await textOf(bytes, "NomPrenom")).toBe(NOM);
    // Le chemin `extraStamps` forçait 10 pt sans condition — un nom composé
    // (128 pt) débordait d'une case de 121 pt.
    const size = await fontSizeOf(bytes, "NomPrenom");
    expect(size).toBeLessThan(10);

    // Vérification directe : à cette taille, le texte tient vraiment.
    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont("Helvetica");
    expect(font.widthOfTextAtSize(NOM, size)).toBeLessThanOrEqual(await widgetWidth(c1!, "NomPrenom"));
  });
});

describe("filler — un booléen n'imprime jamais « true »", () => {
  const c1c = realPdf("C1C_FR.pdf");
  const skip = c1c ? it : it.skip;

  /// Le widget d'affirmation du C1C est un CHAMP TEXTE dans le PDF officiel,
  /// alors que le seed déclare le champ en `checkbox`. Chaque C1C généré
  /// portait donc le mot « true » au milieu de la phrase « J'affirme sur
  /// l'honneur que la présente déclaration est sincère et complète ».
  const AFFIRMATION = "je communiquerai toute modification à mon organisme de paiement";

  skip("imprime « X » pour une case cochée posée sur un widget texte", async () => {
    const fields: PdfFormField[] = [
      {
        id: "affirmation",
        pdfFieldName: AFFIRMATION,
        type: "checkbox",
        required: true,
        label: { fr: "J'affirme sur l'honneur…" },
      },
    ];
    const { bytes } = await fillForm(c1c!, fields, { affirmation: true }, { flatten: false });

    const printed = await textOf(bytes, AFFIRMATION);
    expect(printed).toBe("X");
    expect(printed).not.toBe("true");
  });

  skip("n'imprime rien pour une case décochée", async () => {
    const fields: PdfFormField[] = [
      {
        id: "affirmation",
        pdfFieldName: AFFIRMATION,
        type: "checkbox",
        required: false,
        label: { fr: "J'affirme sur l'honneur…" },
      },
    ];
    const { bytes } = await fillForm(c1c!, fields, { affirmation: false }, { flatten: false });
    expect(await textOf(bytes, AFFIRMATION)).toBe("");
  });
});

describe("filler — les listes déroulantes s'ajustent aussi", () => {
  const c1 = realPdf("C1_FR.pdf");
  const skip = c1 ? it : it.skip;

  skip("réduit « Employé » qui ne tient pas dans la colonne d'activité", async () => {
    // Les dropdowns gardaient la taille du gabarit (12 pt) sans le moindre
    // ajustement : « Employé » demandait 52 pt dans une colonne de 43.
    const fields: PdfFormField[] = [
      {
        id: "typeRevenu",
        pdfFieldName: "Personne1_ActiviteProfessionnelle_Type",
        type: "select",
        required: false,
        label: { fr: "Type de revenu" },
        options: [{ value: "salarie-employe", label: { fr: "Employé" } }],
      },
    ];
    const { bytes } = await fillForm(c1!, fields, { typeRevenu: "salarie-employe" }, { flatten: false });

    const size = await fontSizeOf(bytes, "Personne1_ActiviteProfessionnelle_Type");
    expect(size).toBeLessThan(12);
    expect(size).toBeGreaterThan(0);
  });
});

describe("filler — stampMap sur une liste déroulante", () => {
  const c1 = realPdf("C1_FR.pdf");
  const skip = c1 ? it : it.skip;

  /// `stampMap` existe pour imprimer autre chose que le libellé de l'écran.
  /// La branche dropdown l'ignorait : elle résolvait toujours via `options`.
  /// Piège silencieux — poser un stampMap semblait simplement sans effet.
  skip("imprime le libellé court, pas celui de l'écran", async () => {
    const fields: PdfFormField[] = [
      {
        id: "revenuRemplacement",
        pdfFieldName: "Personne1_RevenuRemplacement_Type",
        type: "select",
        required: false,
        label: { fr: "Revenu de remplacement" },
        options: [{ value: "mutuelle", label: { fr: "Mutuelle (maladie-invalidité)" } }],
        stampMap: { mutuelle: "Mutuelle" },
      },
    ];
    const { bytes } = await fillForm(c1!, fields, { revenuRemplacement: "mutuelle" }, { flatten: false });

    const doc = await PDFDocument.load(bytes);
    const champ = doc.getForm().getDropdown("Personne1_RevenuRemplacement_Type");
    expect(champ.getSelected()).toEqual(["Mutuelle"]);
    // Le libellé long ne tenait pas : 172 pt dans une colonne de 46, même au
    // plancher de 5 pt il en fallait encore 72.
    expect(champ.getSelected()[0]).not.toContain("maladie-invalidité");
  });
});

describe("filler — séparateur décimal belge", () => {
  const c1 = realPdf("C1_FR.pdf");
  const skip = c1 ? it : it.skip;

  function montant(id: string, widget: string): PdfFormField {
    return { id, pdfFieldName: widget, type: "number", required: false, label: { fr: id } };
  }

  const W = "Personne1_ActiviteProfessionnelle_Montant";

  skip("imprime la virgule, pas le point", async () => {
    // `String(2450.75)` donne « 2450.75 » — convention anglo-saxonne, qui n'a
    // rien à faire sur un formulaire officiel belge. L'aide du champ écrit
    // elle-même « 999999,99 € ».
    const { bytes } = await fillForm(c1!, [montant("m", W)], { m: 2450.75 }, { flatten: false });
    expect(await textOf(bytes, W)).toBe("2450,75");
  });

  skip("ne complète pas les décimales d'un montant entier", async () => {
    // Un citoyen qui déclare « 1610 » doit voir « 1610 » : on corrige un
    // séparateur, on ne réécrit pas sa saisie.
    const { bytes } = await fillForm(c1!, [montant("m", W)], { m: 1610 }, { flatten: false });
    expect(await textOf(bytes, W)).toBe("1610");
  });

  skip("laisse intacte une valeur qui n'est pas un nombre simple", async () => {
    // Garde-fou : une valeur inattendue ne doit jamais être réécrite à
    // l'aveugle sur un document officiel.
    const { bytes } = await fillForm(c1!, [montant("m", W)], { m: "1.234.567" }, { flatten: false });
    expect(await textOf(bytes, W)).toBe("1.234.567");
  });

  skip("n'affecte pas les autres types (l'IBAN garde son traitement)", async () => {
    const fields: PdfFormField[] = [
      { id: "iban", pdfFieldName: "Nom", type: "iban", required: false, label: { fr: "IBAN" } },
    ];
    const { bytes } = await fillForm(c1!, fields, { iban: "BE68539007547034" }, { flatten: false });
    expect(await textOf(bytes, "Nom")).toBe("68539007547034");
  });
});
