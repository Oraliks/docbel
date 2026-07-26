import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parsePdf } from "../acroform-parser";
import { buildEnrichedSchema } from "../field-inference";
import { applyC1Improvements } from "../seed/c1-fields-improvements";
import { resolveStamps } from "../bindings/engine";
import { getRulesForSlug } from "../bindings/registry";
import type { PdfFormField } from "../types";

/// Le schéma tel qu'il part VRAIMENT en base : inférence + seed.
///
/// C'est la couche que rien ne couvrait. `seeds-vs-pdf` appelle `improve([])`
/// et ne voit donc que le seed isolé — jamais les champs que l'import déduit
/// tout seul des widgets du PDF. Or c'est précisément là que le C1 dérapait :
/// l'inférence lit l'infobulle `/TU` de chaque widget pour deviner type et
/// libellé, et certaines infobulles ONEM décrivent autre chose que leur case.

const C1 = join(process.cwd(), "private", "pdfs", "C1_FR.pdf");
const source = existsSync(C1) ? readFileSync(C1) : null;
const skip = source ? it : it.skip;

async function schemaReel(): Promise<PdfFormField[]> {
  const tech = (await parsePdf(source!)).fields;
  return applyC1Improvements(buildEnrichedSchema(tech), {
    defaultMotif: "modification",
    restrictMotifTo5Situations: true,
    technicalSchema: tech,
  });
}

describe("C1 — champs inférés à l'import", () => {
  skip("aucun champ ne revendique la case « nom du titulaire »", async () => {
    // L'inférence produisait `nomtitulairesipasok`, typé `iban` d'après une
    // infobulle trompeuse (« Le n° IBAN se trouve sur vos extraits de compte »).
    // Résultat sur le PDF généré : l'IBAN imprimé dans la case réservée au NOM
    // du titulaire, et une seconde question IBAN posée au citoyen.
    const fields = await schemaReel();
    const revendications = fields.filter((f) => f.pdfFieldName === "NomTitulaireSipasOk");
    expect(revendications.map((f) => f.id)).toEqual([]);
  });

  skip("la case reste alimentée par la règle serveur, elle ne devient pas orpheline", () => {
    // Contrôle négatif : retirer le champ inféré ne doit pas laisser la case
    // vierge quand le compte est au nom d'un tiers.
    const stamps = resolveStamps(
      {
        modePaiement: "virement",
        titulaireCompte: "autre-nom",
        titulaireCompteNom: "Marie Dupont",
      },
      getRulesForSlug("c1-changement-situation")
    );
    expect(stamps.get("NomTitulaireSipasOk")).toBe("Marie Dupont");
  });

  skip("aucune question visible ne porte le libellé d'infobulle trompeur", async () => {
    const fields = await schemaReel();
    const trompeurs = fields.filter(
      (f) => !f.hidden && /extraits de compte/i.test(f.label?.fr ?? "")
    );
    expect(trompeurs.map((f) => f.id)).toEqual([]);
  });
});
