import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getIbanNameVerifier, isIbanNameCheckEnabled } from "..";

describe("getIbanNameVerifier", () => {
  const original = process.env.IBAN_NAME_PROVIDER;
  afterEach(() => {
    process.env.IBAN_NAME_PROVIDER = original;
  });

  it("renvoie null quand non configuré", () => {
    delete process.env.IBAN_NAME_PROVIDER;
    expect(getIbanNameVerifier()).toBeNull();
    expect(isIbanNameCheckEnabled()).toBe(false);
  });

  it("renvoie null pour 'none' / 'disabled'", () => {
    process.env.IBAN_NAME_PROVIDER = "none";
    expect(getIbanNameVerifier()).toBeNull();
    process.env.IBAN_NAME_PROVIDER = "disabled";
    expect(getIbanNameVerifier()).toBeNull();
  });

  it("renvoie le mock provider quand IBAN_NAME_PROVIDER=mock", () => {
    process.env.IBAN_NAME_PROVIDER = "mock";
    const v = getIbanNameVerifier();
    expect(v).not.toBeNull();
    expect(v?.name).toBe("mock");
  });
});

describe("MockProvider.verify", () => {
  beforeEach(() => {
    process.env.IBAN_NAME_PROVIDER = "mock";
  });

  it("renvoie unable_to_verify pour un IBAN invalide", async () => {
    const v = getIbanNameVerifier()!;
    const res = await v.verify({ iban: "BE00000000000000", name: "X" });
    expect(res.match).toBe("unable_to_verify");
  });

  it("reconnaît les patterns de test (match / close / no)", async () => {
    const v = getIbanNameVerifier()!;
    const iban = "BE68539007547034"; // checksum valide
    expect((await v.verify({ iban, name: "TEST_MATCH Jean" })).match).toBe("match");
    expect((await v.verify({ iban, name: "TEST_NO Pierre" })).match).toBe("no_match");
    const close = await v.verify({ iban, name: "TEST_CLOSE Marie" });
    expect(close.match).toBe("close_match");
    expect(close.suggestedName).toBeTruthy();
  });
});
