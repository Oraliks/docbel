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

  it("ancre pipe-séparée où les deux widgets existent → pas d'erreur", () => {
    const field = {
      id: "q8",
      pdfFieldName: "oui_8|non_8",
      type: "radio",
      required: false,
      label: { fr: "Question 8" },
      options: [
        { value: "oui", label: { fr: "Oui" } },
        { value: "non", label: { fr: "Non" } },
      ],
    } as PdfFormField;
    const technical = [raw("oui_8"), raw("non_8")];
    const issues = checkPublishable([field], technical, ["fr"]);
    expect(issues.some((i) => /inexistant/.test(i.message))).toBe(false);
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("ancre pipe-séparée où une partie manque → erreur nomme la partie absente", () => {
    const field = {
      id: "q8",
      pdfFieldName: "oui_8|non_8",
      type: "radio",
      required: false,
      label: { fr: "Question 8" },
      options: [
        { value: "oui", label: { fr: "Oui" } },
        { value: "non", label: { fr: "Non" } },
      ],
    } as PdfFormField;
    const technical = [raw("oui_8")]; // non_8 manquant
    const issues = checkPublishable([field], technical, ["fr"]);
    const missing = issues.find((i) => /inexistant/.test(i.message));
    expect(missing).toBeDefined();
    expect(missing!.level).toBe("error");
    expect(missing!.message).toContain("non_8");
    expect(missing!.message).not.toContain("oui_8");
  });

  it("ancre simple (sans pipe) garde le comportement existant", () => {
    const fields = [enriched("a", "present"), enriched("b", "absent")];
    const issues = checkPublishable(fields, [raw("present")], ["fr"]);
    const missing = issues.filter((i) => /inexistant/.test(i.message));
    expect(missing).toHaveLength(1);
    expect(missing[0].message).toContain("absent");
  });

  // ==========================================================================
  // Couverture AcroForm (Phase 10 des ameliorations post-plan bindings).
  // ==========================================================================

  it("couverture AcroForm : < 25% d'orphelins → aucun warning couverture", () => {
    // 3 widgets techniques, 3 couverts par les champs enrichis, 0 orphelin.
    const fields = [enriched("a"), enriched("b"), enriched("c")];
    const technical = [raw("a"), raw("b"), raw("c")];
    const issues = checkPublishable(fields, technical, ["fr"]);
    expect(issues.some((i) => /Couverture AcroForm/.test(i.message))).toBe(false);
  });

  it("couverture AcroForm : ≥ 25% d'orphelins → warning avec pourcentage", () => {
    // 4 widgets techniques, 1 seul couvert → 3/4 = 75% orphelins.
    const fields = [enriched("a")];
    const technical = [raw("a"), raw("b"), raw("c"), raw("d")];
    const issues = checkPublishable(fields, technical, ["fr"]);
    const coverage = issues.find((i) => /Couverture AcroForm/.test(i.message));
    expect(coverage).toBeDefined();
    expect(coverage!.level).toBe("warning");
    expect(coverage!.message).toContain("75%");
  });

  it("couverture AcroForm : règle serveur couvre un widget → pas orphelin", () => {
    // 2 widgets, 1 par un champ, 1 par une règle serveur → 0 orphelin.
    const fields = [enriched("a")];
    const technical = [raw("a"), raw("b")];
    const issues = checkPublishable(fields, technical, ["fr"], {
      bindingRules: [{ name: "rule-b", stamp: [{ widget: "b", value: true }] }],
    });
    expect(issues.some((i) => /Couverture AcroForm/.test(i.message))).toBe(false);
  });

  it("couverture AcroForm : règle serveur qui cible un widget absent → warning", () => {
    const fields = [enriched("a")];
    const technical = [raw("a")];
    const issues = checkPublishable(fields, technical, ["fr"], {
      bindingRules: [{ name: "rule-typo", stamp: [{ widget: "widget_absent", value: true }] }],
    });
    const bad = issues.find((i) => /widget absent du PDF/.test(i.message));
    expect(bad).toBeDefined();
    expect(bad!.level).toBe("warning");
    expect(bad!.message).toContain("widget_absent");
  });

  it("couverture AcroForm : ne bloque JAMAIS la publication (warning uniquement)", () => {
    const fields = [enriched("a")];
    const technical = [raw("a"), raw("b"), raw("c"), raw("d")]; // 75% orphelins
    const issues = checkPublishable(fields, technical, ["fr"]);
    expect(hasBlockingIssues(issues)).toBe(false);
  });
});
