import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parsePdf } from "../../acroform-parser";
import { checkPublishable } from "../../publish-checks";
import { getRulesForSlug } from "../../bindings/registry";
import type { AcroFieldRaw, PdfFormField } from "../../types";

import { applyC1Improvements } from "../c1-fields-improvements";
import { applyC1RegisImprovements } from "../c1-regis-fields";
import { applyC1PartenaireImprovements } from "../c1-partenaire-fields";
import { applyC1AImprovements } from "../c1a-fields";
import { applyC1BImprovements } from "../c1b-fields";
import { applyC1CImprovements } from "../c1c-fields";
import { applyC46Improvements } from "../c46-fields";
import { applyC47Improvements } from "../c47-fields";

/// Garde-fou seed ↔ PDF RÉEL.
///
/// Un `pdfFieldName` est le nom EXACT du widget AcroForm : une apostrophe
/// typographique retapée en apostrophe ASCII, un double espace normalisé, un
/// accent perdu — et le champ pointe dans le vide. Le filler ne dit rien
/// (`filler.ts` fait `continue` sur un widget introuvable), la case reste
/// blanche sur le PDF officiel, et personne ne s'en aperçoit avant l'usager.
///
/// C'est exactement ce qui était arrivé au C47 (2 cases « inaptitude 33 % »
/// avec `'` au lieu de `’`, formulaire impubliable sans que rien ne l'indique).
/// Les PDF sources sont versionnés dans `private/pdfs/`, donc la vérification
/// ne coûte qu'un parse : on la fait ici, à chaque `pnpm test`.
///
/// Ce test NE remplace PAS le contrôle admin (onglet « Mapping AcroForm ») :
/// il vérifie le SEED seul, pas le schéma réellement en base, qui peut
/// contenir en plus des champs inférés à l'import.
const TARGETS: Array<{
  slug: string;
  pdf: string;
  improve: (fields: PdfFormField[], ctx?: { technicalSchema: AcroFieldRaw[] }) => PdfFormField[];
}> = [
  {
    slug: "c1-changement-situation",
    pdf: "C1_FR.pdf",
    improve: (fields, ctx) =>
      applyC1Improvements(fields, {
        defaultMotif: "modification",
        restrictMotifTo5Situations: true,
        technicalSchema: ctx?.technicalSchema,
      }),
  },
  { slug: "c1-regis", pdf: "Annexe_Regis_FR.pdf", improve: applyC1RegisImprovements },
  { slug: "c1-partenaire", pdf: "C1-Partenaire_FR.pdf", improve: applyC1PartenaireImprovements },
  { slug: "c1a", pdf: "C1A_FR.pdf", improve: applyC1AImprovements },
  { slug: "c1b", pdf: "C1B_FR.pdf", improve: applyC1BImprovements },
  { slug: "c1c", pdf: "C1C_FR.pdf", improve: applyC1CImprovements },
  { slug: "c46", pdf: "C46_FR.pdf", improve: applyC46Improvements },
  { slug: "c47", pdf: "C47_FR.pdf", improve: applyC47Improvements },
];

const PDF_DIR = join(process.cwd(), "private", "pdfs");

describe("seeds ↔ PDF réel — aucun champ ne pointe dans le vide", () => {
  for (const target of TARGETS) {
    const path = join(PDF_DIR, target.pdf);

    it(`${target.slug} (${target.pdf}) est publiable sans erreur`, async ({ skip }) => {
      // Les PDF sont versionnés, mais un checkout partiel ne doit pas faire
      // échouer la suite : on saute plutôt que de crier au loup.
      if (!existsSync(path)) skip();

      const parsed = await parsePdf(readFileSync(path));
      expect(parsed.hasAcroForm, `${target.pdf} n'a pas d'AcroForm`).toBe(true);

      const fields = target.improve([], { technicalSchema: parsed.fields });
      const issues = checkPublishable(fields, parsed.fields, ["fr"], {
        bindingRules: getRulesForSlug(target.slug),
      });
      const errors = issues.filter((i) => i.level === "error");

      expect(
        errors.map((e) => `${e.fieldId ?? "-"} : ${e.message}`),
        `${target.slug} : erreurs bloquantes de publication`,
      ).toEqual([]);
    });
  }
});
