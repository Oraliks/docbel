import { describe, expect, it } from "vitest";
import { C1_IMPROVEMENT_TARGETS } from "../apply-c1-improvements-core";
import { C1_TRIGGERS } from "../c1-fields-improvements";
import type { AcroFieldRaw, PdfFormField } from "../../types";

describe("C1_IMPROVEMENT_TARGETS — c1-changement-situation", () => {
  it("est présent, réutilise C1_TRIGGERS, et force le motif par défaut sur 'modification'", () => {
    const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === "c1-changement-situation");
    expect(target).toBeDefined();
    expect(target?.triggers).toBe(C1_TRIGGERS);

    const improved = target!.improve([]);
    const motif = improved.find((f) => f.id === "motifIntroduction");
    expect(motif?.defaultValue).toBe("modification");
  });

  it("ajoute le 5e chip transfereOrganismePaiement, réservé à c1-changement-situation", () => {
    const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === "c1-changement-situation");
    const improved = target!.improve([]);
    expect(improved.find((f) => f.id === "transfereOrganismePaiement")).toBeDefined();

    expect(C1_IMPROVEMENT_TARGETS.map((target) => target.slug)).not.toContain("c1-fr");
    expect(C1_IMPROVEMENT_TARGETS.map((target) => target.slug)).not.toContain("c1-insertion");
  });

  it("retire les anciens workarounds techniques sans toucher aux champs du Runner", () => {
    const target = C1_IMPROVEMENT_TARGETS.find((t) => t.slug === "c1-changement-situation");
    const fields: PdfFormField[] = [
      {
        id: "ibanPart1",
        pdfFieldName: "undefined_11",
        type: "text",
        required: false,
        label: { fr: "Ancien fragment IBAN", nl: "", de: "" },
      },
      {
        id: "obsoleteHidden",
        pdfFieldName: "widget-disparu",
        type: "text",
        required: false,
        hidden: true,
        label: { fr: "Champ historique", nl: "", de: "" },
      },
    ];
    const technical = [{ pdfFieldName: "widget-actuel", acroType: "text" }] satisfies AcroFieldRaw[];

    const improved = target!.improve(fields, { technicalSchema: technical });
    expect(improved.map((field) => field.id)).not.toContain("ibanPart1");
    expect(improved.map((field) => field.id)).not.toContain("obsoleteHidden");
    expect(improved.find((field) => field.id === "dateModificationEffective")?.required).toBe(true);
  });
});
