/// Génère un jeu de C46 remplis couvrant toutes les branches, et sert de
/// support à la relecture case par case du PDF (aucun test ne certifie qu'une
/// déclaration officielle est correcte).
///
/// Décalque de `gen-c1c-scenarios.ts` / `gen-c47-scenarios.ts`.
///
/// Usage :
///   pnpm tsx scripts/gen-c46-scenarios.ts
///   python scripts/verif-couverture-widgets.py "$TEMP/c46-scenarios" private/pdfs/C46_FR.pdf
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fillForm } from "@/lib/pdf-forms/filler";
import { applyC46Improvements } from "@/lib/pdf-forms/seed/c46-fields";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { applyServerAutoFields } from "@/lib/pdf-forms/auto-fields";
import { visiblePayload } from "@/lib/pdf-forms/validation";
import type { FormPayload, PdfFormField } from "@/lib/pdf-forms/types";

const SORTIE = process.argv[2] ?? join(process.env.TEMP ?? ".", "c46-scenarios");
const SOURCE = "private/pdfs/C46_FR.pdf";

interface Scenario {
  cle: string;
  titre: string;
  payload: FormPayload;
}

const SCENARIOS: Scenario[] = [
  {
    // Le parcours le plus court : un mandat, publié au Moniteur.
    cle: "1-un-mandat-publie",
    titre: "Un seul mandat, publié au Moniteur belge",
    payload: {
      nom_et_pr_nom: { first: "Amélie", last: "Vandenbroucke" },
      niss: "85.07.14-231.05",
      organisme1: "Conseil supérieur de la Culture de la Communauté française",
      moniteurBelgeDate1: "2026-03-12",
    },
  },
  {
    // TROIS mandats, trois dates DIFFÉRENTES — c'est le défaut que ce lot
    // répare : les trois guides partagent un champ AcroForm, et sortaient
    // identiques.
    cle: "2-trois-mandats-trois-dates",
    titre: "Trois mandats, trois dates de publication distinctes",
    payload: {
      nom_et_pr_nom: { first: "Mohammed", last: "El Ouazzani" },
      niss: "78.11.02-088.44",
      organisme1: "Commission du travail des arts",
      moniteurBelgeDate1: "2026-01-05",
      organisme2: "Conseil de la Musique",
      moniteurBelgeDate2: "2026-02-18",
      organisme3: "Conseil des Arts de la scène",
      moniteurBelgeDate3: "2026-04-30",
    },
  },
  {
    // Aucune publication : les cinq lignes d'annexe reçoivent un texte long,
    // replié par `lineTargets`.
    cle: "3-sans-publication-annexes",
    titre: "Pas de publication au Moniteur — copies de nomination en annexe",
    payload: {
      nom_et_pr_nom: { first: "Sofie", last: "De Clercq" },
      niss: "94.03.28-088.44",
      organisme1: "Conseil consultatif des Arts plastiques",
      organisme2: "Commission consultative du Patrimoine culturel immatériel",
      nominations_suivantes_1:
        "Lettre de nomination du 14 janvier 2026 signée par le président du Conseil consultatif des Arts plastiques, procès-verbal de l'assemblée générale du 20 janvier 2026 actant la désignation, et courrier de la Commission consultative du Patrimoine culturel immatériel du 3 février 2026 confirmant le mandat de membre effectif pour la période 2026-2030.",
    },
  },
  {
    // Un mandat publié, un autre non : le cas que la question « publié ? »
    // unique du schéma précédent rendait impossible.
    cle: "4-mixte-publie-et-annexe",
    titre: "Un mandat publié, un autre justifié par une annexe",
    payload: {
      nom_et_pr_nom: { first: "Jean-Baptiste", last: "Vanderstichelen-Delacroix" },
      niss: "69.12.31-999.09",
      organisme1: "Conseil supérieur de l'Audiovisuel",
      moniteurBelgeDate1: "2026-06-01",
      organisme2: "Commission du travail des arts",
      nominations_suivantes_1:
        "Procès-verbal de désignation du 12 mai 2026, non encore publié au Moniteur belge.",
    },
  },
];

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  mkdirSync(join(SORTIE, "_controle"), { recursive: true });
  const source = readFileSync(SOURCE);
  const parsed = await parsePdf(source);
  const fields = applyC46Improvements([]) as PdfFormField[];

  const rapport: Record<string, unknown>[] = [];

  for (const s of SCENARIOS) {
    const complet = applyServerAutoFields(fields, s.payload, new Date().toISOString().slice(0, 10));
    const extraStamps = resolveStamps(visiblePayload(fields, complet), getRulesForSlug("c46"));

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
