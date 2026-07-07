import { describe, it, expect } from "vitest";
import { PDFDocument, PDFTextField, PDFDropdown, PDFCheckBox } from "pdf-lib";
import { fillForm } from "../filler";
import type { PdfFormField } from "../types";

/// Construit un PDF minimal reproduisant les widgets cohabitants du C1 :
/// - 5 slots positionnels avec des widgets texte « N 1 » et « N 2 » (col 1).
/// - 1 widget texte « Identité » (partenaire / FAC unique).
/// - 1 dropdown « Allocation famille » (partenaire).
/// - 1 dropdown « Activité pro » (partenaire).
/// - 1 widget texte « Montant » (partenaire).
/// - 1 dropdown « Revenus rempl. » (partenaire).
/// - 2 checkboxes « C1Part 1ʳᵉ fois » et « C1Part inchangée » (partenaire).
async function makeCohabPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 600]);
  const form = doc.getForm();

  // 5 paires de widgets positionnels texte "N 1" / "N 2".
  for (let n = 1; n <= 5; n++) {
    const c1 = form.createTextField(`${n} 1`);
    c1.addToPage(page, { x: 20, y: 500 - n * 30, width: 100, height: 14 });
    const c2 = form.createTextField(`${n} 2`);
    c2.addToPage(page, { x: 20, y: 490 - n * 30, width: 100, height: 14 });
  }

  // Widgets uniques pour le bloc « partenaire » / FAC.
  const id = form.createTextField("Identité du partenaire ou de la personne à charge");
  id.addToPage(page, { x: 200, y: 100, width: 200, height: 14 });
  const af = form.createDropdown("Allocation familiale");
  af.setOptions(["oui", "non"]);
  af.addToPage(page, { x: 200, y: 120, width: 100, height: 14 });
  const ap = form.createDropdown("Activité professionnelle");
  ap.setOptions(["aucun", "salarie-employe", "salarie-ouvrier", "independant"]);
  ap.addToPage(page, { x: 200, y: 140, width: 100, height: 14 });
  const m = form.createTextField("Montant");
  m.addToPage(page, { x: 200, y: 160, width: 100, height: 14 });
  const rr = form.createDropdown("Revenus de remplacement");
  rr.setOptions(["aucun", "mutuelle", "cpas", "pension", "chomage", "autre"]);
  rr.addToPage(page, { x: 200, y: 180, width: 100, height: 14 });

  const c1First = form.createCheckBox(
    "Je le déclare pour la première fois ou je déclare une modification et je joins un FORMULAIRE C1PARTENAIRE"
  );
  c1First.addToPage(page, { x: 200, y: 60, width: 14, height: 14 });
  const c1Same = form.createCheckBox("Ma déclaration précédente sur le FORMULAIRE C1PARTENAIRE reste inchangée");
  c1Same.addToPage(page, { x: 250, y: 60, width: 14, height: 14 });

  return Buffer.from(await doc.save());
}

/// Schéma minimal `array` reflétant la mécanique des cohabitants C1. On garde
/// peu de sous-champs pour rester lisible — la couverture porte sur les deux
/// mécanismes : template par-ligne ET firstMatchMapping.
function cohabField(): PdfFormField {
  return {
    id: "cohabitants",
    pdfFieldName: "",
    type: "array",
    required: false,
    label: { fr: "Cohabitants" },
    maxRows: 5,
    firstMatchMapping: {
      where: { fieldId: "lien", value: "FAC" },
      fields: {
        prenom: "Identité du partenaire ou de la personne à charge",
        allocationsFamiliales: "Allocation familiale",
        typeRevenuPro: "Activité professionnelle",
        montantRevenuPro: "Montant",
        revenuRemplacement: "Revenus de remplacement",
        c1PartenaireStatus:
          "Je le déclare pour la première fois ou je déclare une modification et je joins un FORMULAIRE C1PARTENAIRE|Ma déclaration précédente sur le FORMULAIRE C1PARTENAIRE reste inchangée",
      },
    },
    itemFields: [
      {
        id: "prenom",
        pdfFieldName: "",
        type: "text",
        required: false,
        label: { fr: "Prénom" },
        pdfFieldNameTemplate: "{index} 1",
      },
      {
        id: "nom",
        pdfFieldName: "",
        type: "text",
        required: false,
        label: { fr: "Nom" },
        // Pas de template → ce sous-champ reste virtuel par ligne.
      },
      {
        id: "lien",
        pdfFieldName: "",
        type: "select",
        required: false,
        label: { fr: "Lien" },
      },
      {
        id: "dateNaissance",
        pdfFieldName: "",
        type: "date",
        required: false,
        label: { fr: "Date naiss." },
        pdfFieldNameTemplate: "{index} 2",
      },
      {
        id: "allocationsFamiliales",
        pdfFieldName: "",
        type: "select",
        required: false,
        label: { fr: "Alloc." },
      },
      {
        id: "typeRevenuPro",
        pdfFieldName: "",
        type: "select",
        required: false,
        label: { fr: "Type" },
      },
      {
        id: "montantRevenuPro",
        pdfFieldName: "",
        type: "number",
        required: false,
        label: { fr: "Montant" },
      },
      {
        id: "revenuRemplacement",
        pdfFieldName: "",
        type: "select",
        required: false,
        label: { fr: "Rev. rempl." },
      },
      {
        id: "c1PartenaireStatus",
        pdfFieldName: "",
        type: "radio",
        required: false,
        label: { fr: "C1P" },
        options: [
          { value: "premiere-fois", label: { fr: "Première fois" } },
          { value: "deja-declare", label: { fr: "Inchangée" } },
        ],
      },
    ],
  };
}

async function getText(pdf: Uint8Array, name: string): Promise<string> {
  const doc = await PDFDocument.load(pdf);
  const f = doc.getForm().getField(name);
  return (f as PDFTextField).getText() ?? "";
}

async function getDropdown(pdf: Uint8Array, name: string): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  const f = doc.getForm().getField(name);
  return (f as PDFDropdown).getSelected();
}

async function getCheck(pdf: Uint8Array, name: string): Promise<boolean> {
  const doc = await PDFDocument.load(pdf);
  const f = doc.getForm().getField(name);
  return (f as PDFCheckBox).isChecked();
}

describe("fillForm — array (cohabitants) avec pdfFieldNameTemplate", () => {
  it("stampe 2 lignes sur les widgets positionnels du slot 1 et 2", async () => {
    const pdf = await makeCohabPdf();
    const res = await fillForm(
      pdf,
      [cohabField()],
      {
        cohabitants: [
          { prenom: "Alice", nom: "Durand", lien: "NFAC", dateNaissance: "1990-01-15" },
          { prenom: "Bob", nom: "Martin", lien: "NFAC", dateNaissance: "1985-07-03" },
        ],
      },
      { flatten: false }
    );
    expect(await getText(res.bytes, "1 1")).toBe("Alice");
    // Dates reformatées ISO → FR au stamping (cf. formatDateFR dans filler.ts).
    expect(await getText(res.bytes, "1 2")).toBe("15/01/1990");
    expect(await getText(res.bytes, "2 1")).toBe("Bob");
    expect(await getText(res.bytes, "2 2")).toBe("03/07/1985");
    // Slots 3-5 jamais touchés → vides.
    expect(await getText(res.bytes, "3 1")).toBe("");
    expect(await getText(res.bytes, "5 2")).toBe("");
  });

  it("déverse la 1ʳᵉ ligne FAC sur les widgets partenaire", async () => {
    const pdf = await makeCohabPdf();
    const res = await fillForm(
      pdf,
      [cohabField()],
      {
        cohabitants: [
          {
            prenom: "Claire",
            nom: "Dupont",
            lien: "FAC",
            dateNaissance: "1992-04-10",
            allocationsFamiliales: "oui",
            typeRevenuPro: "salarie-employe",
            montantRevenuPro: 1800,
            revenuRemplacement: "aucun",
            c1PartenaireStatus: "premiere-fois",
          },
        ],
      },
      { flatten: false }
    );
    // Per-row reste actif : le slot 1 reçoit prénom + date.
    expect(await getText(res.bytes, "1 1")).toBe("Claire");
    expect(await getText(res.bytes, "1 2")).toBe("10/04/1992");
    // First-match : widgets partenaire renseignés.
    expect(await getText(res.bytes, "Identité du partenaire ou de la personne à charge")).toBe("Claire");
    expect(await getDropdown(res.bytes, "Allocation familiale")).toEqual(["oui"]);
    expect(await getDropdown(res.bytes, "Activité professionnelle")).toEqual(["salarie-employe"]);
    expect(await getText(res.bytes, "Montant")).toBe("1800");
    expect(await getDropdown(res.bytes, "Revenus de remplacement")).toEqual(["aucun"]);
    // C1-PARTENAIRE : « premiere-fois » coche la 1ʳᵉ case, décoche la 2ᵉ.
    expect(
      await getCheck(
        res.bytes,
        "Je le déclare pour la première fois ou je déclare une modification et je joins un FORMULAIRE C1PARTENAIRE"
      )
    ).toBe(true);
    expect(
      await getCheck(res.bytes, "Ma déclaration précédente sur le FORMULAIRE C1PARTENAIRE reste inchangée")
    ).toBe(false);
  });

  it("payload tableau vide → aucun stamping, pas d'erreur", async () => {
    const pdf = await makeCohabPdf();
    await expect(
      fillForm(pdf, [cohabField()], { cohabitants: [] }, { flatten: false })
    ).resolves.toBeDefined();
    const res = await fillForm(pdf, [cohabField()], { cohabitants: [] }, { flatten: false });
    expect(await getText(res.bytes, "1 1")).toBe("");
    expect(await getText(res.bytes, "Identité du partenaire ou de la personne à charge")).toBe("");
  });

  it("tronque silencieusement à maxRows (5) — lignes au-delà ignorées", async () => {
    const pdf = await makeCohabPdf();
    const rows = Array.from({ length: 8 }, (_, i) => ({
      prenom: `P${i + 1}`,
      nom: `N${i + 1}`,
      lien: "NFAC",
      dateNaissance: `2000-01-0${(i % 9) + 1}`,
    }));
    const res = await fillForm(pdf, [cohabField()], { cohabitants: rows }, { flatten: false });
    // Les 5 premiers slots sont remplis…
    expect(await getText(res.bytes, "1 1")).toBe("P1");
    expect(await getText(res.bytes, "5 1")).toBe("P5");
    // …et la 6ᵉ ligne n'a aucun widget cible (donc pas d'exception non plus).
    // On ne peut vérifier l'absence que par l'absence d'exception levée.
    expect(res.bytes.byteLength).toBeGreaterThan(0);
  });
});
