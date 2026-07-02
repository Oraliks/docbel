import { describe, it, expect } from "vitest";
import { natureMeta, NATURE_ORDER } from "../nature";

describe("natureMeta", () => {
  it("mappe les 5 natures réelles avec libellé + icône", () => {
    for (const k of ["AR", "AM", "Loi-programme", "Loi", "Arrete-loi"] as const) {
      const m = natureMeta(k);
      expect(m.key).toBe(k);
      expect(m.label.length).toBeGreaterThan(0);
      expect(typeof m.icon).toBe("object"); // React component (ForwardRefExoticComponent)
      expect(m.accent).toContain("bg-"); // classe tailwind présente
    }
  });
  it("fallback neutre (sans exception) sur une nature inconnue", () => {
    const m = natureMeta("Circulaire");
    expect(m.label.length).toBeGreaterThan(0);
    expect(typeof m.icon).toBe("object"); // React component (ForwardRefExoticComponent)
  });
  it("NATURE_ORDER couvre exactement les 5 natures", () => {
    expect([...NATURE_ORDER].sort()).toEqual(
      ["AM", "AR", "Arrete-loi", "Loi", "Loi-programme"].sort(),
    );
  });
});
