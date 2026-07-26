import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parsePdf } from "../acroform-parser";
import { buildEnrichedSchema } from "../field-inference";
import { applyC1Improvements } from "../seed/c1-fields-improvements";
import { applyC1AImprovements } from "../seed/c1a-fields";
import { applyC1BImprovements } from "../seed/c1b-fields";
import { resolveStamps } from "../bindings/engine";
import { getRulesForSlug } from "../bindings/registry";
import type { AcroFieldRaw, PdfFormField } from "../types";

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

/// Les widgets écrits par une RÈGLE serveur, et qui ne doivent donc être
/// revendiqués par AUCUN champ — ni du seed, ni de l'inférence. C'est le motif
/// exact des quatre conflits trouvés le 2026-07-26 : le champ inféré survit,
/// pose une question en double au citoyen, et se bat avec la règle pour la même
/// case. La liste des `LEGACY_*_FIELD_IDS` visait jusque-là les `id` camelCase
/// d'anciens schémas, jamais ceux que l'inférence PRODUIT.
const WIDGETS_RESERVES_AUX_REGLES: Array<{
  form: string;
  pdf: string;
  widget: string;
  improve: (fields: PdfFormField[], tech: AcroFieldRaw[]) => PdfFormField[];
}> = [
  {
    form: "C1",
    pdf: "C1_FR.pdf",
    widget: "CodePostal et Commune",
    improve: (f, tech) =>
      applyC1Improvements(f, {
        defaultMotif: "modification",
        restrictMotifTo5Situations: true,
        technicalSchema: tech,
      }),
  },
  { form: "C1A", pdf: "C1A_FR.pdf", widget: "Code postal et commune", improve: applyC1AImprovements },
  { form: "C1B", pdf: "C1B_FR.pdf", widget: "Nom", improve: applyC1BImprovements },
];

describe.each(WIDGETS_RESERVES_AUX_REGLES)(
  "$form — le widget « $widget » est réservé à sa règle serveur",
  ({ pdf, widget, improve }) => {
    const chemin = join(process.cwd(), "private", "pdfs", pdf);
    const dispo = existsSync(chemin);
    (dispo ? it : it.skip)("aucun champ ne le revendique", async () => {
      const tech = (await parsePdf(readFileSync(chemin))).fields;
      const fields = improve(buildEnrichedSchema(tech), tech);
      expect(fields.filter((f) => f.pdfFieldName === widget).map((f) => f.id)).toEqual([]);
    });
  }
);

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
