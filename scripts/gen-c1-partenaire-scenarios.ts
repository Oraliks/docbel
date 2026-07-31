/// Génère un jeu de C1-PARTENAIRE remplis couvrant toutes les branches, et sert
/// de support à la relecture case par case du PDF (aucun test ne certifie
/// qu'une déclaration officielle est correcte).
///
/// Décalque de `gen-c1c-scenarios.ts` / `gen-c47-scenarios.ts`.
///
/// Usage :
///   pnpm tsx scripts/gen-c1-partenaire-scenarios.ts
///   python scripts/verif-couverture-widgets.py "$TEMP/c1-partenaire-scenarios" private/pdfs/C1-Partenaire_FR.pdf
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fillForm } from "@/lib/pdf-forms/filler";
import { applyC1PartenaireImprovements } from "@/lib/pdf-forms/seed/c1-partenaire-fields";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { applyServerAutoFields } from "@/lib/pdf-forms/auto-fields";
import { visiblePayload } from "@/lib/pdf-forms/validation";
import type { FormPayload, PdfFormField } from "@/lib/pdf-forms/types";

const SORTIE = process.argv[2] ?? join(process.env.TEMP ?? ".", "c1-partenaire-scenarios");
const SOURCE = "private/pdfs/C1-Partenaire_FR.pdf";

interface Scenario {
  cle: string;
  titre: string;
  payload: FormPayload;
}

/// Les six questions imprimées, dans l'ordre, pour les scénarios « tout non » /
/// « tout oui » — évite six lignes recopiées à chaque fois.
const QUESTIONS = [
  "partenaireRevenuProfessionnel",
  "partenaireRevenuRemplacement",
  "partenaireRevenuIntegration",
  "partenaireDejaDeclareAutreChomeur",
  "partenaireApparente3eDegre",
  "partenaireAllocationsFamiliales",
] as const;

const toutes = (reponse: "oui" | "non"): FormPayload =>
  Object.fromEntries(QUESTIONS.map((q) => [q, reponse]));

const SCENARIOS: Scenario[] = [
  {
    // Le cas nominal du formulaire : partenaire sans aucun revenu, aucune des
    // six situations. Toutes les cases « non » sont cochées.
    cle: "1-partenaire-sans-revenu",
    titre: "Partenaire sans revenu — les six réponses « non »",
    payload: {
      ...toutes("non"),
      niss_ch_meur: "85.07.14-231.05",
      nom_ch_meur: { first: "Amélie", last: "Vandenbroucke" },
      niss_partenaire: "90.03.22-145.83",
      nom_partenaire: "Lefèvre Thomas",
    },
  },
  {
    // Les deux montants mensuels bruts, qui partagent un champ AcroForm et
    // DOIVENT désormais sortir différents : 1 850 € de salaire d'un côté,
    // 1 200 € d'indemnité de mutuelle de l'autre.
    cle: "2-deux-montants-distincts",
    titre: "Revenu professionnel ET de remplacement — deux montants différents",
    payload: {
      ...toutes("non"),
      niss_ch_meur: "78.11.02-088.44",
      nom_ch_meur: { first: "Mohammed", last: "El Ouazzani" },
      niss_partenaire: "82.06.15-201.19",
      nom_partenaire: "El Ouazzani-Berger Nadia",
      partenaireRevenuProfessionnel: "oui",
      m_tier: "salariée (mi-temps, secteur horeca)",
      montant_mensuel_brut: "1850,00",
      partenaireRevenuRemplacement: "oui",
      revenu_de_remplacement: "indemnité de mutuelle",
      montantMensuelBrutRemplacement: "1200,00",
    },
  },
  {
    // Toutes les cases « oui » : couvre les six widgets `oui_N` et les deux
    // lignes de précision.
    cle: "3-toutes-les-cases-oui",
    titre: "Les six réponses « oui » — couverture des cases oui_N",
    payload: {
      ...toutes("oui"),
      niss_ch_meur: "69.12.31-999.09",
      nom_ch_meur: { first: "Jean-Baptiste", last: "Vanderstichelen-Delacroix" },
      niss_partenaire: "01.01.2005",
      nom_partenaire: "Vanderstichelen Louise",
      m_tier: "indépendante",
      // Activité indépendante : le formulaire dit en note (2) de NE PAS
      // indiquer le montant mensuel brut. La case reste donc vide.
      revenu_de_remplacement: "allocation de chômage",
      montantMensuelBrutRemplacement: "1043,72",
    },
  },
  {
    // Textes longs et nom non latin — réduction de police et repli de police.
    cle: "4-textes-longs-et-non-latins",
    titre: "Textes longs et nom non latin",
    payload: {
      ...toutes("non"),
      niss_ch_meur: "88.02.29-123.19",
      nom_ch_meur: { first: "Οδυσσέας", last: "Παπαδόπουλος" },
      niss_partenaire: "95.09.09-333.61",
      nom_partenaire: "Παπαδοπούλου Ελένη",
      partenaireRevenuProfessionnel: "oui",
      m_tier:
        "salariée à temps partiel comme aide-soignante en maison de repos, et indépendante complémentaire en couture",
      montant_mensuel_brut: "1234,56",
    },
  },
];

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  mkdirSync(join(SORTIE, "_controle"), { recursive: true });
  const source = readFileSync(SOURCE);
  const parsed = await parsePdf(source);
  const fields = applyC1PartenaireImprovements([]) as PdfFormField[];

  const rapport: Record<string, unknown>[] = [];

  for (const s of SCENARIOS) {
    const complet = applyServerAutoFields(fields, s.payload, new Date().toISOString().slice(0, 10));
    const extraStamps = resolveStamps(
      visiblePayload(fields, complet),
      getRulesForSlug("c1-partenaire")
    );

    for (const flatten of [true, false]) {
      const { bytes, diagnostics } = await fillForm(source, fields, complet, {
        flatten,
        technicalSchema: parsed.fields,
        extraStamps,
      });
      writeFileSync(join(SORTIE, flatten ? `${s.cle}.pdf` : `_controle/${s.cle}.pdf`), bytes);
      if (flatten) {
        rapport.push({ cle: s.cle, titre: s.titre, diagnostics });
        if (diagnostics.length > 0) console.log(`  ⚠ ${s.cle} :`, JSON.stringify(diagnostics));
      }
    }
    console.log(`✓ ${s.cle} — ${s.titre}`);
  }

  writeFileSync(join(SORTIE, "_controle", "rapport.json"), JSON.stringify(rapport, null, 2));
  console.log(`\n${SCENARIOS.length} scénarios écrits dans ${SORTIE}`);
}

main();
