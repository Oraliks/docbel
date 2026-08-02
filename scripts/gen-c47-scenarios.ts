/// Génère un jeu de C47 remplis couvrant TOUTES les branches du formulaire, et
/// sert de support à la relecture case par case du PDF (aucun test ne certifie
/// qu'une déclaration officielle est correcte).
///
/// Décalque de `gen-c1c-scenarios.ts` : mêmes gestes que la route de
/// génération, deux sorties par scénario (aplatie + `_controle` non aplatie,
/// que `scripts/verif-couverture-widgets.py` lit toutes les deux).
///
/// Usage :
///   pnpm tsx scripts/gen-c47-scenarios.ts
///   python scripts/verif-couverture-widgets.py "$TEMP/c47-scenarios" private/pdfs/C47_FR.pdf
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fillForm } from "@/lib/pdf-forms/filler";
import { applyC47Improvements } from "@/lib/pdf-forms/seed/c47-fields";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { getCombWidgetsForSlug } from "@/lib/pdf-forms/bindings/comb-widgets";
import { applyServerAutoFields } from "@/lib/pdf-forms/auto-fields";
import { visiblePayload } from "@/lib/pdf-forms/validation";
import type { FormPayload, PdfFormField } from "@/lib/pdf-forms/types";

const SORTIE = process.argv[2] ?? join(process.env.TEMP ?? ".", "c47-scenarios");
const SOURCE = "private/pdfs/C47_FR.pdf";

interface Scenario {
  cle: string;
  titre: string;
  payload: FormPayload;
}

const SCENARIOS: Scenario[] = [
  {
    // Branche art. 114 : la SEULE qui ouvre la case date. C'est aussi celle
    // que vise le déclencheur du C1 (« incapacité permanente d'au moins 33 % »).
    cle: "1-art114-avec-date",
    titre: "Hors contrôle de la disponibilité active — fixation du montant (art. 114)",
    payload: {
      pr_nom_et_nom: { first: "Amélie", last: "Vandenbroucke" },
      rue: "Rue de la Station",
      numero: "14 boîte 3",
      codePostal: "5000",
      commune: "Namur",
      niss: "85.07.14-231.19",
      dateDA: "2026-09-01",
      cadreDemande: "art114",
    },
  },
  {
    // Deuxième cadre, première case — celle qui, avant ce lot, cochait AUSSI
    // la case « art. 114 » du cadre précédent (widget partagé).
    cle: "2-jeune-travailleur",
    titre: "Contrôle de la disponibilité active — jeune travailleur en stage d'insertion",
    payload: {
      pr_nom_et_nom: { first: "Mohammed", last: "El Ouazzani" },
      rue: "Chaussée de Marche",
      numero: "1042",
      codePostal: "5100",
      commune: "Jambes",
      niss: "02.11.30-145.73",
      t_l_phone: "0470 12 34 56",
      email: "m.elouazzani@exemple.be",
      cadreDemande: "jeune-travailleur",
    },
  },
  {
    // Deuxième cadre, seconde case. Aucune date : le papier n'en imprime pas
    // dans ce cadre, et `visibleIf` ne la demande donc pas.
    cle: "3-chomeur-indemnise",
    titre: "Contrôle de la disponibilité active — chômeur complet indemnisé",
    payload: {
      pr_nom_et_nom: { first: "Sofie", last: "De Clercq" },
      rue: "Grote Markt",
      numero: "7",
      codePostal: "9000",
      commune: "Gent",
      niss: "78.11.02-088.15",
      t_l_phone: "09 223 44 55",
      email: "sofie.declercq@exemple.be",
      cadreDemande: "chomeur-indemnise",
    },
  },
  {
    // Textes longs : nom composé, rue à rallonge, e-mail interminable — de quoi
    // vérifier la réduction de police dans des cases étroites.
    cle: "4-textes-longs",
    titre: "Textes longs — réduction de police dans les cases",
    payload: {
      pr_nom_et_nom: { first: "Jean-Baptiste", last: "Vanderstichelen-Delacroix" },
      rue: "Chaussée de Bruxelles-Charleroi prolongée",
      numero: "1042, bâtiment C, deuxième étage",
      codePostal: "1420",
      commune: "Braine-l'Alleud",
      niss: "69.12.31-999.89",
      t_l_phone: "+32 2 123 45 67",
      email: "jean-baptiste.vanderstichelen-delacroix@administration-communale.be",
      dateDA: "2026-12-31",
      cadreDemande: "art114",
    },
  },
  {
    // Repli de police (grec) — même sonde que sur le C1C.
    cle: "5-caracteres-non-latins",
    titre: "Nom non latin — repli de police",
    payload: {
      pr_nom_et_nom: { first: "Οδυσσέας", last: "Παπαδόπουλος" },
      rue: "Rue des Palais",
      numero: "44",
      codePostal: "1030",
      commune: "Schaerbeek",
      niss: "88.02.29-123.93",
      dateDA: "2026-01-01",
      cadreDemande: "art114",
    },
  },
];

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  mkdirSync(join(SORTIE, "_controle"), { recursive: true });
  const source = readFileSync(SOURCE);
  const parsed = await parsePdf(source);
  const fields = applyC47Improvements([]) as PdfFormField[];

  const rapport: Record<string, unknown>[] = [];

  for (const s of SCENARIOS) {
    // Mêmes gestes que la route de génération : auto-champs serveur (date de
    // signature + sentinelle de signature) APRÈS coup, puis règles serveur sur
    // le payload VISIBLE seulement.
    const complet = applyServerAutoFields(fields, s.payload, new Date().toISOString().slice(0, 10));
    const extraStamps = resolveStamps(visiblePayload(fields, complet), getRulesForSlug("c47"));

    for (const flatten of [true, false]) {
      const { bytes, diagnostics } = await fillForm(source, fields, complet, {
        flatten,
        technicalSchema: parsed.fields,
        extraStamps,
        // Même calage des peignes qu'en production : sans lui, les widgets
        // écrits par une RÈGLE serveur sortiraient d'un bloc sur leur guide,
        // et la recette montrerait autre chose que le PDF réel.
        combWidgets: getCombWidgetsForSlug("c47"),
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
