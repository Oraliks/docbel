import { describe, it, expect } from "vitest";
import {
  planChomageAssignments,
  planNearestAssignments,
  type CpMapping,
  type CommuneGeo,
  type SectionGeo,
} from "../assignment-plan";

describe("planChomageAssignments", () => {
  const cpToCommune = new Map([
    ["2000", "anvers"],
    ["2018", "anvers"],
    ["1000", "bxl"],
    ["9999", "sanscommune"],
  ]);
  const bureauByNumero = new Map([
    ["711", "bureau-anvers"],
    ["921", "bureau-bxl"],
  ]);

  it("mappe CP → commune → bureau ONEM", () => {
    const cps: CpMapping[] = [{ postalCode: "1000", bcCode: "921" }];
    const plan = planChomageAssignments(cps, cpToCommune, bureauByNumero);
    expect(plan).toEqual([{ bureauId: "bureau-bxl", communeId: "bxl" }]);
  });

  it("déduplique plusieurs CP de la même commune vers un seul assignment", () => {
    const cps: CpMapping[] = [
      { postalCode: "2000", bcCode: "711" },
      { postalCode: "2018", bcCode: "711" },
    ];
    const plan = planChomageAssignments(cps, cpToCommune, bureauByNumero);
    expect(plan).toEqual([{ bureauId: "bureau-anvers", communeId: "anvers" }]);
  });

  it("ignore un BC sans bureau, un CP sans commune, un bcCode vide", () => {
    const cps: CpMapping[] = [
      { postalCode: "1000", bcCode: "000" }, // bureau introuvable
      { postalCode: "9999", bcCode: "921" }, // commune existe mais…
      { postalCode: "0000", bcCode: "921" }, // CP inconnu
      { postalCode: "1000", bcCode: null }, // pas de BC
    ];
    const plan = planChomageAssignments(cps, cpToCommune, bureauByNumero);
    // seul 9999→sanscommune via 921 est valide
    expect(plan).toEqual([{ bureauId: "bureau-bxl", communeId: "sanscommune" }]);
  });

  it("produit UN SEUL assignment par commune (BC majoritaire si CP divergents)", () => {
    // Anvers a 3 CP → 711 et 1 CP → 921 : 711 gagne (majorité)
    const cps: CpMapping[] = [
      { postalCode: "2000", bcCode: "711" },
      { postalCode: "2018", bcCode: "711" },
      { postalCode: "2000", bcCode: "711" },
      { postalCode: "2018", bcCode: "921" },
    ];
    const plan = planChomageAssignments(cps, cpToCommune, bureauByNumero);
    expect(plan).toEqual([{ bureauId: "bureau-anvers", communeId: "anvers" }]);
  });
});

describe("planNearestAssignments", () => {
  // Bruxelles ≈ (50.85, 4.35), Liège ≈ (50.63, 5.57), Anvers ≈ (51.22, 4.40)
  const communes: CommuneGeo[] = [
    { communeId: "bxl", region: "brussels", lat: 50.85, lng: 4.35 },
    { communeId: "liege", region: "wallonia", lat: 50.63, lng: 5.57 },
  ];

  it("assigne chaque commune à la section la plus proche de sa région", () => {
    const sections: SectionGeo[] = [
      { bureauId: "sec-bxl", region: "brussels", lat: 50.84, lng: 4.36 },
      { bureauId: "sec-liege", region: "wallonia", lat: 50.64, lng: 5.58 },
      { bureauId: "sec-namur", region: "wallonia", lat: 50.47, lng: 4.87 },
    ];
    const plan = planNearestAssignments(communes, sections);
    expect(plan).toContainEqual({ bureauId: "sec-bxl", communeId: "bxl" });
    expect(plan).toContainEqual({ bureauId: "sec-liege", communeId: "liege" });
    expect(plan).toHaveLength(2);
  });

  it("ne traverse pas les régions (pas de section dans la région → pas d'assignment)", () => {
    const sections: SectionGeo[] = [
      { bureauId: "sec-liege", region: "wallonia", lat: 50.64, lng: 5.58 },
    ];
    const plan = planNearestAssignments(communes, sections);
    // bxl (brussels) n'a aucune section brussels → non assignée
    expect(plan).toEqual([{ bureauId: "sec-liege", communeId: "liege" }]);
  });

  it("ignore les communes sans coordonnées", () => {
    const noGeo: CommuneGeo[] = [{ communeId: "x", region: "wallonia", lat: null, lng: null }];
    const sections: SectionGeo[] = [{ bureauId: "s", region: "wallonia", lat: 50, lng: 5 }];
    expect(planNearestAssignments(noGeo, sections)).toEqual([]);
  });
});
