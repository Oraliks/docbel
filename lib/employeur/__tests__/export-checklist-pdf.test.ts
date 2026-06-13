import { describe, it, expect } from "vitest";
import { buildChecklistPdf, PDF_DISCLAIMER } from "../export-checklist-pdf";

describe("export PDF checklist", () => {
  it("génère un document PDF non vide avec l'avertissement obligatoire", async () => {
    const doc = await buildChecklistPdf({
      title: "Engagement employé — Vendeur",
      subtitle: "Employé · CDI",
      categoryLabel: "Premier engagement",
      reliability: "low",
      complexity: "Moyen",
      facts: [
        ["Commission paritaire", "—"],
        ["Salaire brut mensuel", "2500 €"],
      ],
      items: [
        { title: "Demander l'identification via WIDE", priority: "obligatoire", status: "todo", sourceCode: "S1" },
        { title: "Préparer la Dimona", priority: "obligatoire", status: "in_progress", sourceCode: "S2" },
        { title: "Prévoir l'e-Box", priority: "optionnel", status: "not_applicable" },
      ],
      alerts: [
        { severity: "warning", message: "Commission paritaire non renseignée.", sourceCode: "S8" },
      ],
      sources: [
        { code: "S1", title: "ONSS — WIDE", institution: "ONSS", url: "https://www.onss.be/" },
        { code: "S2", title: "Dimona", institution: "ONSS", url: "https://www.socialsecurity.be/" },
      ],
    });

    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(PDF_DISCLAIMER).toContain("préparatoire");
  });
});
