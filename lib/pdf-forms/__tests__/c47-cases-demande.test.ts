// Test de bout en bout sur le PDF officiel du C47, pour le défaut trouvé le
// 2026-07-30 : le champ AcroForm
// « Je suis un jeune travailleur…(art. 36/3, § 2, AR 25.11.1991) » porte DEUX
// widgets (`/Kids`) posés dans les DEUX cadres opposés du formulaire —
// « Je demande que le montant … soit fixé » (art. 114, y=394,6) d'un côté,
// « jeune travailleur en stage d'insertion » (y=274,9) de l'autre. Deux widgets
// d'un même champ partagent une seule valeur : cocher l'un cochait donc les
// deux cadres à la fois, et la case art. 114 — celle que vise le déclencheur du
// C1 — était impossible à cocher seule.
//
// Correction : les trois cases sont dessinées en positionnel (règle
// "cadre-demande-case" + `POSITIONAL_EXTRA_STAMPS`), et le dessin est DIFFÉRÉ
// APRÈS `form.flatten()`. Sans ce report, l'apparence « décochée » du widget
// (`1 g / 0 0 6.7 6.7 re / f` — un carré blanc opaque) est recopiée sur la page
// par-dessus la croix, qui disparaît sans le moindre signal : le caractère
// reste bien dans le PDF, il est simplement recouvert.
import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFForm, PDFPage } from "pdf-lib";
import type { PDFPageDrawTextOptions } from "pdf-lib";
import { applyC47Improvements } from "../seed/c47-fields";
import { fillForm } from "../filler";
import { parsePdf } from "../acroform-parser";
import { resolveStamps } from "../bindings/engine";
import { C47_RULES } from "../bindings/per-form/c47";
import type { FormPayload } from "../types";

const C47_PDF = join(process.cwd(), "private", "pdfs", "C47_FR.pdf");

/// Position attendue de chaque croix : rectangle du widget ❑ mesuré sur le PDF,
/// recentré pour un « X » de 8 pt. Doit rester d'accord avec
/// `POSITIONAL_EXTRA_STAMPS` (filler.ts).
const CROIX_ATTENDUE: Record<string, { x: number; y: number }> = {
  art114: { x: 228.18, y: 395.08 },
  "jeune-travailleur": { x: 210.58, y: 275.38 },
  "chomeur-indemnise": { x: 210.78, y: 238.48 },
};

interface Trace {
  croix: Array<{ x: number; y: number }>;
  /// Ordre d'apparition des évènements : "flatten" puis "croix" — jamais
  /// l'inverse, sans quoi l'aplatissement recouvre la croix.
  sequence: string[];
}

async function remplirEtTracer(payload: FormPayload): Promise<Trace> {
  const source = readFileSync(C47_PDF);
  const parsed = await parsePdf(source);
  const fields = applyC47Improvements([]);
  const extraStamps = resolveStamps(payload, C47_RULES);

  const croix: Array<{ x: number; y: number }> = [];
  const sequence: string[] = [];

  const drawTextOriginal = PDFPage.prototype.drawText;
  const flattenOriginal = PDFForm.prototype.flatten;
  const spyDraw = vi
    .spyOn(PDFPage.prototype, "drawText")
    .mockImplementation(function (this: PDFPage, text: string, options?: PDFPageDrawTextOptions) {
      if (text === "X") {
        croix.push({ x: options?.x ?? NaN, y: options?.y ?? NaN });
        sequence.push("croix");
      }
      return drawTextOriginal.call(this, text, options);
    });
  const spyFlatten = vi
    .spyOn(PDFForm.prototype, "flatten")
    .mockImplementation(function (this: PDFForm, options?: { updateFieldAppearances: boolean }) {
      sequence.push("flatten");
      return flattenOriginal.call(this, options);
    });

  try {
    await fillForm(source, fields, payload, {
      flatten: true,
      technicalSchema: parsed.fields,
      extraStamps,
    });
    return { croix, sequence };
  } finally {
    spyDraw.mockRestore();
    spyFlatten.mockRestore();
  }
}

describe("C47 — les trois cases « votre demande » s'excluent", () => {
  for (const [choix, attendu] of Object.entries(CROIX_ATTENDUE)) {
    it(`« ${choix} » ne coche QUE sa propre case`, async ({ skip }) => {
      if (!existsSync(C47_PDF)) skip();
      const { croix } = await remplirEtTracer({ cadreDemande: choix });
      expect(croix, "une seule croix, jamais deux cadres à la fois").toHaveLength(1);
      expect(croix[0].x).toBeCloseTo(attendu.x, 2);
      expect(croix[0].y).toBeCloseTo(attendu.y, 2);
    });
  }

  it("ne coche rien tant qu'aucun choix n'est fait", async ({ skip }) => {
    if (!existsSync(C47_PDF)) skip();
    const { croix } = await remplirEtTracer({});
    expect(croix).toHaveLength(0);
  });

  it("dessine la croix APRÈS l'aplatissement, sinon le carré blanc du widget la recouvre", async ({
    skip,
  }) => {
    if (!existsSync(C47_PDF)) skip();
    const { sequence } = await remplirEtTracer({ cadreDemande: "art114" });
    expect(sequence).toEqual(["flatten", "croix"]);
  });
});
