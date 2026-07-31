/// Génère un jeu de C1B remplis couvrant toutes les branches, et sert de
/// support à la relecture case par case du PDF (aucun test ne certifie qu'une
/// déclaration officielle est correcte).
///
/// Décalque de `gen-c1c-scenarios.ts` / `gen-c47-scenarios.ts`.
///
/// Usage :
///   pnpm tsx scripts/gen-c1b-scenarios.ts
///   python scripts/verif-couverture-widgets.py "$TEMP/c1b-scenarios" private/pdfs/C1B_FR.pdf
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fillForm } from "@/lib/pdf-forms/filler";
import { applyC1BImprovements } from "@/lib/pdf-forms/seed/c1b-fields";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { applyServerAutoFields } from "@/lib/pdf-forms/auto-fields";
import { visiblePayload } from "@/lib/pdf-forms/validation";
import type { FormPayload, PdfFormField } from "@/lib/pdf-forms/types";

const SORTIE = process.argv[2] ?? join(process.env.TEMP ?? ".", "c1b-scenarios");
const SOURCE = "private/pdfs/C1B_FR.pdf";

interface Scenario {
  cle: string;
  titre: string;
  payload: FormPayload;
}

/// Identité commune : le C1B la reçoit du C1 dans un dossier, mais le PDF la
/// porte quand même.
const IDENTITE = (nom: string, prenom: string, niss: string): FormPayload => ({
  niss,
  nom,
  pr_nom: prenom,
  rue: "Rue de la Station",
  num_ro: "14",
  code_postal: "5000",
  commune: "Namur",
});

const SCENARIOS: Scenario[] = [
  {
    // Le parcours le plus court : « non » partout.
    cle: "1-tout-non",
    titre: "Aucun revenu à déclarer — toutes les réponses « non »",
    payload: {
      ...IDENTITE("Vandenbroucke", "Amélie", "85.07.14-231.05"),
      droitPensionRetraiteComplete: "non",
      percoitPension: "non",
      indemniteMaladieInvaliditeEtrangere: "non",
      indemniteAccidentTravailBelge: "non",
      indemniteAccidentTravailEtrangere: "non",
      congeSansSolde: "non",
      nombreAnnexes: "0",
    },
  },
  {
    // LA question que ce lot répare : la pension de survie belge ouvre trois
    // dates du champ `Date46_af_date` — dont un « du » et un « au » qui
    // sortaient identiques, quand ils sortaient.
    cle: "2-pension-survie-belge-quatre-dates",
    titre: "Pension de survie belge — les quatre dates doivent être DIFFÉRENTES",
    payload: {
      ...IDENTITE("El Ouazzani", "Mohammed", "78.11.02-088.44"),
      droitPensionRetraiteComplete: "oui",
      typePensionRetraiteComplete: "belge",
      denominationPensionRetraiteComplete: "Pension de retraite du secteur privé",
      datePensionRetraiteComplete: "2026-01-15",
      percoitPension: "oui",
      typePensionPercue: "survie-belge",
      dateEffetPensionSurvieBelge: "2025-09-01",
      cumulPensionSurvieChomage: "oui",
      cumulAnterieurMaladieChomagePrepension: "oui",
      cumulAnterieurDateDebut: "2023-03-10",
      cumulAnterieurDateFin: "2024-11-28",
      indemniteMaladieInvaliditeEtrangere: "non",
      indemniteAccidentTravailBelge: "non",
      indemniteAccidentTravailEtrangere: "non",
      congeSansSolde: "non",
      nombreAnnexes: "3",
      annexeDecisionsBelges: true,
      annexeCopiesPaiement: true,
      annexeModele74: true,
    },
  },
  {
    // Second champ partagé : les deux bornes du congé sans solde.
    cle: "3-conge-sans-solde",
    titre: "Congé sans solde — les deux bornes de la période doivent différer",
    payload: {
      ...IDENTITE("De Clercq", "Sofie", "94.03.28-088.44"),
      droitPensionRetraiteComplete: "non",
      percoitPension: "oui",
      typePensionPercue: "retraite-belge",
      indemniteMaladieInvaliditeEtrangere: "oui",
      montantIndemniteMaladieInvalidite: "1234,56",
      indemniteAccidentTravailBelge: "oui",
      natureIndemniteAccidentTravail: "totale-temporaire",
      indemniteAccidentTravailEtrangere: "non",
      congeSansSolde: "oui",
      congeSansSoldeNomEmployeur: "Menuiserie Delcourt SRL",
      congeSansSoldeAdresseEmployeur: "Chaussée de Marche 1042, 5100 Jambes",
      congeSansSoldeDateDebut: "2026-02-01",
      congeSansSoldeDateFin: "2026-05-31",
      nombreAnnexes: "2",
      annexeDecisionsEtrangeres: true,
      annexeAutre: true,
      // Deux lignes pointillées COURTES sur le papier : au-delà d'environ 110
      // caractères, le filler ne peut plus réduire (plancher à 5 pt) et signale
      // « caracteres-non-rendus » plutôt que de couper en silence.
      annexeAutreDescription:
        "Attestation de l'organisme assureur : incapacité permanente, consolidée le 12 janvier 2026.",
    },
  },
  {
    // Pension étrangère + textes longs + nom non latin.
    cle: "4-textes-longs",
    titre: "Textes longs et nom non latin",
    payload: {
      ...IDENTITE("Παπαδόπουλος", "Οδυσσέας", "69.12.31-999.09"),
      droitPensionRetraiteComplete: "oui",
      typePensionRetraiteComplete: "etrangere",
      denominationPensionRetraiteComplete:
        "Pension de retraite du secteur public grec (ΕΦΚΑ), régime des fonctionnaires territoriaux, liquidée par l'organisme unifié de sécurité sociale, avec complément de carrière mixte belgo-grecque.",
      datePensionRetraiteComplete: "2026-12-31",
      percoitPension: "oui",
      typePensionPercue: "retraite-etrangere",
      indemniteMaladieInvaliditeEtrangere: "non",
      indemniteAccidentTravailBelge: "non",
      indemniteAccidentTravailEtrangere: "oui",
      congeSansSolde: "non",
      nombreAnnexes: "1",
      annexeDecisionsEtrangeres: true,
    },
  },
  {
    // Les faces « non » des deux questions de la rubrique 7, et la pension de
    // retraite belge PERÇUE (par opposition au simple droit de la question 1).
    cle: "5-pension-retraite-percue-refus-cumul",
    titre: "Pension de retraite belge perçue — refus de cumul, pas de cumul antérieur",
    payload: {
      ...IDENTITE("Vanderstichelen", "Louise", "88.02.29-123.19"),
      droitPensionRetraiteComplete: "oui",
      typePensionRetraiteComplete: "etrangere",
      denominationPensionRetraiteComplete: "Pension de retraite d'indépendant",
      datePensionRetraiteComplete: "2026-07-01",
      percoitPension: "oui",
      typePensionPercue: "survie-belge",
      dateEffetPensionSurvieBelge: "2026-06-15",
      cumulPensionSurvieChomage: "non",
      cumulAnterieurMaladieChomagePrepension: "non",
      indemniteMaladieInvaliditeEtrangere: "non",
      indemniteAccidentTravailBelge: "oui",
      natureIndemniteAccidentTravail: "permanente",
      indemniteAccidentTravailEtrangere: "non",
      congeSansSolde: "non",
      nombreAnnexes: "1",
      annexeDecisionsBelges: true,
    },
  },
  {
    // La quatrième option de la question 6, seule non couverte ailleurs.
    cle: "6-pension-survie-etrangere",
    titre: "Pension de survie étrangère",
    payload: {
      ...IDENTITE("Berger", "Nadia", "82.06.15-201.19"),
      droitPensionRetraiteComplete: "non",
      percoitPension: "oui",
      typePensionPercue: "survie-etrangere",
      indemniteMaladieInvaliditeEtrangere: "non",
      indemniteAccidentTravailBelge: "oui",
      natureIndemniteAccidentTravail: "partielle-temporaire",
      indemniteAccidentTravailEtrangere: "non",
      congeSansSolde: "non",
      nombreAnnexes: "2",
      annexeDecisionsEtrangeres: true,
      annexeCopiesPaiement: true,
    },
  },
];

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  mkdirSync(join(SORTIE, "_controle"), { recursive: true });
  const source = readFileSync(SOURCE);
  const parsed = await parsePdf(source);
  const fields = applyC1BImprovements([]) as PdfFormField[];

  const rapport: Record<string, unknown>[] = [];

  for (const s of SCENARIOS) {
    const complet = applyServerAutoFields(fields, s.payload, new Date().toISOString().slice(0, 10));
    const extraStamps = resolveStamps(visiblePayload(fields, complet), getRulesForSlug("c1b"));

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
