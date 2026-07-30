// Test de bout en bout sur le PDF officiel du C1A pour le défaut signalé par
// Oraliks le 2026-07-30 : la case « date » (widget AUJOURD'HUI) recevait le
// bloc de signature (double signature imprimée, date jamais tamponnée) au
// lieu de la date du jour.
//
// Cause réelle : `isSignatureField` (auto-fields.ts) retombe sur une
// heuristique de LIBELLÉ quand aucun `type: "signature"` explicite n'est
// posé — et le champ `dateSignature` du C1A porte le libellé « Date de
// signature », qui satisfait cette heuristique à tort. Le filler traitait
// alors ce widget-DATE comme une signature : il l'apposait avec le bloc
// « Signé numériquement par… » au lieu d'y écrire le jour, PENDANT que le
// vrai widget de signature recevait aussi le sien — d'où les deux blocs
// constatés et aucune date. Cf. .superpowers/sdd/signature-entete-p2-report.md.
import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFPage, PDFTextField } from "pdf-lib";
import type { PDFPageDrawTextOptions } from "pdf-lib";
import { applyC1AImprovements } from "../seed/c1a-fields";
import { fillForm } from "../filler";
import { parsePdf } from "../acroform-parser";
import type { FormPayload } from "../types";

const C1A_PDF = join(process.cwd(), "private", "pdfs", "C1A_FR.pdf");

interface AppelDrawText {
  text: string;
  x: number;
  y: number;
}

/// Espionne `PDFPage.prototype.drawText` pendant un `fillForm` réel sur le PDF
/// officiel, puis rend l'appel d'origine pour que le PDF produit reste valide
/// — même technique que `c1a-drawat-geometry.test.ts` (peigne BCE).
async function remplirEtCapturer(
  payload: FormPayload
): Promise<{ bytes: Uint8Array; appels: AppelDrawText[]; diagnostics: unknown[] }> {
  const source = readFileSync(C1A_PDF);
  const parsed = await parsePdf(source);
  const fields = applyC1AImprovements([]);

  const appels: AppelDrawText[] = [];
  const original = PDFPage.prototype.drawText;
  const spy = vi
    .spyOn(PDFPage.prototype, "drawText")
    .mockImplementation(function (this: PDFPage, text: string, options?: PDFPageDrawTextOptions) {
      appels.push({ text, x: options?.x ?? NaN, y: options?.y ?? NaN });
      return original.call(this, text, options);
    });
  try {
    const { bytes, diagnostics } = await fillForm(source, fields, payload, {
      flatten: false,
      technicalSchema: parsed.fields,
    });
    return { bytes, appels, diagnostics };
  } finally {
    spy.mockRestore();
  }
}

/// Rectangle (repère PDF natif, origine bas-gauche) du widget UNIQUE nommé —
/// "AUJOURD'HUI" et "Signature42" ne portent qu'un seul widget chacun
/// (contrairement à "1_3"/"TVA", partagés — cf. c1a-drawat-geometry.test.ts).
async function rectDuWidget(source: Buffer, fieldName: string) {
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });
  const r = doc.getForm().getField(fieldName).acroField.getWidgets()[0].getRectangle();
  return { x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height };
}

describe("C1A - la case date (AUJOURD'HUI) ne recoit plus le bloc de signature", () => {
  const PAYLOAD: FormPayload = {
    nomEtPrenom: { first: "Jean", last: "Dupont" },
    // Valeurs telles qu'injectées par `applyServerAutoFields` juste avant la
    // génération (cf. auto-fields.ts) — pas besoin de le ré-invoquer ici, le
    // défaut vit entièrement dans `filler.ts`/`isSignatureField`.
    dateSignature: "2026-07-30",
    signature: "confirmed",
  };

  it("le widget AUJOURD'HUI recoit la date du jour formatee DD/MM/AAAA, pas une valeur videe", async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const { bytes, diagnostics } = await remplirEtCapturer(PAYLOAD);
    expect(diagnostics).toEqual([]);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const champ = doc.getForm().getField("AUJOURD'HUI");
    expect(champ).toBeInstanceOf(PDFTextField);
    // Avant correction, `isSignatureField` attrapait ce champ (libellé "Date
    // de signature") et le filler le VIDAIT (`setText("")`) avant d'y dessiner
    // le bloc de signature en overlay — la valeur du widget restait vide.
    // Vérifié RED sans le correctif : `getText()` renvoyait `undefined`.
    expect((champ as PDFTextField).getText()).toBe("30/07/2026");
  });

  it("aucun texte ne se dessine par-dessus le rectangle du widget AUJOURD'HUI", async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const source = readFileSync(C1A_PDF);
    const rect = await rectDuWidget(source, "AUJOURD'HUI");
    const { appels, diagnostics } = await remplirEtCapturer(PAYLOAD);
    expect(diagnostics).toEqual([]);
    const surLaCaseDate = appels.filter(
      (a) => a.x >= rect.x0 - 1 && a.x <= rect.x1 + 1 && a.y >= rect.y0 - 1 && a.y <= rect.y1 + 1
    );
    expect(
      surLaCaseDate,
      "la date passe par setText() (widget standard) : aucun dessin positionnel n'est attendu ici"
    ).toEqual([]);
  });

  it("le bloc de signature (nom du declarant) se dessine EXACTEMENT une fois, sur le widget Signature42", async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF)) skip();
    const source = readFileSync(C1A_PDF);
    const rectSignature = await rectDuWidget(source, "Signature42");
    const { appels, diagnostics } = await remplirEtCapturer(PAYLOAD);
    expect(diagnostics).toEqual([]);

    // Le nom cursif ("façon Adobe") est le marqueur visuel du bloc — cf.
    // filler.ts, dessin de `block.name` en police Dancing Script.
    const nomPartout = appels.filter((a) => a.text === "Dupont Jean");
    expect(nomPartout, "un seul bloc de signature attendu sur tout le document — pas de doublon").toHaveLength(1);

    const [nom] = nomPartout;
    expect(nom.x).toBeGreaterThanOrEqual(rectSignature.x0 - 1);
    expect(nom.x).toBeLessThanOrEqual(rectSignature.x1 + 1);
    expect(nom.y).toBeGreaterThanOrEqual(rectSignature.y0 - 1);
    expect(nom.y).toBeLessThanOrEqual(rectSignature.y1 + 1);
  });
});
