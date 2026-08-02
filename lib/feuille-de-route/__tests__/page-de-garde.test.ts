import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildPageDeGarde } from "../page-de-garde";
import { buildFeuilleDeRoute } from "../build";

const FEUILLE = buildFeuilleDeRoute({
  pieces: [
    { slug: "c1-changement", titre: "C1 — Déclaration de situation" },
    { slug: "c1-partenaire", titre: "C1-Partenaire" },
  ],
  serverData: {
    communeName: "Bruxelles",
    bureauxParOp: [
      {
        opCode: "capac",
        nom: "CAPAC Bruxelles",
        adresse: "Rue de Brabant 62, 1210 Bruxelles",
        telephone: "02 000 00 00",
        siteWeb: null,
        rendezVousUrl: null,
      },
    ],
  },
  opChoice: "capac",
});

describe("buildPageDeGarde", () => {
  it("produit un PDF valide d'au moins une page", async () => {
    const bytes = await buildPageDeGarde(FEUILLE);
    expect(bytes.length).toBeGreaterThan(500);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("mode générique : produit aussi un PDF valide (jamais de crash sans bureau)", async () => {
    const generique = buildFeuilleDeRoute({ pieces: [], serverData: null, opChoice: null });
    const doc = await PDFDocument.load(await buildPageDeGarde(generique));
    expect(doc.getPageCount()).toBe(1);
  });
});
