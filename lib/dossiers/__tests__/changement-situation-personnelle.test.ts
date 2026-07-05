import { describe, expect, it } from "vitest";
import { getDossier } from "../registry";

describe("Dossier changement-situation-personnelle", () => {
  it("est enregistré dans le registre", () => {
    const dossier = getDossier("changement-situation-personnelle");
    expect(dossier).not.toBeNull();
  });

  it("pointe vers le PdfForm c1-changement-situation, sans questionnaire d'orientation", () => {
    const dossier = getDossier("changement-situation-personnelle")!;
    expect(dossier.questions).toEqual([]);
    expect(dossier.documents).toHaveLength(1);
    expect(dossier.documents[0].slug).toBe("c1-changement-situation");
    expect(dossier.documents[0].sourcePdfPath).toBe("private/pdfs/C1_FR.pdf");
  });

  it("a un écran journey de 4 étapes ordonnées, avec CTA", () => {
    const dossier = getDossier("changement-situation-personnelle")!;
    expect(dossier.journey).toHaveLength(4);
    expect(dossier.journey!.map((s) => s.order)).toEqual([1, 2, 3, 4]);
    expect(dossier.journeyCtaLabel).toBeTruthy();
  });
});
