import { describe, it, expect } from "vitest";
import { validateBureauInput } from "../validation";

const VALID = {
  organismeId: "abc123",
  type: "CPAS",
  name: "CPAS test",
  street: "Rue Test",
  postalCode: "1000",
  city: "Bruxelles",
  communeId: "ccc",
};

describe("validateBureauInput", () => {
  it("accepte un input valide complet", () => {
    const r = validateBureauInput(VALID);
    expect(r.ok).toBe(true);
  });

  it("refuse organismeId vide", () => {
    const r = validateBureauInput({ ...VALID, organismeId: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.find((e) => e.field === "organismeId")).toBeDefined();
    }
  });

  it("refuse type invalide", () => {
    const r = validateBureauInput({ ...VALID, type: "FOO" });
    expect(r.ok).toBe(false);
  });

  it("normalise le type en majuscules", () => {
    const r = validateBureauInput({ ...VALID, type: "cpas" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.type).toBe("CPAS");
  });

  it("refuse code postal non 4 chiffres", () => {
    const r = validateBureauInput({ ...VALID, postalCode: "123" });
    expect(r.ok).toBe(false);
    const r2 = validateBureauInput({ ...VALID, postalCode: "12345" });
    expect(r2.ok).toBe(false);
    const r3 = validateBureauInput({ ...VALID, postalCode: "ABCD" });
    expect(r3.ok).toBe(false);
  });

  it("exige une commune attitrée pour CPAS", () => {
    const r = validateBureauInput({ ...VALID, communeId: null });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.find((e) => e.field === "communeId")).toBeDefined();
    }
  });

  it("exige une commune attitrée pour COMMUNE", () => {
    const r = validateBureauInput({ ...VALID, type: "COMMUNE", communeId: "" });
    expect(r.ok).toBe(false);
  });

  it("n'exige PAS de commune pour SYNDICAT", () => {
    const r = validateBureauInput({ ...VALID, type: "SYNDICAT", communeId: null });
    expect(r.ok).toBe(true);
  });

  it("refuse URL invalide", () => {
    const r = validateBureauInput({ ...VALID, website: "ftp://example.com" });
    expect(r.ok).toBe(false);
  });

  it("accepte URLs https valides", () => {
    const r = validateBureauInput({ ...VALID, website: "https://www.cpas.be" });
    expect(r.ok).toBe(true);
  });

  it("normalise lat/lng en number", () => {
    const r = validateBureauInput({ ...VALID, lat: "50.85", lng: "4.35" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.lat).toBe(50.85);
      expect(r.data.lng).toBe(4.35);
    }
  });

  it("accepte lat/lng absents", () => {
    const r = validateBureauInput(VALID);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.lat).toBeNull();
    }
  });

  it("filtre les slots horaires invalides", () => {
    const r = validateBureauInput({
      ...VALID,
      hours: [
        { day: 1, slots: [{ open: "09:00", close: "12:00" }, { open: "ouf", close: "12" }] },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.hours[0].slots).toHaveLength(1);
    }
  });

  it("refuse slot ouvre>=ferme", () => {
    const r = validateBureauInput({
      ...VALID,
      hours: [{ day: 1, slots: [{ open: "12:00", close: "09:00" }] }],
    });
    expect(r.ok).toBe(true); // input valide globalement
    if (r.ok) {
      expect(r.data.hours[0].slots).toHaveLength(0); // mais le slot est filtré
    }
  });

  it("active vaut true par défaut", () => {
    const r = validateBureauInput(VALID);
    if (r.ok) expect(r.data.active).toBe(true);
  });

  it("active=false respecté", () => {
    const r = validateBureauInput({ ...VALID, active: false });
    if (r.ok) expect(r.data.active).toBe(false);
  });
});
