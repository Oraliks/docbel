import { describe, it, expect } from "vitest";
import { normalizeVatInput, parseBelgianAddress } from "../vies";

describe("normalizeVatInput", () => {
  it("nettoie séparateurs et préfixe pays", () => {
    expect(normalizeVatInput("BE", "BE 0123.456.789")).toEqual({ country: "BE", vat: "0123456789" });
    expect(normalizeVatInput("be", "0123-456-789")).toEqual({ country: "BE", vat: "0123456789" });
  });

  it("rejette les codes pays invalides", () => {
    expect(normalizeVatInput("XX1", "0123456789")).toBeNull();
    expect(normalizeVatInput("B", "0123456789")).toBeNull();
  });

  it("rejette les numéros non chiffrés ou trop courts", () => {
    expect(normalizeVatInput("BE", "abc")).toBeNull();
    expect(normalizeVatInput("BE", "12")).toBeNull();
  });
});

describe("parseBelgianAddress", () => {
  it("découpe une adresse VIES belge typique", () => {
    const out = parseBelgianAddress("Rue de la Loi 16\n1000 Bruxelles\nBelgique");
    expect(out).toEqual({
      street: "Rue de la Loi",
      houseNumber: "16",
      zipcode: "1000",
      city: "Bruxelles",
    });
  });

  it("tolère un n° de rue absent", () => {
    const out = parseBelgianAddress("Avenue Louise\n1050 Ixelles");
    expect(out?.zipcode).toBe("1050");
    expect(out?.city).toBe("Ixelles");
    expect(out?.street).toBe("Avenue Louise");
  });

  it("renvoie undefined pour une chaîne vide", () => {
    expect(parseBelgianAddress("")).toBeUndefined();
    expect(parseBelgianAddress("Une seule ligne")).toBeUndefined();
  });
});
