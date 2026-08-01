import { describe, expect, it } from "vitest";
import { buildDiagnosticsSummary, stablePayloadHashOf } from "../submission-log";
import type { FillDiagnostic } from "../filler";
import type { PdfFormField } from "../types";

function field(p: Partial<PdfFormField> & Pick<PdfFormField, "id" | "type">): PdfFormField {
  return { pdfFieldName: p.id, required: false, label: { fr: p.id }, ...p } as PdfFormField;
}

/// Schéma minimal type ONEM : deux champs métier + les deux champs auto que le
/// serveur impose à la génération (date du jour, signature).
const FIELDS: PdfFormField[] = [
  field({ id: "nom", type: "text" }),
  field({ id: "niss", type: "niss" }),
  field({ id: "dateCreation", type: "date", prefillFrom: "system.today" }),
  field({ id: "signature", type: "signature" }),
];

describe("stablePayloadHashOf — invariance à la date de téléchargement", () => {
  it("deux générations du même contenu à deux dates donnent le MÊME hash", () => {
    // C'est tout l'enjeu du lot : `payloadHash` (sha du payload brut) diffère
    // ici, puisque la date injectée diffère. Le hash stable, lui, ne bouge pas.
    const lundi = { nom: "Dupont", niss: "85073003328", dateCreation: "2026-08-03", signature: "confirmed" };
    const mardi = { nom: "Dupont", niss: "85073003328", dateCreation: "2026-08-04", signature: "confirmed" };
    expect(stablePayloadHashOf(mardi, FIELDS)).toBe(stablePayloadHashOf(lundi, FIELDS));
  });

  it("un vrai changement de contenu métier change le hash", () => {
    const avant = { nom: "Dupont", niss: "85073003328", dateCreation: "2026-08-03" };
    const apres = { nom: "Martin", niss: "85073003328", dateCreation: "2026-08-03" };
    expect(stablePayloadHashOf(apres, FIELDS)).not.toBe(stablePayloadHashOf(avant, FIELDS));
  });

  it("insensible à l'ordre d'insertion des clés", () => {
    const a = { nom: "Dupont", niss: "85073003328" };
    const b = { niss: "85073003328", nom: "Dupont" };
    expect(stablePayloadHashOf(b, FIELDS)).toBe(stablePayloadHashOf(a, FIELDS));
  });

  it("produit bien un SHA256 hexadécimal (64 caractères)", () => {
    expect(stablePayloadHashOf({ nom: "Dupont" }, FIELDS)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("buildDiagnosticsSummary", () => {
  it("aucune anomalie → { count: 0 } — la complétude est AFFIRMÉE, pas laissée à null", () => {
    // `null` serait ambigu (« rien à signaler » ou « pas encore calculé ? ») ;
    // `{ count: 0 }` prouve que la génération a été vérifiée et était complète.
    expect(buildDiagnosticsSummary([])).toEqual({ count: 0, kinds: {} });
  });

  it("compte les anomalies et les ventile par type", () => {
    const diags: FillDiagnostic[] = [
      { fieldId: "a", widget: "w1", kind: "widget-introuvable" },
      { fieldId: "b", widget: "w2", kind: "widget-introuvable" },
      { fieldId: "c", widget: "w3", kind: "stamp-refuse" },
    ];
    expect(buildDiagnosticsSummary(diags)).toEqual({
      count: 3,
      kinds: { "widget-introuvable": 2, "stamp-refuse": 1 },
    });
  });

  it("ne laisse JAMAIS fuiter `detail` — il porte les caractères saisis par le citoyen", () => {
    const diags: FillDiagnostic[] = [
      { fieldId: "nom", widget: "w1", kind: "caracteres-non-rendus", detail: "Дюпон" },
      { fieldId: "prenom", widget: "w2", kind: "stamp-refuse", detail: "café-crème" },
    ];
    const summary = buildDiagnosticsSummary(diags);
    const serialise = JSON.stringify(summary);
    expect(serialise).not.toContain("Дюпон");
    expect(serialise).not.toContain("café-crème");
    expect(serialise).not.toContain("detail");
    expect(summary.count).toBe(2);
  });

  it("ne laisse pas non plus fuiter fieldId/widget (inutiles au comptage)", () => {
    const summary = buildDiagnosticsSummary([
      { fieldId: "numeroCompteBancaire", widget: "iban_1", kind: "widget-introuvable" },
    ]);
    const serialise = JSON.stringify(summary);
    expect(serialise).not.toContain("numeroCompteBancaire");
    expect(serialise).not.toContain("iban_1");
  });
});
