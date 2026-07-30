// Test de bout en bout sur le PDF officiel du C1A pour le défaut signalé par
// Oraliks le 2026-07-30 : l'en-tête de la page 2 (« Suite C1A |
// NISS ⎵⎵⎵⎵⎵⎵⎵⎵⎵⎵⎵ | Nom .......... ») partait vide.
//
// Cause réelle : les deux cases partagent le champ AcroForm "1_3" avec la
// 1ʳᵉ ligne « périodes » de Q18 (cf. seed/c1a-fields.ts, commentaire près de
// `q18periodesTexte`) — `setText` sur ce widget imprimerait la même valeur
// aux TROIS emplacements, ce qui a fait cesser le commit d4c470b de
// l'alimenter (en-tête blanc, mais plus faux). La correction rappelle
// l'identité déjà saisie en page 1 par ÉCRITURE POSITIONNELLE (aucun widget
// cible) : règles "nom-header-p2"/"niss-header-p2"
// (bindings/per-form/c1a.ts) + `POSITIONAL_EXTRA_STAMPS` (filler.ts). Cf.
// .superpowers/sdd/signature-entete-p2-report.md pour les mesures.
import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFName, PDFPage } from "pdf-lib";
import type { PDFPageDrawTextOptions } from "pdf-lib";
import { applyC1AImprovements } from "../seed/c1a-fields";
import { fillForm } from "../filler";
import { parsePdf } from "../acroform-parser";
import { resolveStamps } from "../bindings/engine";
import { C1A_RULES } from "../bindings/per-form/c1a";
import type { FormPayload } from "../types";

const C1A_PDF = join(process.cwd(), "private", "pdfs", "C1A_FR.pdf");

interface AppelDrawText {
  text: string;
  x: number;
  y: number;
}

/// Espionne `PDFPage.prototype.drawText` pendant un `fillForm` réel, règles
/// serveur du C1A comprises (`extraStamps`) — même technique que
/// `c1a-drawat-geometry.test.ts` (peigne BCE).
async function remplirEtCapturer(
  payload: FormPayload
): Promise<{ appels: AppelDrawText[]; diagnostics: unknown[] }> {
  const source = readFileSync(C1A_PDF);
  const parsed = await parsePdf(source);
  const fields = applyC1AImprovements([]);
  const extraStamps = resolveStamps(payload, C1A_RULES);

  const appels: AppelDrawText[] = [];
  const original = PDFPage.prototype.drawText;
  const spy = vi
    .spyOn(PDFPage.prototype, "drawText")
    .mockImplementation(function (this: PDFPage, text: string, options?: PDFPageDrawTextOptions) {
      appels.push({ text, x: options?.x ?? NaN, y: options?.y ?? NaN });
      return original.call(this, text, options);
    });
  try {
    const { diagnostics } = await fillForm(source, fields, payload, {
      flatten: false,
      technicalSchema: parsed.fields,
      extraStamps,
    });
    return { appels, diagnostics };
  } finally {
    spy.mockRestore();
  }
}

describe("C1A - en-tete page 2 (NISS + Nom) rappelle l'identite de la page 1", () => {
  const PAYLOAD: FormPayload = {
    nomEtPrenom: { first: "Jean", last: "Dupont" },
    niss: "85073003361",
  };

  it('ecrit le NISS en peigne (11 chiffres) sur la page 2, au pas mesure (13.02 pt, rupture 9+2)', async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF)) skip();
    const { appels, diagnostics } = await remplirEtCapturer(PAYLOAD);
    expect(diagnostics).toEqual([]);
    const chiffres = appels.filter((a) => a.y === 801 && /^[0-9]$/.test(a.text));
    expect(chiffres.map((c) => c.text).join("")).toBe("85073003361");
    expect(chiffres[0].x).toBeCloseTo(110.28, 2);
    // Rupture de groupe (9 chiffres, puis le pas + groupExtra, puis 2) :
    // écart mesuré 19.08 pt entre le 9e et le 10e chiffre, 13.02 pt ailleurs.
    for (let i = 0; i < chiffres.length - 1; i++) {
      const ecart = chiffres[i + 1].x - chiffres[i].x;
      expect(ecart).toBeCloseTo(i === 8 ? 19.08 : 13.02, 2);
    }
  });

  it("ecrit le nom (ordre NOM Prenom, identique a la page 1) sur la ligne pointillee de la page 2", async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF)) skip();
    const { appels, diagnostics } = await remplirEtCapturer(PAYLOAD);
    expect(diagnostics).toEqual([]);
    const nom = appels.find((a) => a.text === "Dupont Jean" && a.y === 801);
    expect(nom, "texte 'Dupont Jean' attendu a y=801 (en-tete page 2)").toBeDefined();
    expect(nom!.x).toBeCloseTo(295, 2);
  });

  it("ne stampe rien quand l'identite est absente (pas de fausse valeur imprimee)", async ({ skip }) => {
    if (!existsSync(C1A_PDF)) skip();
    const { appels, diagnostics } = await remplirEtCapturer({});
    expect(diagnostics).toEqual([]);
    expect(appels.some((a) => a.y === 801)).toBe(false);
  });

  it('le NISS et le Nom tombent chacun dans la plage x reelle de LEUR case d\'en-tete (widget partage "1_3", mesure a l\'execution)', async ({
    skip,
  }) => {
    if (!existsSync(C1A_PDF)) skip();
    const source = readFileSync(C1A_PDF);
    const doc = await PDFDocument.load(source, { ignoreEncryption: true });
    const pageRefs = doc.getPages().map((p) => p.ref.toString());
    const widgets = doc
      .getForm()
      .getField("1_3")
      .acroField.getWidgets()
      .map((w) => {
        const r = w.getRectangle();
        const pRef = w.dict.get(PDFName.of("P"));
        const page = pRef ? pageRefs.indexOf(pRef.toString()) : -1;
        return { page, x0: r.x, x1: r.x + r.width, y0: r.y };
      });
    expect(widgets, '"1_3" doit rester un widget partage a 3 cases (Q18 + Nom + NISS d\'en-tete)').toHaveLength(3);

    // Les 2 cases d'en-tete sont sur la page 2 (index 1) ET plus HAUTES que
    // celle de Q18 (cf. c1a-drawat-geometry.test.ts, meme distinction) ; la
    // case NISS a la plus petite abscisse des deux.
    const enTete = widgets.filter((w) => w.page === 1 && w.y0 > 790).sort((a, b) => a.x0 - b.x0);
    expect(enTete, "2 cases d'en-tete attendues (NISS puis Nom, triees par x)").toHaveLength(2);
    const [nissWidget, nomWidget] = enTete;

    const { appels } = await remplirEtCapturer(PAYLOAD);
    const premierChiffre = appels.find((a) => a.y === 801 && /^[0-9]$/.test(a.text));
    const nom = appels.find((a) => a.text === "Dupont Jean" && a.y === 801);
    expect(premierChiffre, "1er chiffre du NISS introuvable").toBeDefined();
    expect(nom, "texte du nom introuvable").toBeDefined();

    expect(premierChiffre!.x).toBeGreaterThanOrEqual(nissWidget.x0 - 2);
    expect(premierChiffre!.x).toBeLessThanOrEqual(nissWidget.x1);
    expect(nom!.x).toBeGreaterThanOrEqual(nomWidget.x0 - 2);
    expect(nom!.x).toBeLessThanOrEqual(nomWidget.x1);
  });
});
