// Un champ `autoAnswered` porte une valeur METIER produite ailleurs (motif
// d'introduction du C1 piloté par les chips, remarque de situation familiale
// calculée au submit). Le contrat de `PdfFormField.autoAnswered` (types.ts)
// dit : jamais rendu à l'écran, mais SERIALISE ET SOUMIS normalement.
//
// `buildValidator` l'excluait totalement du schéma Zod — et `z.object`
// STRIPPE toute clé absente du shape. Sa valeur disparaissait donc de
// `result.data`, c'est-à-dire de ce que la route /generate passe au filler ET
// persiste dans `payloads[form.id]` : déclaration officielle amputée, et
// identité perdue même en régénérant le PDF.
//
// Ces tests fixent les QUATRE propriétés simultanées attendues :
//   1. la valeur traverse la validation INTACTE ;
//   2. un champ auto vide ne déclenche jamais l'erreur « obligatoire » ;
//   3. le champ n'apparaît ni dans les étapes ni dans le compteur ;
//   4. la valeur arrive bien jusqu'au papier (case non blanche).

import { describe, it, expect } from "vitest";
import { PDFDocument, PDFCheckBox, PDFTextField } from "pdf-lib";
import { buildValidator, countRequirements, validateStepFields } from "../validation";
import { buildSteps } from "../build-steps";
import { fillForm } from "../filler";
import type { PdfFormField, FormPayload } from "../types";
import type { PublicField } from "../public-serializer";

function field(p: Partial<PdfFormField> & Pick<PdfFormField, "id" | "type">): PdfFormField {
  return { pdfFieldName: p.id, required: false, label: { fr: p.id }, ...p } as PdfFormField;
}

describe("autoAnswered — la valeur traverse la validation", () => {
  it("survit à safeParse au lieu d'être strippée (bug de fond)", () => {
    const fields = [
      field({ id: "nomEtPrenom", type: "text", required: true, autoAnswered: true }),
      field({ id: "niss", type: "niss", required: true, autoAnswered: true }),
      field({ id: "autre", type: "text" }),
    ];
    const res = buildValidator(fields, "fr").safeParse({
      nomEtPrenom: "Dupont Jean",
      niss: "85073003328",
      autre: "coucou",
    });
    expect(res.success).toBe(true);
    // Avant le correctif : { autre: "coucou" } — les deux champs auto perdus.
    expect(res.success && res.data).toEqual({
      nomEtPrenom: "Dupont Jean",
      niss: "85073003328",
      autre: "coucou",
    });
  });

  it("motifIntroduction du C1 (radio requis + autoAnswered) garde sa valeur", () => {
    const motif = field({
      id: "motifIntroduction",
      type: "radio",
      required: true,
      autoAnswered: true,
      options: [
        { value: "modification", label: { fr: "Modification" } },
        { value: "changement-op", label: { fr: "Transfert" } },
      ],
    });
    const res = buildValidator([motif], "fr").safeParse({ motifIntroduction: "changement-op" });
    expect(res.success && res.data.motifIntroduction).toBe("changement-op");
  });

  it("une valeur non-scalaire (tableau, objet) passe telle quelle", () => {
    const fields = [field({ id: "lignes", type: "array", autoAnswered: true })];
    const res = buildValidator(fields, "fr").safeParse({ lignes: [{ nom: "Dupont" }] });
    expect(res.success && res.data.lignes).toEqual([{ nom: "Dupont" }]);
  });

  it("un champ auto ABSENT n'ajoute pas de clé fantôme au payload validé", () => {
    const fields = [
      field({ id: "remarque", type: "textarea", autoAnswered: true }),
      field({ id: "nom", type: "text" }),
    ];
    const res = buildValidator(fields, "fr").safeParse({ nom: "Dupont" });
    expect(res.success && "remarque" in res.data).toBe(false);
  });
});

describe("autoAnswered — jamais bloquant", () => {
  it("vide et pourtant `required` : aucune erreur « obligatoire »", () => {
    const fields = [
      field({ id: "motifIntroduction", type: "radio", required: true, autoAnswered: true }),
      field({ id: "remarque", type: "textarea", required: true, autoAnswered: true }),
    ];
    expect(buildValidator(fields, "fr").safeParse({}).success).toBe(true);
    expect(buildValidator(fields, "fr").safeParse({ motifIntroduction: "", remarque: "" }).success).toBe(true);
    expect(validateStepFields(fields, {}, "fr")).toEqual({});
  });

  it("une valeur MAL FORMÉE ne rejette pas l'envoi (règle permissive assumée)", () => {
    // Une date auto-remplie hors format ISO, un NISS auto tronqué : le citoyen
    // n'a AUCUN contrôle à l'écran pour corriger ça — poser une erreur ici
    // serait une impasse. Ces payloads passaient avant le correctif (champ
    // absent du schéma) et doivent continuer de passer.
    const fields = [
      field({ id: "dateAuto", type: "date", autoAnswered: true }),
      field({ id: "nissAuto", type: "niss", required: true, autoAnswered: true }),
      field({ id: "choixAuto", type: "select", autoAnswered: true, options: [{ value: "a", label: { fr: "A" } }] }),
    ];
    const res = buildValidator(fields, "fr").safeParse({
      dateAuto: "31/02/pas-une-date",
      nissAuto: "123",
      choixAuto: "valeur-hors-liste",
    });
    expect(res.success).toBe(true);
    expect(res.success && res.data.dateAuto).toBe("31/02/pas-une-date");
  });

  it("les champs NON auto restent validés normalement à côté", () => {
    const fields = [
      field({ id: "auto", type: "date", autoAnswered: true }),
      field({ id: "dateSaisie", type: "date", required: true }),
    ];
    const res = buildValidator(fields, "fr").safeParse({ auto: "n'importe quoi", dateSaisie: "pas-une-date" });
    expect(res.success).toBe(false);
    expect(res.success === false && res.error.issues.map((i) => i.path[0])).toEqual(["dateSaisie"]);
  });

  it("signature et date du jour restent HORS schéma (autorité serveur préservée)", () => {
    // Elles sont ré-injectées après la validation par `applyServerAutoFields` :
    // préserver la valeur du client les laisserait court-circuiter cette
    // autorité (le nom apposé sur le bloc de signature, notamment).
    const fields = [
      field({ id: "sig", type: "signature", required: true }),
      field({ id: "dateDoc", type: "date", required: true, prefillFrom: "system.today" }),
    ];
    const res = buildValidator(fields, "fr").safeParse({ sig: "Signé par le Roi", dateDoc: "1900-01-01" });
    expect(res.success).toBe(true);
    expect(res.success && res.data).toEqual({});
  });
});

describe("autoAnswered — invisible pour l'utilisateur", () => {
  it("n'apparaît dans aucune étape du stepper", () => {
    const fields = [
      { id: "motifIntroduction", type: "radio", required: true, autoAnswered: true, label: { fr: "Motif" }, section: "demande" },
      { id: "nom", type: "text", required: true, label: { fr: "Nom" }, section: "demande" },
    ] as unknown as PublicField[];
    const { coreSteps, optionalSections } = buildSteps(fields, {}, "fr", {
      fallbackTitle: "Informations",
      fallbackSubtitle: "",
    });
    const shown = [...coreSteps.flatMap((s) => s.fields), ...optionalSections.flatMap((s) => s.fields)];
    expect(shown.map((f) => f.id)).toEqual(["nom"]);
  });

  it("ne compte pas dans le compteur d'exigences de l'étape", () => {
    const fields = [
      field({ id: "motifIntroduction", type: "radio", required: true, autoAnswered: true }),
      field({ id: "nom", type: "text", required: true }),
    ];
    expect(countRequirements(fields, {}, "fr")).toEqual({ total: 1, missing: 1 });
    expect(countRequirements(fields, { nom: "Dupont" }, "fr")).toEqual({ total: 1, missing: 0 });
  });
});

describe("autoAnswered — bout en bout jusqu'au papier", () => {
  /// PDF minimal : une case à cocher (widget de motif) + un champ texte
  /// (widget de remarque), tous deux ciblés par des champs `autoAnswered`.
  async function makePdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 400]);
    const form = doc.getForm();
    form.createCheckBox("case_motif").addToPage(page, { x: 20, y: 300, width: 14, height: 14 });
    form.createTextField("remarques").addToPage(page, { x: 20, y: 250, width: 300, height: 20 });
    return Buffer.from(await doc.save());
  }

  it("la valeur validée arrive au filler : la case n'est plus blanche", async () => {
    const fields = [
      field({ id: "motifCoche", pdfFieldName: "case_motif", type: "checkbox", required: true, autoAnswered: true }),
      field({ id: "remarqueAuto", pdfFieldName: "remarques", type: "textarea", autoAnswered: true }),
    ];
    // Le chemin réel de la route /generate : safeParse PUIS filler sur data.
    const res = buildValidator(fields, "fr").safeParse({
      motifCoche: true,
      remarqueAuto: "cohousing",
    });
    expect(res.success).toBe(true);

    // Même geste que la route /generate : le filler reçoit `result.data`.
    const validated = (res.success ? res.data : {}) as FormPayload;
    const { bytes } = await fillForm(await makePdf(), fields, validated, { flatten: false });
    const acro = (await PDFDocument.load(bytes)).getForm();
    // Avant le correctif : case décochée et champ texte vide, parce que
    // `result.data` était `{}`.
    expect((acro.getField("case_motif") as PDFCheckBox).isChecked()).toBe(true);
    expect((acro.getField("remarques") as PDFTextField).getText()).toBe("cohousing");
  });
});
