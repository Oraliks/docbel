/// Génère un jeu de C1C remplis couvrant TOUTES les branches du formulaire, et
/// vérifie que chaque widget de l'AcroForm a bien reçu quelque chose au moins
/// une fois. Script d'atelier : à supprimer après relecture.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fillForm } from "@/lib/pdf-forms/filler";
import { applyC1CImprovements } from "@/lib/pdf-forms/seed/c1c-fields";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { applyServerAutoFields } from "@/lib/pdf-forms/auto-fields";
import { visiblePayload } from "@/lib/pdf-forms/validation";
import type { FormPayload, PdfFormField } from "@/lib/pdf-forms/types";

const SORTIE = process.argv[2] ?? join(process.env.TEMP ?? ".", "c1c-scenarios");
const SOURCE = "private/pdfs/C1C_FR.pdf";

interface Scenario {
  cle: string;
  titre: string;
  payload: FormPayload;
}

const SCENARIOS: Scenario[] = [
  {
    cle: "1-personne-physique-minimal",
    titre: "Personne physique — le parcours le plus court",
    payload: {
      pr_nom_et_nom: { first: "Amélie", last: "Vandenbroucke" },
      niss: "85.07.14-231.05",
      dateDebutActivite: "2026-09-01",
      descriptionActivite1:
        "Cours particuliers de mathématiques et de physique à domicile, pour des élèves du secondaire.",
      possedeSiteInternet: "non",
      lieuExerciceActivite: "domicile",
      formeExerciceActivite: "personne-physique",
      numeroBcePersonnePhysique: "0776352433",
      activiteExerceeParTiers: "non",
      competencesProfessionnellesSpecifiques: "oui",
      revenuBrutAnnuel: "4800",
      revenuNetImposableAnnuel: "3600",
      activiteIndependanteAnterieure: "non",
      affirmationSincereEtComplete: true,
    },
  },
  {
    cle: "2-societe-tout-coche",
    titre: "Société — toutes les branches « oui », tous les champs servis",
    payload: {
      pr_nom_et_nom: { first: "Mohammed", last: "El Ouazzani" },
      niss: "78.11.02-145.37",
      dateDebutActivite: "2026-08-15",
      descriptionActivite1:
        "Réparation de vélos électriques à domicile et vente en ligne de pièces détachées d'occasion, principalement des batteries reconditionnées et des moteurs de roue avant.",
      possedeSiteInternet: "oui",
      siteInternetUrl: "https://www.velo-namur.be/boutique",
      lieuExerciceActivite: "autre",
      adresseActiviteLigne1: "Rue de la Station 14 boîte 3, 5000 Namur",
      formeExerciceActivite: "societe",
      nomEntreprise: "Vélo Namur SRL",
      numeroBceEntreprise: "0403199702",
      formeExerciceAutre: "L'activité ne débutera qu'après réception du numéro de TVA.",
      activiteExerceeParTiers: "oui",
      tiersPrecision: "Mon conjoint tient la comptabilité et répond au téléphone.",
      competencesProfessionnellesSpecifiques: "non",
      revenuBrutAnnuel: "18500.50",
      revenuNetImposableAnnuel: "12250",
      activiteIndependanteAnterieure: "oui",
      descriptionActivitesAnterieures1:
        "Gérant d'un magasin de cycles à Charleroi du 01/03/2021 au 30/06/2024, à titre principal.",
      annexes: "Copie de la note de calcul des contributions directes, statuts de la SRL",
      affirmationSincereEtComplete: true,
    },
  },
  {
    cle: "3-personne-physique-sans-bce",
    titre: "Personne physique sans BCE — le champ « Autre » sert d'explication",
    payload: {
      pr_nom_et_nom: { first: "Sofie", last: "De Clercq" },
      niss: "94.03.28-088.44",
      dateDebutActivite: "2026-10-01",
      descriptionActivite1: "Création de bijoux artisanaux vendus sur les marchés locaux.",
      possedeSiteInternet: "oui",
      siteInternetUrl: "sofie-bijoux.be",
      lieuExerciceActivite: "domicile",
      formeExerciceActivite: "personne-physique",
      formeExerciceAutre: "Je n'ai pas encore débuté l'activité : demande BCE en cours.",
      activiteExerceeParTiers: "non",
      competencesProfessionnellesSpecifiques: "oui",
      revenuBrutAnnuel: "2400",
      revenuNetImposableAnnuel: "1800",
      activiteIndependanteAnterieure: "non",
      annexes: "Attestation du guichet d'entreprises",
      affirmationSincereEtComplete: true,
    },
  },
  {
    cle: "4-textes-longs",
    titre: "Textes longs — repli sur toutes les lignes pointillées",
    payload: {
      pr_nom_et_nom: { first: "Jean-Baptiste", last: "Vanderstichelen-Delacroix" },
      niss: "69.12.31-999.09",
      dateDebutActivite: "2026-12-31",
      descriptionActivite1:
        "Je preste des services de conseil en transition énergétique auprès de petites communes rurales : audit des bâtiments publics, montage de dossiers de subsides régionaux, accompagnement des marchés publics de rénovation, et formation du personnel technique communal aux nouveaux équipements de chauffage.",
      possedeSiteInternet: "oui",
      siteInternetUrl: "http://www.conseil-energie-wallonie.be",
      lieuExerciceActivite: "autre",
      adresseActiviteLigne1:
        "Chaussée de Marche 1042, bâtiment C, deuxième étage, bureau 214, 5100 Jambes (Namur)",
      formeExerciceActivite: "societe",
      nomEntreprise: "Conseil Énergie Wallonie SCRL",
      numeroBceEntreprise: "0899123456",
      formeExerciceAutre:
        "Mandat d'administrateur non rémunéré jusqu'au premier exercice comptable clôturé.",
      activiteExerceeParTiers: "oui",
      tiersPrecision:
        "Un sous-traitant indépendant réalise les relevés thermographiques sur site, environ deux jours par mois.",
      competencesProfessionnellesSpecifiques: "non",
      revenuBrutAnnuel: "45000",
      revenuNetImposableAnnuel: "28750.75",
      activiteIndependanteAnterieure: "oui",
      descriptionActivitesAnterieures1:
        "Bureau d'études indépendant à titre principal du 01/09/2019 au 31/08/2023, spécialisé en performance énergétique des bâtiments tertiaires, cessé pour raisons de santé.",
      // Assez long pour atteindre la TROISIÈME ligne d'annexes imprimée : sans
      // ça le widget `Je joins en annexes 2` ne reçoit jamais rien, et le jeu
      // de scénarios laisse une case du PDF non vérifiée.
      annexes:
        "Note de calcul des contributions directes de l'exercice 2025, statuts coordonnés de la société, attestation d'affiliation à la caisse d'assurances sociales, extrait BCE, copie du bail du bureau de Jambes",
      affirmationSincereEtComplete: true,
    },
  },
  {
    cle: "5-caracteres-non-latins",
    titre: "Nom non latin et accents — repli de police",
    payload: {
      pr_nom_et_nom: { first: "Οδυσσέας", last: "Παπαδόπουλος" },
      niss: "88.02.29-123.19",
      dateDebutActivite: "2026-11-03",
      descriptionActivite1: "Traduction et interprétariat grec — français pour des études notariales.",
      possedeSiteInternet: "non",
      lieuExerciceActivite: "domicile",
      formeExerciceActivite: "personne-physique",
      numeroBcePersonnePhysique: "0123456749",
      activiteExerceeParTiers: "non",
      competencesProfessionnellesSpecifiques: "oui",
      revenuBrutAnnuel: "9200",
      revenuNetImposableAnnuel: "7100",
      activiteIndependanteAnterieure: "non",
      annexes: "Διαβατήριο (copie du passeport)",
      affirmationSincereEtComplete: true,
    },
  },
];

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  const source = readFileSync(SOURCE);
  const parsed = await parsePdf(source);
  const fields = applyC1CImprovements([]) as PdfFormField[];

  const rapport: Record<string, unknown>[] = [];

  for (const s of SCENARIOS) {
    // Mêmes gestes que la route de génération : auto-champs serveur (date de
    // signature + sentinelle de signature) APRÈS coup, puis règles serveur sur
    // le payload VISIBLE seulement.
    const complet = applyServerAutoFields(fields, s.payload, new Date().toISOString().slice(0, 10));
    const extraStamps = resolveStamps(visiblePayload(fields, complet), getRulesForSlug("c1c"));

    for (const flatten of [true, false]) {
      const { bytes, diagnostics } = await fillForm(source, fields, complet, {
        flatten,
        technicalSchema: parsed.fields,
        extraStamps,
      });
      const nom = flatten ? `${s.cle}.pdf` : `_controle/${s.cle}.pdf`;
      mkdirSync(join(SORTIE, "_controle"), { recursive: true });
      writeFileSync(join(SORTIE, nom), bytes);
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
