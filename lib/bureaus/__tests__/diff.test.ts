import { describe, it, expect } from "vitest";
import { diffBureau, snapshotBureau } from "../diff";
import type { Bureau } from "@prisma/client";

function mockBureau(overrides: Partial<Bureau> = {}): Bureau {
  return {
    id: "b1",
    organismeId: "o1",
    type: "CPAS",
    name: "CPAS Test",
    nameNl: null,
    nameDe: null,
    street: "Rue Test",
    streetNum: "1",
    postalCode: "1000",
    city: "Bruxelles",
    lat: 50.85,
    lng: 4.35,
    communeId: "c1",
    phone: "02 000 00 00",
    email: null,
    website: null,
    appointmentUrl: null,
    hours: [],
    hoursNotes: null,
    services: [],
    active: true,
    notes: null,
    verified: false,
    lastVerifiedAt: null,
    verifiedBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Bureau;
}

describe("diffBureau", () => {
  it("renvoie 0 changements si rien ne change", () => {
    const before = mockBureau();
    const diff = diffBureau(before, { name: before.name, phone: before.phone });
    expect(diff.changed).toEqual([]);
  });

  it("détecte un changement scalaire", () => {
    const before = mockBureau({ phone: "02 000 00 00" });
    const diff = diffBureau(before, { phone: "02 999 99 99" });
    expect(diff.changed).toContain("phone");
    expect(diff.previous.phone).toBe("02 000 00 00");
    expect(diff.current.phone).toBe("02 999 99 99");
  });

  it("détecte un changement de tableau (services)", () => {
    const before = mockBureau({ services: ["RIS"] as unknown as Bureau["services"] });
    const diff = diffBureau(before, {
      services: ["RIS", "energie"] as unknown as Bureau["services"],
    });
    expect(diff.changed).toContain("services");
  });

  it("ignore les champs non passés dans 'after'", () => {
    const before = mockBureau({ phone: "02 000 00 00" });
    const diff = diffBureau(before, { name: "New name" });
    expect(diff.changed).toEqual(["name"]);
    expect(diff.changed).not.toContain("phone");
  });

  it("ne tracke pas les champs hors liste (verified, createdAt)", () => {
    const before = mockBureau();
    const diff = diffBureau(before, {
      verified: true,
      createdAt: new Date(),
    } as unknown as Partial<Bureau>);
    expect(diff.changed).toEqual([]);
  });
});

describe("snapshotBureau", () => {
  it("inclut tous les champs trackés + id + snapshotAt", () => {
    const b = mockBureau();
    const snap = snapshotBureau(b);
    expect(snap.id).toBe("b1");
    expect(snap.name).toBe("CPAS Test");
    expect(snap.snapshotAt).toBeDefined();
    expect(typeof snap.snapshotAt).toBe("string");
  });
});
