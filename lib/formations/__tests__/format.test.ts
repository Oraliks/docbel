import { describe, it, expect } from "vitest";
import { formatPrice, deriveChips, durationText } from "@/components/formations/format";

describe("formatPrice", () => {
  it("shows Gratuit for free", () => {
    expect(formatPrice("free", null)).toBe("Gratuit");
    expect(formatPrice("free", 120)).toBe("Gratuit");
  });
  it("formats paid amounts", () => {
    expect(formatPrice("paid", 120, "EUR")).toBe("120 €");
    expect(formatPrice("paid", 120.5, "EUR")).toBe("120.50 €");
    expect(formatPrice("paid", null)).toBe("Payant");
  });
});

describe("durationText", () => {
  it("prefers an explicit label", () => {
    expect(durationText(10, "2 jours")).toBe("2 jours");
  });
  it("formats hours and minutes", () => {
    expect(durationText(2, null)).toBe("2 h");
    expect(durationText(0.5, null)).toBe("30 min");
    expect(durationText(null, null)).toBeNull();
  });
});

describe("deriveChips", () => {
  it("derives price + format + attestation chips", () => {
    const chips = deriveChips({
      priceType: "paid", priceAmount: 50, currency: "EUR",
      format: "onsite", level: "debutant", certificateType: "participation",
    });
    const labels = chips.map((c) => c.label);
    expect(labels).toContain("50 €");
    expect(labels).toContain("Présentiel");
    expect(labels).toContain("Attestation");
  });
  it("free training gets a green Gratuit chip and no attestation when none", () => {
    const chips = deriveChips({
      priceType: "free", priceAmount: null, currency: "EUR",
      format: "online", level: "debutant", certificateType: "none",
    });
    expect(chips[0]).toEqual({ label: "Gratuit", tone: "green" });
    expect(chips.some((c) => c.label === "Attestation")).toBe(false);
  });
});
