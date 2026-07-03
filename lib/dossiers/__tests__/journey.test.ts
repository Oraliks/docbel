import { describe, it, expect } from "vitest";
import { serializeJourneyWarnings, serializeJourneyDocuments } from "../journey";
import type { DossierWarning, DossierDocument } from "../types";

describe("serializeJourneyWarnings", () => {
  it("mappe titre/message/severity et laisse tomber visibleWhen", () => {
    const warnings: DossierWarning[] = [
      {
        title: "Demande avant 25 ans",
        titleKey: "insertion.warning.demandeAvant25.title",
        message: "Avant 25 ans.",
        messageKey: "insertion.warning.demandeAvant25.message",
        severity: "critical",
      },
    ];
    const out = serializeJourneyWarnings(warnings, {});
    expect(out).toEqual([
      {
        title: "Demande avant 25 ans",
        titleKey: "insertion.warning.demandeAvant25.title",
        message: "Avant 25 ans.",
        messageKey: "insertion.warning.demandeAvant25.message",
        severity: "critical",
      },
    ]);
    expect(out[0]).not.toHaveProperty("visibleWhen");
  });

  it("filtre les warnings dont visibleWhen renvoie false", () => {
    const warnings: DossierWarning[] = [
      { title: "Toujours", message: "m", severity: "info" },
      { title: "Caché", message: "m", severity: "info", visibleWhen: () => false },
    ];
    const out = serializeJourneyWarnings(warnings, {});
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Toujours");
  });
});

describe("serializeJourneyDocuments", () => {
  it("garde slug/title/issuer/required, required défaut true", () => {
    const docs: DossierDocument[] = [
      {
        slug: "c1-insertion",
        title: "C1 — Déclaration",
        titleKey: "insertion.doc.c1.title",
        issuer: "ONEM",
        fields: [],
      },
    ];
    expect(serializeJourneyDocuments(docs)).toEqual([
      {
        slug: "c1-insertion",
        title: "C1 — Déclaration",
        titleKey: "insertion.doc.c1.title",
        issuer: "ONEM",
        required: true,
      },
    ]);
  });
});
