/// Génère un jeu de C1-ANNEXE REGIS remplis couvrant toutes les branches, et
/// sert de support à la relecture case par case du PDF (aucun test ne certifie
/// qu'une déclaration officielle est correcte).
///
/// Décalque de `gen-c1c-scenarios.ts` / `gen-c46-scenarios.ts`.
///
/// Usage :
///   pnpm tsx scripts/gen-c1-regis-scenarios.ts
///   python scripts/verif-couverture-widgets.py "$TEMP/c1-regis-scenarios" private/pdfs/Annexe_Regis_FR.pdf
///
/// Couverture attendue : 40 des 42 widgets. Les deux manquants sont les cases
/// administratives de la page 2 (« La rubrique I ne peut pas être complétée… »),
/// `hidden` dans le seed parce qu'elles sont cochées par le bureau du chômage
/// et non par le citoyen — aucun scénario ne peut donc les couvrir, et c'est
/// voulu.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fillForm } from "@/lib/pdf-forms/filler";
import { applyC1RegisImprovements } from "@/lib/pdf-forms/seed/c1-regis-fields";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { getCombWidgetsForSlug } from "@/lib/pdf-forms/bindings/comb-widgets";
import { applyServerAutoFields } from "@/lib/pdf-forms/auto-fields";
import { visiblePayload } from "@/lib/pdf-forms/validation";
import type { FormPayload, PdfFormField } from "@/lib/pdf-forms/types";

const SORTIE = process.argv[2] ?? join(process.env.TEMP ?? ".", "c1-regis-scenarios");
const SOURCE = "private/pdfs/Annexe_Regis_FR.pdf";

interface Scenario {
  cle: string;
  titre: string;
  payload: FormPayload;
}

/// En-tête commun. `dateDA` n'y figure PAS volontairement : c'est un champ AUTO
/// (`prefillFrom: "system.today"`), et `applyServerAutoFields` y écrase toute
/// valeur fournie. L'y mettre donnerait à un relecteur l'illusion de contrôler
/// une date métier alors qu'il regarderait l'horodatage du jour de génération.
///
/// Le NISS, lui, est indispensable : sa case est le SECOND widget du champ
/// « NOM » et s'écrit positionnellement (cf. le seed). Sans valeur ici, la
/// recette ne verrait pas si le peigne tombe juste.
function entete(last: string, first: string, niss: string): FormPayload {
  return { nom: last, prenom: first, niss };
}

const SCENARIOS: Scenario[] = [
  {
    // Le cas le plus fréquent : le citoyen dépose l'annexe parce qu'une seule
    // ligne diverge. Les six autres restent à « non » — ce qui couvre les six
    // cases `non` et vérifie que rien ne s'imprime sur leurs lignes.
    cle: "1-nationalite-seule",
    titre: "Une seule différence : la nationalité (codes N)",
    payload: {
      ...entete("Vandenbroucke", "Amélie", "85.07.14-231.19"),
      nationaliteDifference: "oui",
      nationaliteC1: "Belge",
      nationaliteRegistre: "Française",
      nationaliteExplication: "N2",
      adresseDifference: "non",
      personne1Difference: "non",
      personne2Difference: "non",
      personne3Difference: "non",
      personne4Difference: "non",
      personne5Difference: "non",
      nombreAnnexesJointes: 1,
    },
  },
  {
    // Différence d'adresse SEULE — la ligne qui déclenche le plus de rejets à
    // l'ONEM (le registre national suit un déménagement avec du retard).
    cle: "2-adresse-seule",
    titre: "Une seule différence : l'adresse (codes A)",
    payload: {
      ...entete("El Ouazzani", "Mohammed", "78.11.02-088.15"),
      nationaliteDifference: "non",
      adresseDifference: "oui",
      adresseC1: "Rue de la Loi 16, 1000 Bruxelles",
      adresseRegistre: "Chaussée de Charleroi 112, 1060 Saint-Gilles",
      adresseExplication: "A1",
      personne1Difference: "non",
      personne2Difference: "non",
      personne3Difference: "non",
      personne4Difference: "non",
      personne5Difference: "non",
      nombreAnnexesJointes: 2,
    },
  },
  {
    // Colocation : le cas du code FN4, celui que l'aide du formulaire détaille
    // (aucun lien de parenté, même adresse, vie financière séparée).
    cle: "3-colocataires-fn4",
    titre: "Deux colocataires à déclarer en FN4",
    payload: {
      ...entete("De Clercq", "Sofie", "94.03.28-088.97"),
      nationaliteDifference: "non",
      adresseDifference: "non",
      personne1Difference: "oui",
      personne1C1: "Peeters Lieven",
      personne1Registre: "PEETERS Lieven Marc",
      personne1Explication: "FN4",
      personne2Difference: "oui",
      personne2C1: "Nkosi Grace",
      personne2Registre: "NKOSI Grace Ada",
      personne2Explication: "FN4",
      personne3Difference: "non",
      personne4Difference: "non",
      personne5Difference: "non",
      nombreAnnexesJointes: 0,
    },
  },
  {
    // TOUTES les lignes en différence : c'est ce scénario qui couvre les sept
    // cases `oui`, les quatorze colonnes du tableau et les sept explications.
    // La 5e personne est le cas de nommage irrégulier du PDF (« PERSONNE »
    // sans numéro) : si elle s'imprimait sur la mauvaise ligne, ce serait ici.
    //
    // ⚠ Ce scénario vise la COUVERTURE DES CASES, pas la justesse des codes.
    // Les trois enfants portent le même écart (patronyme du parent sur le C1,
    // nom d'état civil aux registres) : ils reçoivent donc le MÊME code. Leur
    // donner FY1, FY2 puis FY3 enseignerait au relecteur une correspondance
    // situation → code que rien dans le dépôt n'atteste — la légende page 2 du
    // formulaire n'est transcrite nulle part (cf. NEXT_ACTIONS).
    cle: "4-toutes-les-lignes",
    titre: "Les sept lignes en différence — couverture maximale",
    payload: {
      ...entete("Vanderstichelen-Delacroix", "Jean-Baptiste", "69.12.31-999.89"),
      nationaliteDifference: "oui",
      nationaliteC1: "Belge",
      nationaliteRegistre: "Italienne",
      nationaliteExplication: "N1",
      adresseDifference: "oui",
      adresseC1: "Avenue Louise 250, 1050 Ixelles",
      adresseRegistre: "Avenue Louise 250 bte 4, 1050 Ixelles",
      adresseExplication: "A2",
      personne1Difference: "oui",
      personne1C1: "Delacroix Marie",
      personne1Registre: "VANDERSTICHELEN Marie",
      personne1Explication: "FY1",
      personne2Difference: "oui",
      personne2C1: "Delacroix Louis",
      personne2Registre: "VANDERSTICHELEN Louis",
      personne2Explication: "FY1",
      personne3Difference: "oui",
      personne3C1: "Delacroix Jeanne",
      personne3Registre: "VANDERSTICHELEN Jeanne",
      personne3Explication: "FY1",
      personne4Difference: "oui",
      personne4C1: "Kowalczyk Agnieszka",
      personne4Registre: "KOWALCZYK Agnieszka Maria",
      personne4Explication: "FN4",
      personne5Difference: "oui",
      personne5C1: "Diallo Ousmane",
      personne5Registre: "DIALLO Ousmane Bakary",
      personne5Explication: "FN4",
      nombreAnnexesJointes: 5,
    },
  },
];

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  mkdirSync(join(SORTIE, "_controle"), { recursive: true });
  const source = readFileSync(SOURCE);
  const parsed = await parsePdf(source);
  const fields = applyC1RegisImprovements([]) as PdfFormField[];

  const rapport: Record<string, unknown>[] = [];

  for (const s of SCENARIOS) {
    const complet = applyServerAutoFields(fields, s.payload, new Date().toISOString().slice(0, 10));
    const extraStamps = resolveStamps(
      visiblePayload(fields, complet),
      getRulesForSlug("c1-regis"),
    );

    for (const flatten of [true, false]) {
      const { bytes, diagnostics } = await fillForm(source, fields, complet, {
        flatten,
        technicalSchema: parsed.fields,
        extraStamps,
        // Même calage des peignes qu'en production : sans lui, les widgets
        // écrits par une RÈGLE serveur sortiraient d'un bloc sur leur guide,
        // et la recette montrerait autre chose que le PDF réel.
        combWidgets: getCombWidgetsForSlug("c1-regis"),
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
