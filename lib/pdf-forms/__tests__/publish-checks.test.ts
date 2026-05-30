import { describe, it, expect } from "vitest";
import { checkPublishable, hasBlockingIssues } from "../publish-checks";
import type { AcroFieldRaw, PdfFormField } from "../types";

const enriched = (id: string, pdfFieldName = id): PdfFormField =>
  ({ id, pdfFieldName, type: "text", required: false, label: { fr: id } }) as PdfFormField;
const raw = (name: string): AcroFieldRaw => ({ pdfFieldName: name, acroType: "text" });

describe("checkPublishable", () => {
  it("PDF plat + champs visuels matérialisés + enriched → publiable", () => {
    // Scénario user : upload PDF plat (technical vide à l'origine), ajout de
    // champs visuels, matérialisation (technical + enriched + materializedNames
    // sont alignés en DB), aucune erreur attendue.
    const fields = [enriched("nom"), enriched("prenom")];
    const technical = [raw("nom"), raw("prenom")];
    const visualFieldsRaw = {
      version: 1,
      fields: [
        { id: "vf1", name: "nom", type: "text", page: 0, rect: { x: 0, y: 0, w: 100, h: 20 } },
        { id: "vf2", name: "prenom", type: "text", page: 0, rect: { x: 0, y: 30, w: 100, h: 20 } },
      ],
      materializedNames: ["nom", "prenom"],
    };
    const matAt = new Date();
    const issues = checkPublishable(fields, technical, ["fr"], {
      visualFieldsRaw,
      visualFieldsMaterializedAt: matAt,
      updatedAt: matAt,
    });
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(issues.filter((i) => i.level === "warning")).toHaveLength(0);
  });

  it("brouillon visuel non matérialisé → warning non bloquant", () => {
    const fields = [enriched("nom")];
    const visualFieldsRaw = {
      version: 1,
      fields: [{ id: "vf1", name: "extra", type: "text", page: 0, rect: { x: 0, y: 0, w: 50, h: 20 } }],
      materializedNames: [],
    };
    const issues = checkPublishable(fields, [raw("nom")], ["fr"], {
      visualFieldsRaw,
      visualFieldsMaterializedAt: null,
      updatedAt: new Date(),
    });
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(issues.some((i) => i.level === "warning" && /Appliquer au PDF/.test(i.message))).toBe(true);
  });

  it("aucun champ → erreur bloquante", () => {
    const issues = checkPublishable([], [], ["fr"]);
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("ancre vers un champ PDF inexistant → erreur bloquante", () => {
    const fields = [enriched("a", "absent")];
    const issues = checkPublishable(fields, [raw("present")], ["fr"]);
    expect(hasBlockingIssues(issues)).toBe(true);
  });
});
