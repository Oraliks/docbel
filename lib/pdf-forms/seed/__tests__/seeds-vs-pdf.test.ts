import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parsePdf } from "../../acroform-parser";
import { checkPublishable } from "../../publish-checks";
import { buildMappingReport } from "../../mapping-report";
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

/// Widgets du C1 que RIEN n'écrit — et c'est voulu. Chaque entrée a été
/// arbitrée avec Oraliks le 2026-07-26 ; le reste des 179 widgets est couvert.
///
/// Ce test n'est pas là pour interdire l'évolution : il est là pour qu'une
/// case cesse d'être remplie SANS QUE PERSONNE NE LE VOIE. Supprimer un champ
/// rend son widget orphelin en silence — le PDF officiel part alors avec une
/// case vide, et ni le filler (qui ignore un widget introuvable) ni la
/// publication (qui tolère 25 % d'orphelins) ne le signalent.
const C1_ORPHELINS_ASSUMES: Record<string, string> = {
  // Branche « première demande d'allocations » : hors périmètre du dossier
  // « changement de situation personnelle ». À brancher le jour où un dossier
  // réutilise le C1 en mode demande.
  DateAllocation: "première demande — hors périmètre de ce dossier",
  "je demande des allocations à partir du": "première demande — hors périmètre de ce dossier",
  // Colonne « lien de parenté » de la grille cohabitants : on y stampe un code
  // court (FAC, enfant, époux…) qui tient sur la ligne 1. La ligne 2 reste
  // libre — décision assumée, cf. le commentaire du sous-champ `lien`.
  Personne1_LienParente_Ligne2: "2e ligne du lien de parenté — volontairement libre",
  Personne2_LienParente_Ligne2: "2e ligne du lien de parenté — volontairement libre",
  Personne3_LienParente_Ligne2: "2e ligne du lien de parenté — volontairement libre",
  Personne4_LienParente_Ligne2: "2e ligne du lien de parenté — volontairement libre",
  Personne5_LienParente_Ligne2: "2e ligne du lien de parenté — volontairement libre",
};

/// Idem pour le C1C, réaligné le 2026-07-30. Un seul orphelin, et il est
/// structurel : le champ AcroForm `Nom de lentreprise` porte TROIS widgets
/// (`/Kids`) — la ligne du nom, le guide BCE « personne physique » et le guide
/// BCE « de l'entreprise ». Trois emplacements, trois valeurs différentes, une
/// seule valeur possible : le champ est inutilisable par son nom, et ses trois
/// cases sont écrites en positionnel (`drawAt`), ce que le rapport ne compte
/// pas comme une claim.
const C1C_ORPHELINS_ASSUMES: Record<string, string> = {
  "Nom de lentreprise":
    "champ à 3 widgets — nom d'entreprise + 2 guides BCE, écrits en positionnel",
};

describe("C1C — couverture des widgets AcroForm", () => {
  it("ne laisse orphelins QUE les widgets assumés", async ({ skip }) => {
    const target = TARGETS.find((t) => t.slug === "c1c")!;
    const path = join(PDF_DIR, target.pdf);
    if (!existsSync(path)) skip();

    const parsed = await parsePdf(readFileSync(path));
    const fields = target.improve([], { technicalSchema: parsed.fields });
    const report = buildMappingReport(fields, parsed.fields, getRulesForSlug(target.slug));

    const orphans = report.rows.filter((r) => r.status === "orphan").map((r) => r.pdfFieldName);
    expect(orphans.sort()).toEqual(Object.keys(C1C_ORPHELINS_ASSUMES).sort());
    expect(report.summary.conflict, "aucun widget ne doit être revendiqué deux fois").toBe(0);
  });
});

describe("C1 — couverture des widgets AcroForm", () => {
  it("ne laisse orphelins QUE les widgets assumés", async ({ skip }) => {
    const target = TARGETS[0];
    const path = join(PDF_DIR, target.pdf);
    if (!existsSync(path)) skip();

    const parsed = await parsePdf(readFileSync(path));
    const fields = target.improve([], { technicalSchema: parsed.fields });
    const report = buildMappingReport(fields, parsed.fields, getRulesForSlug(target.slug));

    const orphans = report.rows.filter((r) => r.status === "orphan").map((r) => r.pdfFieldName);
    expect(orphans.sort()).toEqual(Object.keys(C1_ORPHELINS_ASSUMES).sort());
    expect(report.summary.conflict, "aucun widget ne doit être revendiqué deux fois").toBe(0);
  });
});
