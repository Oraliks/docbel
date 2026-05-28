import { describe, it, expect } from "vitest";
import { computeTechnicalDiff, migrateEnrichment } from "../diff";
import { AcroFieldRaw, PdfFormField } from "../types";

const raw = (name: string): AcroFieldRaw => ({ pdfFieldName: name, acroType: "text" });

describe("computeTechnicalDiff", () => {
  it("détecte ajouts et suppressions", () => {
    const d = computeTechnicalDiff([raw("a"), raw("b")], [raw("a"), raw("c")]);
    expect(d.added).toContain("c");
    expect(d.removed).toContain("b");
    expect(d.unchanged).toContain("a");
  });

  it("détecte un renommage probable par similarité", () => {
    const d = computeTechnicalDiff([raw("date_naissance")], [raw("date_de_naissance")]);
    expect(d.renamed).toHaveLength(1);
    expect(d.renamed[0]).toEqual({ from: "date_naissance", to: "date_de_naissance" });
  });
});

describe("migrateEnrichment", () => {
  const enriched: PdfFormField[] = [
    { id: "a", pdfFieldName: "a", type: "text", required: false, label: { fr: "A" } },
    { id: "old", pdfFieldName: "date_naissance", type: "date", required: true, label: { fr: "Naissance" } },
    { id: "gone", pdfFieldName: "b", type: "text", required: false, label: { fr: "B" } },
  ];

  it("conserve les champs renommés et retire les supprimés", () => {
    const diff = computeTechnicalDiff(
      [raw("a"), raw("date_naissance"), raw("b")],
      [raw("a"), raw("date_de_naissance"), raw("nouveau")]
    );
    const { kept, addedNames } = migrateEnrichment(enriched, diff);
    const names = kept.map((f) => f.pdfFieldName);
    expect(names).toContain("date_de_naissance"); // renommé, enrichissement conservé
    expect(names).not.toContain("b"); // supprimé
    expect(addedNames).toContain("nouveau");
    // l'enrichissement du champ renommé est préservé (type date, requis)
    const migrated = kept.find((f) => f.pdfFieldName === "date_de_naissance");
    expect(migrated?.type).toBe("date");
    expect(migrated?.required).toBe(true);
  });
});
