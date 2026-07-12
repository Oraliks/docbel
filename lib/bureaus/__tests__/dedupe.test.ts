import { describe, it, expect } from "vitest";
import {
  isNonGuichetName,
  isStubAddress,
  pickSurvivor,
  groupDuplicates,
  type DedupCandidate,
} from "../dedupe";

function cand(over: Partial<DedupCandidate>): DedupCandidate {
  return {
    id: "id",
    name: "CPAS de Test",
    type: "CPAS",
    street: "Rue de Test",
    postalCode: "1000",
    communeId: "commune-test",
    phone: null,
    hoursCount: 0,
    lat: null,
    verified: false,
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...over,
  };
}

describe("isNonGuichetName", () => {
  it("détecte les bâtiments non-guichets", () => {
    expect(isNonGuichetName("Archives de la Ville et du CPAS de La Louvière")).toBe(true);
    expect(isNonGuichetName("Pavillon du CPAS de Soignies")).toBe(true);
    expect(isNonGuichetName("Police Administrative")).toBe(true);
    expect(isNonGuichetName("Oud Klooster")).toBe(true);
    expect(isNonGuichetName("Historisch Stadhuis Kortrijk")).toBe(true);
    expect(isNonGuichetName("Museum voor Schone Kunsten")).toBe(true);
  });

  it("laisse passer les vrais guichets", () => {
    expect(isNonGuichetName("CPAS de Manage")).toBe(false);
    expect(isNonGuichetName("Stadhuis Maaseik")).toBe(false);
    expect(isNonGuichetName("Administration Communale de Châtelet")).toBe(false);
    expect(isNonGuichetName("Hôtel de Ville de Vielsalm")).toBe(false);
    expect(isNonGuichetName("OCMW")).toBe(false);
  });
});

describe("isStubAddress", () => {
  it("détecte les adresses placeholder", () => {
    expect(isStubAddress("Adresse à confirmer")).toBe(true);
    expect(isStubAddress("?")).toBe(true);
    expect(isStubAddress("stub")).toBe(true);
    expect(isStubAddress("TODO")).toBe(true);
    expect(isStubAddress("")).toBe(true);
  });

  it("laisse passer une vraie rue", () => {
    expect(isStubAddress("Rue de la Loi")).toBe(false);
    expect(isStubAddress("Grote Markt")).toBe(false);
  });
});

describe("pickSurvivor", () => {
  it("garde le bureau vérifié même si l'autre a une meilleure adresse", () => {
    const verified = cand({ id: "verified", street: "Adresse à confirmer", verified: true });
    const fresh = cand({ id: "fresh", street: "Rue Réelle 12", phone: "0800" });
    const r = pickSurvivor([fresh, verified]);
    expect(r.survivor.id).toBe("verified");
    expect(r.losers.map((l) => l.id)).toEqual(["fresh"]);
  });

  it("préfère un vrai guichet à un bâtiment blocklisté", () => {
    const archives = cand({ id: "archives", name: "Archives de la Ville et du CPAS", street: "Rue A 1", phone: "0800" });
    const real = cand({ id: "real", name: "CPAS de La Louvière", street: "Rue B 2" });
    const r = pickSurvivor([archives, real]);
    expect(r.survivor.id).toBe("real");
  });

  it("préfère une adresse réelle à un stub", () => {
    const stub = cand({ id: "stub", street: "Adresse à confirmer" });
    const real = cand({ id: "real", street: "Rue Réelle 5" });
    const r = pickSurvivor([stub, real]);
    expect(r.survivor.id).toBe("real");
    expect(r.losers[0].reason).toContain("adresse");
  });

  it("départage par téléphone puis horaires quand les adresses se valent", () => {
    const noPhone = cand({ id: "noPhone", street: "Rue X 1" });
    const withPhone = cand({ id: "withPhone", street: "Rue X 1", phone: "0800", hoursCount: 3 });
    const r = pickSurvivor([noPhone, withPhone]);
    expect(r.survivor.id).toBe("withPhone");
  });

  it("préfère un bureau lié à une commune à un non lié, à qualité égale", () => {
    const linked = cand({ id: "linked", communeId: "c1", street: "Rue X 1" });
    const unlinked = cand({ id: "unlinked", communeId: null, street: "Rue X 1" });
    const r = pickSurvivor([unlinked, linked]);
    expect(r.survivor.id).toBe("linked");
    expect(r.losers[0].reason).toContain("commune");
  });

  it("départage par date de mise à jour en dernier recours", () => {
    const older = cand({ id: "older", updatedAt: new Date("2024-01-01") });
    const newer = cand({ id: "newer", updatedAt: new Date("2026-01-01") });
    const r = pickSurvivor([older, newer]);
    expect(r.survivor.id).toBe("newer");
  });

  it("un seul bureau = pas de perdant", () => {
    const only = cand({ id: "only" });
    const r = pickSurvivor([only]);
    expect(r.survivor.id).toBe("only");
    expect(r.losers).toEqual([]);
  });

  it("chaque perdant a une raison non vide", () => {
    const a = cand({ id: "a", street: "Rue A 1", phone: "0800" });
    const b = cand({ id: "b", street: "Adresse à confirmer" });
    const c = cand({ id: "c", name: "Police Administrative", street: "Rue C 3" });
    const r = pickSurvivor([a, b, c]);
    expect(r.survivor.id).toBe("a");
    expect(r.losers).toHaveLength(2);
    for (const l of r.losers) expect(l.reason.length).toBeGreaterThan(0);
  });
});

describe("groupDuplicates", () => {
  it("regroupe deux bureaux liés à la même commune", () => {
    const a = cand({ id: "a", communeId: "c1", name: "CPAS de Manage" });
    const b = cand({ id: "b", communeId: "c1", name: "Antenne CPAS" });
    const groups = groupDuplicates([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("fusionne un enregistrement lié et son jumeau non lié (même nom + CP)", () => {
    const linked = cand({ id: "linked", communeId: "c1", name: "OCMW", postalCode: "2500" });
    const orphan = cand({ id: "orphan", communeId: null, name: "OCMW", postalCode: "2500" });
    const groups = groupDuplicates([linked, orphan]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((x) => x.id).sort()).toEqual(["linked", "orphan"]);
  });

  it("ne regroupe pas des bureaux de communes différentes avec des noms différents", () => {
    const a = cand({ id: "a", communeId: "c1", name: "CPAS de Namur", postalCode: "5000" });
    const b = cand({ id: "b", communeId: "c2", name: "CPAS de Liège", postalCode: "4000" });
    const groups = groupDuplicates([a, b]);
    expect(groups).toHaveLength(0); // aucun groupe de doublons (chacun seul)
  });

  it("ne fusionne PAS deux communes distinctes au nom+CP identique (générique)", () => {
    // Deux communes voisines partageant un CP, chacune avec sa maison communale
    // au nom générique → ce sont des bureaux DIFFÉRENTS, jamais des doublons.
    const a = cand({ id: "a", type: "COMMUNE", communeId: "c1", name: "Administration communale", postalCode: "4800" });
    const b = cand({ id: "b", type: "COMMUNE", communeId: "c2", name: "Administration communale", postalCode: "4800" });
    const groups = groupDuplicates([a, b]);
    expect(groups).toHaveLength(0);
  });

  it("ne mélange pas des types différents", () => {
    const cpas = cand({ id: "cpas", type: "CPAS", communeId: "c1" });
    const commune = cand({ id: "commune", type: "COMMUNE", communeId: "c1" });
    const groups = groupDuplicates([cpas, commune]);
    expect(groups).toHaveLength(0);
  });

  it("chaîne transitivement A-B (commune) et B-C (nom+CP) en un seul groupe", () => {
    const a = cand({ id: "a", communeId: "c1", name: "Stadhuis X", postalCode: "9000" });
    const b = cand({ id: "b", communeId: "c1", name: "Stadhuis Y", postalCode: "9000" });
    const c = cand({ id: "c", communeId: null, name: "Stadhuis Y", postalCode: "9000" });
    const groups = groupDuplicates([a, b, c]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((x) => x.id).sort()).toEqual(["a", "b", "c"]);
  });
});
