import { describe, it, expect } from "vitest";
import { formatDateFR, wrapAcrossLines } from "../format";

describe("formatDateFR", () => {
  it("convertit l'ISO en format FR et laisse le reste intact", () => {
    expect(formatDateFR("2026-07-26")).toBe("26/07/2026");
    expect(formatDateFR("26/07/2026")).toBe("26/07/2026"); // idempotent
    expect(formatDateFR("")).toBe("");
  });
});

describe("wrapAcrossLines", () => {
  it("laisse tout sur la 1ʳᵉ ligne quand ça tient", () => {
    expect(wrapAcrossLines("cohousing", [20, 20])).toEqual(["cohousing"]);
  });

  it("coupe aux espaces sans dépasser le budget de la ligne", () => {
    const [l1, l2] = wrapAcrossLines("un deux trois quatre cinq six", [12, 40]);
    expect(l1.length).toBeLessThanOrEqual(12);
    expect(l1).toBe("un deux");
    expect(l2).toBe("trois quatre cinq six");
  });

  it("ne perd aucun mot : le reliquat va sur la DERNIÈRE ligne, quitte à déborder", () => {
    const text = "alpha bravo charlie delta echo foxtrot golf hotel india juliett";
    const lines = wrapAcrossLines(text, [11, 15]);
    expect(lines.join(" ")).toBe(text);
    // La dernière ligne assume le débordement plutôt que de tronquer.
    expect(lines[lines.length - 1].length).toBeGreaterThan(15);
  });

  it("ne coupe jamais un mot plus long que la ligne (sinon boucle infinie)", () => {
    const lines = wrapAcrossLines("anticonstitutionnellement suite", [5, 40]);
    expect(lines[0]).toBe("anticonstitutionnellement");
    expect(lines[1]).toBe("suite");
  });

  it("normalise les espaces et renvoie [] sur du vide", () => {
    expect(wrapAcrossLines("  a   b  ", [40])).toEqual(["a b"]);
    expect(wrapAcrossLines("   ", [40])).toEqual([]);
    expect(wrapAcrossLines("texte", [])).toEqual([]);
  });
});
