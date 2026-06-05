import { describe, expect, it } from "vitest";

import { hashNrn, nrnLast4 } from "@/lib/booking/dedupe";

describe("dedupe helpers (purs)", () => {
  it("hashNrn est déterministe et masque l'entrée", () => {
    const a = hashNrn("85051512383");
    const b = hashNrn("85051512383");
    expect(a).toBe(b);
    expect(a).not.toBe("85051512383");
    expect(a).toHaveLength(64); // sha256 hex
  });

  it("hashNrn diffère selon l'entrée", () => {
    expect(hashNrn("85051512383")).not.toBe(hashNrn("85051512384"));
  });

  it("nrnLast4 renvoie les 4 derniers chiffres", () => {
    expect(nrnLast4("85051512383")).toBe("2383");
  });
});
