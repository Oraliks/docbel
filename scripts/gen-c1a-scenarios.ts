/// Génère un jeu de C1A remplis couvrant toutes les branches de l'arbre de
/// renvois, et sert de support à la relecture case par case du PDF (aucun test
/// ne certifie qu'une déclaration officielle est correcte).
///
/// Décalque de `gen-c1c-scenarios.ts` / `gen-c46-scenarios.ts`. Le C1A était le
/// dernier compagnon sans script de recette — et c'est le plus gros du parc :
/// 132 widgets, 24 questions, un arbre de renvois à sept embranchements.
///
/// Usage :
///   pnpm tsx scripts/gen-c1a-scenarios.ts
///   python scripts/verif-couverture-widgets.py "$TEMP/c1a-scenarios" private/pdfs/C1A_FR.pdf
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fillForm } from "@/lib/pdf-forms/filler";
import { applyC1AImprovements } from "@/lib/pdf-forms/seed/c1a-fields";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { getCombWidgetsForSlug } from "@/lib/pdf-forms/bindings/comb-widgets";
import { applyServerAutoFields } from "@/lib/pdf-forms/auto-fields";
import { visiblePayload } from "@/lib/pdf-forms/validation";
import type { FormPayload, PdfFormField } from "@/lib/pdf-forms/types";

const SORTIE = process.argv[2] ?? join(process.env.TEMP ?? ".", "c1a-scenarios");
const SOURCE = "private/pdfs/C1A_FR.pdf";

interface Scenario {
  cle: string;
  titre: string;
  payload: FormPayload;
}

/// En-tête d'identité, commun aux quatre scénarios.
function entete(last: string, first: string, niss: string): FormPayload {
  return {
    nomEtPrenom: { first, last },
    niss,
    rue: "Rue de la Loi",
    numero: "16",
    codePostal: "1000",
    commune: "Bruxelles",
  };
}

/// Grille horaire d'une des deux rubriques (Q4 « quand aiderez-vous ? » et Q18
/// « quand exercerez-vous ? ») : mêmes sept jours, mêmes trois tranches, deux
/// jeux de widgets distincts sur le papier. On coche TOUT — c'est ce qui
/// prouve que les 30 cases d'une grille ne débordent pas sur l'autre.
function grilleComplete(prefixe: "q4" | "q18"): FormPayload {
  const semaine = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"] as const;
  const out: FormPayload = {};
  for (const jour of semaine) {
    // Identifiants du seed : `q4lundi`, `q4lundiAvant7h` — le jour reste en
    // minuscules, seule la tranche est capitalisée.
    out[`${prefixe}${jour}`] = true;
    out[`${prefixe}${jour}Avant7h`] = true;
    out[`${prefixe}${jour}Entre7h18h`] = true;
    out[`${prefixe}${jour}Apres18h`] = true;
  }
  // Samedi et dimanche n'ont PAS de tranches horaires sur le papier.
  out[`${prefixe}samedi`] = true;
  out[`${prefixe}dimanche`] = true;
  return out;
}

const SCENARIOS: Scenario[] = [
  {
    // Le chemin le plus court de l'arbre : « non » aux trois questions
    // d'aiguillage. Six étapes à l'écran, et la quasi-totalité du papier reste
    // vide — c'est ce qu'on vérifie ici : rien ne s'imprime hors des cases
    // « non ».
    cle: "1-parcours-court",
    titre: "Le chemin le plus court — non à tout",
    payload: {
      ...entete("Dupont", "Marie", "85.07.30-033.28"),
      aideIndependant: "non",
      mandatPolitiqueOuJuge: "non",
      autreActiviteAccessoire: "non",
      estChomeurTemporaire: "non",
      independantTitrePrincipal: "non",
      affirmationSincerite: true,
    },
  },
  {
    // Q1 → Q8 : aide à un indépendant, grille Q4 complète, montant MENSUEL,
    // puis Q9 → Q11 : mandat politique. Deux rubriques que le parcours peut
    // ouvrir ensemble.
    cle: "2-aide-independant-et-mandat",
    titre: "Aide à un indépendant (grille Q4 complète) + mandat politique",
    payload: {
      ...entete("El Ouazzani", "Mohammed", "78.11.02-088.44"),
      aideIndependant: "oui",
      independantNom: "Peeters Lieven",
      independantNumeroEntreprise: "0123456749",
      independantAdresseRueNumero: "Chaussée de Charleroi 112",
      independantAdresseCodePostalCommune: "1060 Saint-Gilles",
      // Quatre lignes = le maximum du papier (`maxRows`). Le PDF officiel porte
      // un cinquième widget, mais posé SUR la quatrième ligne : à cinq
      // activités, les deux dernières se superposaient (cf. le seed).
      natureActiviteIndependant: [
        { nature: "Boulangerie artisanale" },
        { nature: "Vente de produits du terroir sur les marchés" },
        { nature: "Livraison de pains à domicile le dimanche matin" },
        { nature: "Petite restauration à emporter le midi" },
      ],
      aideraPendantChomage: "oui",
      ...grilleComplete("q4"),
      // Branche « pendant les périodes suivantes » : quatre lignes imprimées.
      q4periode: "periodes",
      q4periodesTexte:
        "Du 1er septembre au 30 juin, hors vacances scolaires.\nPendant la quinzaine commerciale de printemps.\nLes trois week-ends du marché de Noël.\nEn juillet, uniquement les jours de marché du mercredi.",
      // Neuf lignes imprimées pour « Décrivez l'aide que vous apporterez » :
      // un texte court n'en exercerait qu'une, et le repli par `lineTargets`
      // resterait invérifié.
      descriptionAide1:
        "Je tiens la caisse le samedi matin et j'aide à la mise en rayon avant l'ouverture du magasin, " +
        "sans rémunération convenue ni contrat de travail. Je participe aussi au nettoyage du fournil " +
        "en fin de service, au réassort des vitrines réfrigérées et à la préparation des commandes " +
        "passées la veille par téléphone. Lors des marchés du mercredi, je charge et décharge la " +
        "camionnette, j'installe l'étal et je range le matériel en fin de journée. Je n'interviens " +
        "jamais dans la production ni dans la gestion administrative de l'entreprise, et je ne dispose " +
        "d'aucune procuration sur les comptes de mon partenaire indépendant.",
      montantAidePeriodicite: "mois",
      montantAide: 150,
      aidaitDejaIndependant: "oui",
      dateDebutAide: "2025-09-01",
      mandatPolitiqueOuJuge: "oui",
      mandatDescription: "Conseiller communal suppléant, commune de Saint-Gilles",
      revenuAnnuelMandat: 2400,
      autreActiviteAccessoire: "non",
      estChomeurTemporaire: "non",
      independantTitrePrincipal: "non",
      affirmationSincerite: true,
      nombreAnnexesJointes: 2,
    },
  },
  {
    // Q12 → Q21 en branche SALARIÉ, grille Q18 complète, revenus par mois ET
    // par heure (la même ligne imprimée), puis Q22 : chômeur temporaire, les
    // sept jours d'occupation. C'est le scénario le plus dense du jeu.
    cle: "3-activite-salariee-et-chomage-temporaire",
    titre: "Activité accessoire salariée (grille Q18 complète) + chômeur temporaire",
    payload: {
      ...entete("De Clercq", "Sofie", "94.03.28-088.44"),
      aideIndependant: "non",
      mandatPolitiqueOuJuge: "non",
      autreActiviteAccessoire: "oui",
      activiteCommeSalarie: "oui",
      employeurNom: "Librairie Quartier Latin SPRL",
      employeurAdresse: "Place Sainte-Croix 4, 1050 Ixelles",
      adresseActivite: "Place Sainte-Croix 4",
      adresseActiviteCodePostalCommune: "1050 Ixelles",
      formeActivite: "personne-physique",
      descriptionActivite1:
        "Vente en librairie deux soirées par semaine et le samedi toute la journée, avec tenue de la " +
        "caisse, conseil aux clients et réception des livraisons de l'éditeur.",
      exerceraPendantChomage: "oui",
      ...grilleComplete("q18"),
      // Branche « irrégulièrement » de Q18 : trois lignes imprimées, distinctes
      // de celles de Q4 — c'est précisément ce que ce scénario vérifie.
      q18periode: "irregulier",
      q18irregulierementTexte:
        "Selon le planning que la librairie m'envoie le jeudi pour la semaine suivante.\n" +
        "Ponctuellement lors des séances de dédicaces, annoncées quinze jours à l'avance.\n" +
        "Pendant la foire du livre, sur cinq jours consécutifs.",
      revenuNetSalarieParMois: 420.5,
      revenuNetSalarieParHeure: 13.25,
      exerceDejaActivite: "oui",
      dateDebutActivite: "2024-11-15",
      estChomeurTemporaire: "oui",
      joursOccupeLundi: true,
      joursOccupeMardi: true,
      joursOccupeMercredi: true,
      joursOccupeJeudi: true,
      joursOccupeVendredi: true,
      joursOccupeSamedi: true,
      joursOccupeDimanche: true,
      independantTitrePrincipal: "non",
      affirmationSincerite: true,
      nombreAnnexesJointes: 1,
    },
  },
  {
    // Les branches que les trois autres n'empruntent pas : activité exercée
    // comme MANDATAIRE avec numéro d'entreprise, période « irrégulièrement »,
    // montant d'aide ANNUEL, second montant de mandat, revenu d'indépendant
    // annuel, et « oui » à Q23.
    cle: "4-mandataire-et-revenus-annuels",
    titre: "Activité comme mandataire, période irrégulière, revenus annuels",
    payload: {
      ...entete("Vanderstichelen-Delacroix", "Jean-Baptiste", "69.12.31-999.09"),
      aideIndependant: "oui",
      independantNom: "Atelier Kowalczyk",
      independantAdresseRueNumero: "Avenue Louise 250 bte 4",
      independantAdresseCodePostalCommune: "1050 Ixelles",
      natureActiviteIndependant: [{ nature: "Restauration de mobilier ancien" }],
      aideraPendantChomage: "oui",
      // Branche « irrégulièrement » de Q4 : quatre lignes imprimées.
      q4periode: "irregulier",
      q4irregulierementTexte:
        "Quelques week-ends par an, lors des salons d'antiquités, sans calendrier fixé à l'avance.\n" +
        "Une à deux fois par trimestre, pour les livraisons de pièces volumineuses.\n" +
        "Pendant la brocante annuelle du quartier, sur deux jours.\n" +
        "Exceptionnellement en semaine, si une vente publique tombe un jour ouvrable.",
      descriptionAide1: "Transport et manutention des pièces vendues.",
      montantAidePeriodicite: "an",
      montantAideAnnuel: 1800,
      aidaitDejaIndependant: "non",
      mandatPolitiqueOuJuge: "oui",
      mandatDescription: "Juge social suppléant au tribunal du travail",
      revenuAnnuelMandat: 3600,
      revenuAnnuelMandat2: 3600,
      autreActiviteAccessoire: "oui",
      activiteCommeSalarie: "non",
      adresseActivite: "Avenue Louise 250 bte 4",
      adresseActiviteCodePostalCommune: "1050 Ixelles",
      formeActivite: "mandataire",
      disposeNumeroEntreprise: "oui",
      numeroEntreprise: "0123456749",
      descriptionActivite1: "Gérance d'une SRL familiale de restauration de mobilier.",
      exerceraPendantChomage: "oui",
      q18periode: "toute-annee",
      revenuNetIndependantParAn: 4200,
      exerceDejaActivite: "non",
      estChomeurTemporaire: "non",
      independantTitrePrincipal: "oui",
      affirmationSincerite: true,
      nombreAnnexesJointes: 3,
    },
  },
  {
    // Les trois « non » d'embranchement que les quatre autres n'empruntent
    // jamais : Q3 (« aiderez-vous pendant votre chômage ? »), la question du
    // numéro d'entreprise, et Q17 (« exercerez-vous pendant votre chômage ? »).
    // Sans ce scénario, trois cases du papier ne sont cochées par AUCUN jeu de
    // recette, et personne ne verrait qu'elles pointent au mauvais endroit.
    cle: "5-branches-non",
    titre: "Les trois « non » d'embranchement (Q3, n° d'entreprise, Q17)",
    payload: {
      ...entete("Kowalczyk", "Agnieszka", "94.03.28-088.44"),
      aideIndependant: "oui",
      independantNom: "Diallo Ousmane",
      independantAdresseRueNumero: "Rue Haute 88",
      independantAdresseCodePostalCommune: "1000 Bruxelles",
      natureActiviteIndependant: [{ nature: "Cordonnerie" }],
      // Q3 = non : l'aide a cessé, le parcours saute directement à Q9.
      aideraPendantChomage: "non",
      mandatPolitiqueOuJuge: "non",
      autreActiviteAccessoire: "oui",
      activiteCommeSalarie: "non",
      adresseActivite: "Rue Haute 88",
      adresseActiviteCodePostalCommune: "1000 Bruxelles",
      formeActivite: "mandataire",
      // Pas de numéro d'entreprise : la case « non » de cette question n'était
      // servie par aucun scénario.
      disposeNumeroEntreprise: "non",
      descriptionActivite1: "Gérance bénévole de l'ASBL de quartier, sans rémunération.",
      // Q17 = non : l'activité s'arrête pendant le chômage.
      exerceraPendantChomage: "non",
      estChomeurTemporaire: "non",
      independantTitrePrincipal: "non",
      affirmationSincerite: true,
      nombreAnnexesJointes: 0,
    },
  },
  {
    // Les deux options de période que les autres n'empruntent pas : « toute
    // l'année » sur Q4 et « pendant les périodes suivantes » sur Q18. Chacune
    // des deux grilles a trois options et deux jeux de lignes distincts ; sans
    // ce dernier passage, deux cases et trois lignes du papier resteraient
    // hors recette.
    cle: "6-periodes-restantes",
    titre: "Q4 toute l'année + Q18 pendant les périodes suivantes",
    payload: {
      ...entete("Nkosi", "Grace", "78.11.02-088.44"),
      aideIndependant: "oui",
      independantNom: "Peeters Lieven",
      independantAdresseRueNumero: "Rue du Marché 3",
      independantAdresseCodePostalCommune: "1300 Wavre",
      natureActiviteIndependant: [{ nature: "Fleuriste" }],
      aideraPendantChomage: "oui",
      q4periode: "toute-annee",
      descriptionAide1: "Livraison des compositions florales le vendredi et le samedi.",
      montantAidePeriodicite: "mois",
      montantAide: 80,
      aidaitDejaIndependant: "non",
      mandatPolitiqueOuJuge: "non",
      autreActiviteAccessoire: "oui",
      activiteCommeSalarie: "oui",
      employeurNom: "Fleurs & Cie SRL",
      employeurAdresse: "Rue du Marché 3, 1300 Wavre",
      adresseActivite: "Rue du Marché 3",
      adresseActiviteCodePostalCommune: "1300 Wavre",
      formeActivite: "personne-physique",
      descriptionActivite1: "Aide à la vente au comptoir pendant les fêtes.",
      exerceraPendantChomage: "oui",
      q18periode: "periodes",
      q18periodesTexte:
        "Du 1er au 24 décembre, pour les fêtes de fin d'année.\n" +
        "La semaine de la Saint-Valentin.\n" +
        "La quinzaine précédant la fête des mères.\n" +
        "La Toussaint, du 25 octobre au 2 novembre.",
      revenuNetSalarieParMois: 310,
      exerceDejaActivite: "non",
      estChomeurTemporaire: "non",
      independantTitrePrincipal: "non",
      affirmationSincerite: true,
      nombreAnnexesJointes: 1,
    },
  },
];

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  mkdirSync(join(SORTIE, "_controle"), { recursive: true });
  const source = readFileSync(SOURCE);
  const parsed = await parsePdf(source);
  const fields = applyC1AImprovements([]) as PdfFormField[];

  const rapport: Record<string, unknown>[] = [];

  for (const s of SCENARIOS) {
    const complet = applyServerAutoFields(fields, s.payload, new Date().toISOString().slice(0, 10));
    const extraStamps = resolveStamps(visiblePayload(fields, complet), getRulesForSlug("c1a"));

    for (const flatten of [true, false]) {
      const { bytes, diagnostics } = await fillForm(source, fields, complet, {
        flatten,
        technicalSchema: parsed.fields,
        extraStamps,
        // Même calage des peignes qu'en production : sans lui, les widgets
        // écrits par une RÈGLE serveur sortiraient d'un bloc sur leur guide,
        // et la recette montrerait autre chose que le PDF réel.
        combWidgets: getCombWidgetsForSlug("c1a"),
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
