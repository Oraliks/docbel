import { describe, expect, it } from "vitest";
import { buildFeuilleDeRoute } from "../build";
import type { BureauFeuille, PieceFeuille } from "../model";

const PIECES: PieceFeuille[] = [
  { slug: "c1-changement", titre: "C1 — Déclaration de la situation personnelle et familiale" },
  { slug: "c1-partenaire", titre: "C1-Partenaire" },
];

const BUREAU_CAPAC: BureauFeuille = {
  opCode: "capac",
  nom: "CAPAC Bruxelles",
  adresse: "Rue de Brabant 62, 1210 Bruxelles",
  telephone: null,
  siteWeb: null,
  rendezVousUrl: null,
};
const BUREAU_FGTB: BureauFeuille = { ...BUREAU_CAPAC, opCode: "fgtb", nom: "FGTB Bruxelles" };

describe("buildFeuilleDeRoute", () => {
  it("OP choisi + bureau connu → dépôt ciblé sur CE bureau", () => {
    const f = buildFeuilleDeRoute({
      pieces: PIECES,
      serverData: { communeName: "Bruxelles", bureauxParOp: [BUREAU_CAPAC, BUREAU_FGTB] },
      opChoice: "capac",
    });
    expect(f.depot).toEqual({ mode: "bureau", opCode: "capac", bureau: BUREAU_CAPAC });
    expect(f.communeName).toBe("Bruxelles");
  });

  it("sans choix d'OP → mode choix avec les bureaux disponibles", () => {
    const f = buildFeuilleDeRoute({
      pieces: PIECES,
      serverData: { communeName: "Bruxelles", bureauxParOp: [BUREAU_CAPAC, BUREAU_FGTB] },
      opChoice: null,
    });
    expect(f.depot.mode).toBe("choix");
    if (f.depot.mode === "choix") expect(f.depot.bureaux).toHaveLength(2);
  });

  it("OP choisi mais absent de la liste → retombe en mode choix (jamais d'écran vide)", () => {
    const f = buildFeuilleDeRoute({
      pieces: PIECES,
      serverData: { communeName: "Bruxelles", bureauxParOp: [BUREAU_FGTB] },
      opChoice: "capac",
    });
    expect(f.depot.mode).toBe("choix");
  });

  it("aucune donnée serveur → repli générique", () => {
    const f = buildFeuilleDeRoute({ pieces: PIECES, serverData: null, opChoice: "capac" });
    expect(f.depot).toEqual({ mode: "generique" });
    expect(f.communeName).toBeNull();
  });

  it("les consignes portent les faits du registre, dans l'ordre des pièces", () => {
    const f = buildFeuilleDeRoute({ pieces: PIECES, serverData: null, opChoice: null });
    expect(f.consignes.map((c) => c.slug)).toEqual(["c1-changement", "c1-partenaire"]);
    expect(f.consignes[0].exemplaires).toBe(1);
    expect(f.consignes[1].exemplaires).toBe(3);
    expect(f.consignes[1].signatures).toMatch(/partenaire/i);
  });

  it("la phrase de prudence est toujours présente", () => {
    const f = buildFeuilleDeRoute({ pieces: [], serverData: null, opChoice: null });
    expect(f.prudence).toMatch(/ONEM/);
  });
});
