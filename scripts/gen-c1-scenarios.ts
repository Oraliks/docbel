/// Génère un jeu de C1 remplis couvrant toutes les branches, et sert de support
/// à la relecture case par case du PDF (aucun test ne certifie qu'une
/// déclaration officielle est correcte).
///
/// Le C1 était le DERNIER document semé sans script de recette — le plus gros
/// du parc (179 widgets, 92 champs), et donc celui où une case muette avait le
/// plus de chances de passer inaperçue. Décalque de
/// `gen-c1-partenaire-scenarios.ts`.
///
/// Usage :
///   pnpm tsx scripts/gen-c1-scenarios.ts
///   python scripts/verif-couverture-widgets.py "$TEMP/c1-scenarios" private/pdfs/C1_FR.pdf
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fillForm } from "@/lib/pdf-forms/filler";
import { applyC1Improvements } from "@/lib/pdf-forms/seed/c1-fields-improvements";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { getCombWidgetsForSlug } from "@/lib/pdf-forms/bindings/comb-widgets";
import { applyServerAutoFields } from "@/lib/pdf-forms/auto-fields";
import { visiblePayload } from "@/lib/pdf-forms/validation";
import type { FormPayload, PdfFormField } from "@/lib/pdf-forms/types";

const SORTIE = process.argv[2] ?? join(process.env.TEMP ?? ".", "c1-scenarios");
const SOURCE = "private/pdfs/C1_FR.pdf";
const SLUG = "c1-changement-situation";

interface Scenario {
  cle: string;
  titre: string;
  payload: FormPayload;
}

/// Les seize questions « activités et revenus » de la rubrique IV, dans
/// l'ordre imprimé. Les répondre une par une à chaque scénario ferait seize
/// lignes recopiées quatre fois.
const QUESTIONS_ACTIVITES = [
  "etudesPleinExercice",
  "apprentissageAlternance",
  "formationStageSyntra",
  "mandatArtistique",
  "mandatPolitique",
  "chapitreXIIArts",
  "tremplinIndependants",
  "activiteAccessoireOuAide",
  "administrateurSociete",
  "independantAccessoireOuPrincipal",
  "pensionCategorieParticuliere",
  "pensionRetraiteSurvie",
  "indemniteMaladieInvalidite",
  "indemniteAccidentTravail",
  "avantageFinancierFormation",
] as const;

/// Les six « et l'aviez-vous déjà déclaré ? » qui n'apparaissent qu'après un
/// « oui ». Elles ne peuvent donc PAS figurer dans un scénario « tout non ».
const DEJA_DECLARE = [
  "mandatArtistiqueDejaDeclare",
  "mandatPolitiqueDejaDeclare",
  "tremplinIndependantsDejaDeclare",
  "activiteAccessoireDejaDeclare",
  "administrateurSocieteDejaDeclare",
  "independantAccessoireDejaDeclare",
  "pensionRetraiteDejaDeclare",
] as const;

const toutesActivites = (reponse: "oui" | "non"): FormPayload =>
  Object.fromEntries(QUESTIONS_ACTIVITES.map((q) => [q, reponse]));

/// Le bloc de trois affirmations sur l'honneur, obligatoire sur chaque C1.
const AFFIRMATIONS: FormPayload = {
  affirmationSincerite: true,
  affirmationLectureNotice: true,
  affirmationModifications: true,
};

/// Le C1 de Docbel n'est PAS un C1 de première demande : le document semé
/// (`restrictMotifTo5Situations`) est la DÉCLARATION DE CHANGEMENT DE SITUATION,
/// où `motifIntroduction` vaut toujours « modification » (répondu
/// automatiquement, jamais montré) et où le citoyen coche une ou plusieurs des
/// cinq situations. Aucun scénario ne doit donc poser « première fois » ou
/// « après une interruption » : ces deux cases, la ligne « je demande des
/// allocations à partir du » et son widget `DateAllocation` restent VIDES par
/// construction sur ce parcours (cf. `overlay.ts`, « ne s'applique PAS à un
/// dossier de changement de situation »).
const MOTIF_MODIFICATION: FormPayload = { motifIntroduction: "modification" };

const SCENARIOS: Scenario[] = [
  {
    // Le cas le plus fréquent : un déménagement, rien d'autre. Personne isolée,
    // aucune activité ni revenu à déclarer, paiement par virement sur son
    // propre compte. Couvre les seize cases « non » de la rubrique IV.
    cle: "1-changement-adresse",
    titre: "Changement d'adresse seul, isolée — les seize « non »",
    payload: {
      ...toutesActivites("non"),
      ...AFFIRMATIONS,
      ...MOTIF_MODIFICATION,
      nom: "Vandenbroucke",
      pr_nom: "Amélie",
      niss: "85.07.14-231.05",
      date_de_naissance: "1985-07-14",
      nationalit_3: "Belge",
      code_postal: "4000",
      commune: "Liège",
      adresse_rue: "Rue Saint-Gilles",
      num_ro: "142",
      pays: "Belgique",
      dateDemande: "2026-08-03",
      modificationAdresse: true,
      dateModificationEffective: "2026-07-15",
      statutFamilial: "isole",
      pensionAlimentaire: "non",
      modePaiement: "virement",
      titulaireCompte: "mon-nom",
      iban: "BE68 5390 0754 7034",
      nationaliteHorsEEE: "non",
      congeSansSolde: "non",
      incapacite33: "non",
    },
  },
  {
    // Ménage commun : la grille des cinq cohabitants, un FAC qui déclenche le
    // C1-PARTENAIRE, une pension alimentaire avec jugement en main, et le
    // motif « modification » avec ses quatre cases de changement.
    cle: "2-menage-commun-cohabitants",
    titre: "Ménage commun — grille des cohabitants, FAC, pension alimentaire",
    payload: {
      ...toutesActivites("non"),
      ...AFFIRMATIONS,
      ...MOTIF_MODIFICATION,
      nom: "El Ouazzani",
      pr_nom: "Mohammed",
      niss: "78.11.02-088.44",
      date_de_naissance: "1978-11-02",
      nationalit_3: "Belge",
      code_postal: "1070",
      commune: "Anderlecht",
      adresse_rue: "Avenue Clemenceau",
      num_ro: "87",
      num_ro_de_bo_te: "3B",
      pays: "Belgique",
      dateDemande: "2026-08-03",
      modificationAdresse: true,
      modificationSituationFamiliale: true,
      dateModificationEffective: "2026-07-01",
      statutFamilial: "cohabite",
      cohabiteType: "menage-commun",
      habiteEnColocation: "non",
      situationCohabitationAmbigue: "non",
      situationCohabitationAmbigueDejaDeclare: "non",
      pensionAlimentaire: "oui",
      statutJugementPensionAlimentaire: "en-main",
      separeDeFaitDelegationRevenu: true,
      remarqueSituationFamiliale:
        "Ma fille aînée est domiciliée chez son grand-père depuis juin mais dort ici la moitié de la semaine.",
      cohabitants: [
        {
          prenom: "Nadia",
          nom: "El Ouazzani-Berger",
          lien: "FAC",
          dateNaissance: "1982-06-15",
          allocationsFamiliales: "non",
          typeRevenuPro: "salarie-employe",
          montantRevenuPro: "1850,00",
          c1PartenaireStatus: "premiere-fois",
        },
        {
          prenom: "Yasmine",
          nom: "El Ouazzani",
          lien: "enfant",
          dateNaissance: "2011-03-08",
          allocationsFamiliales: "oui",
          typeRevenuPro: "aucun",
          revenuRemplacement: "aucun",
        },
        {
          prenom: "Rachid",
          nom: "El Ouazzani",
          lien: "frere",
          dateNaissance: "1975-01-30",
          allocationsFamiliales: "non",
          typeRevenuPro: "aucun",
          revenuRemplacement: "mutuelle",
          montantRevenuRemplacement: "1243,18",
          remarque: "Hébergé le temps de sa convalescence.",
        },
      ],
      modePaiement: "virement",
      titulaireCompte: "mon-nom",
      iban: "BE62 5100 0754 7061",
      nationaliteHorsEEE: "non",
      congeSansSolde: "non",
      incapacite33: "non",
      annexeC1Regis: true,
    },
  },
  {
    // Toutes les cases « oui » de la rubrique IV, avec leurs sept questions de
    // suite, et les cinq annexes cochées. Couvre les widgets `oui_N`, les
    // `Oui_PremièreFois…` et le bloc des pièces jointes.
    cle: "3-toutes-declarations-oui",
    titre: "Compte au nom d'un tiers, les seize « oui » et les cinq annexes",
    payload: {
      ...toutesActivites("oui"),
      ...Object.fromEntries(DEJA_DECLARE.map((q, i) => [q, i % 2 === 0 ? "oui" : "non"])),
      ...AFFIRMATIONS,
      ...MOTIF_MODIFICATION,
      nom: "Dupont-Lefèvre",
      pr_nom: "Jean-Baptiste",
      niss: "69.12.31-999.09",
      date_de_naissance: "1969-12-31",
      nationalit_3: "Belge",
      code_postal: "5000",
      commune: "Namur",
      adresse_rue: "Rue de Fer",
      num_ro: "5",
      pays: "Belgique",
      dateDemande: "2026-08-03",
      modificationCompte: true,
      dateModificationEffective: "2026-08-01",
      statutFamilial: "isole",
      pensionAlimentaire: "oui",
      statutJugementPensionAlimentaire: "deja-introduit",
      etudesPleinExerciceDate: "2026-06-30",
      apprentissageAlternanceDate: "2026-05-31",
      formationStageSyntraDate: "2026-04-15",
      modePaiement: "virement",
      // Compte au nom d'un tiers : la seule combinaison qui remplit la ligne
      // « non, au nom de … » (widget `NomTitulaireSipasOk`). Un chèque
      // circulaire masque tout le bloc virement — il faut donc bien un
      // virement ici pour voir cette ligne.
      titulaireCompte: "autre-nom",
      titulaireCompteNom: "Dupont-Lefèvre Marceline (mon épouse)",
      iban: "BE43 0689 3000 0000",
      nationaliteHorsEEE: "non",
      congeSansSolde: "non",
      incapacite33: "oui",
      incapacite33DejaDeclare: "non",
      annexeHandicap: true,
      annexeExtraitPension: true,
      annexeC1Regis: true,
      annexePermisSejour: true,
      annexeAutre: true,
      annexeAutreDescription: "Attestation de fin de contrat d'apprentissage (IFAPME)",
      remarqueLibreOnem:
        "Mon mandat politique est exercé à titre gratuit ; l'attestation communale suit par courrier.",
    },
  },
  {
    // Le 5ᵉ chip (transfert vers un autre organisme de paiement) + le permis de
    // séjour, avec un paiement par chèque circulaire. Plus le bloc final
    // « nationalité hors EEE » avec accès limité au marché du travail et un
    // congé sans solde daté.
    //
    // ⚠ Les trois champs « cotisation syndicale » sont `readOnly` et laissés
    // vides en production (décision Oraliks 2026-07-26 : c'est l'organisme de
    // paiement qui les renseigne). Ils sont remplis ICI, et seulement ici, pour
    // rendre visible une limite connue du formulaire : les deux lignes
    // « à partir du mois de chômage de » partagent UN champ AcroForm à deux
    // widgets, donc le mois s'imprime toujours sur la PREMIÈRE ligne, même
    // quand c'est la seconde qui est cochée.
    cle: "4-transfert-organisme-cheque",
    titre: "Transfert d'organisme, permis de séjour, chèque circulaire, hors EEE",
    payload: {
      ...toutesActivites("non"),
      ...AFFIRMATIONS,
      ...MOTIF_MODIFICATION,
      nom: "Osei-Mensah",
      pr_nom: "Kwabena",
      niss: "91.04.09-455.72",
      date_de_naissance: "1991-04-09",
      nationalit_3: "Ghanéenne",
      code_postal: "2060",
      commune: "Antwerpen",
      adresse_rue: "Handelstraat",
      num_ro: "204",
      pays: "Belgique",
      dateDemande: "2026-08-03",
      dateChangementOrganisme: "2026-09-01",
      transfereOrganismePaiement: true,
      modificationPermisSejour: true,
      dateModificationEffective: "2026-08-20",
      statutFamilial: "isole",
      pensionAlimentaire: "non",
      modePaiement: "cheque",
      modePaiementChequeWarning: true,
      retireCotisationSyndicale: true,
      cotisationSyndicaleMoisAnnee: "09/2026",
      nationaliteHorsEEE: "oui",
      statutRefugie: "non",
      apatrideReconnu: "non",
      accesMarcheTravail: "limite",
      raisonLimitationAccesMarche:
        "Permis de travail B lié à un employeur unique, valable jusqu'au 31/12/2026.",
      annexePermisSejour: true,
      congeSansSolde: "oui",
      congeSansSoldeDate: "2026-08-10",
      congeSansSoldeDateFin: "2026-08-24",
      incapacite33: "non",
    },
  },
  {
    // Colocation : la grille se réduit à prénom + nom (Annexe REGIS prend le
    // relais). Noms non latins et textes longs — repli de police et réduction
    // automatique. C'est aussi le scénario où le statut de réfugié est « oui »,
    // qui court-circuite la question de l'accès au marché du travail.
    cle: "5-colocation-textes-longs",
    titre: "Colocation, noms non latins, textes longs, statut de réfugié",
    payload: {
      ...toutesActivites("non"),
      ...AFFIRMATIONS,
      ...MOTIF_MODIFICATION,
      nom: "Παπαδόπουλος",
      pr_nom: "Οδυσσέας",
      niss: "88.02.29-123.19",
      date_de_naissance: "1988-02-29",
      nationalit_3: "Grecque",
      code_postal: "1030",
      commune: "Schaerbeek",
      adresse_rue: "Avenue Louis Bertrand",
      num_ro: "116",
      num_ro_de_bo_te: "12",
      pays: "Belgique",
      dateDemande: "2026-08-03",
      modificationSituationFamiliale: true,
      dateModificationEffective: "2026-08-01",
      // Colocation : à l'écran, choisir « ce n'est pas un ménage commun »
      // REBASCULE le citoyen sur « isolé » et coche `habiteEnColocation`
      // (`onSelectSet` de `cohabiteType`) — une colocation n'est pas une
      // cohabitation au sens du chômage. Le payload d'une vraie soumission
      // ressemble donc à ceci, et surtout PAS à `statutFamilial: "cohabite"`.
      // La grille des cohabitants reste vide : les colocataires se déclarent
      // sur l'Annexe REGIS, ajoutée au parcours par le déclencheur.
      statutFamilial: "isole",
      cohabiteType: "colocation",
      habiteEnColocation: "oui",
      pensionAlimentaire: "non",
      modePaiement: "virement",
      titulaireCompte: "mon-nom",
      // IBAN ÉTRANGER : seul cas où le BIC est demandé et imprimé (les deux
      // lignes « Compte SEPA étranger »). Un IBAN belge part dans le peigne
      // « B E · __ __ · … » et laisse ces deux lignes vides.
      iban: "FR76 3000 6000 0112 3456 7890 189",
      bic: "AGRIFRPP",
      nationaliteHorsEEE: "oui",
      statutRefugie: "oui",
      congeSansSolde: "non",
      incapacite33: "non",
      remarqueLibreOnem:
        "Je partage un appartement de trois chambres avec deux colocataires sans lien de parenté : chacun paie sa part du loyer directement au propriétaire, et nous ne partageons ni les courses ni les charges du ménage.",
      annexeAutre: true,
      annexeAutreDescription:
        "Copie du bail de colocation signé le 1er février 2026 et attestation de reconnaissance du statut de réfugié (CGRA)",
    },
  },
];

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  mkdirSync(join(SORTIE, "_controle"), { recursive: true });
  const source = readFileSync(SOURCE);
  const parsed = await parsePdf(source);
  const fields = applyC1Improvements([], {
    defaultMotif: "modification",
    restrictMotifTo5Situations: true,
    technicalSchema: parsed.fields,
  }) as PdfFormField[];

  const rapport: Record<string, unknown>[] = [];

  for (const s of SCENARIOS) {
    const complet = applyServerAutoFields(fields, s.payload, new Date().toISOString().slice(0, 10));
    const extraStamps = resolveStamps(visiblePayload(fields, complet), getRulesForSlug(SLUG));

    for (const flatten of [true, false]) {
      const { bytes, diagnostics } = await fillForm(source, fields, complet, {
        flatten,
        technicalSchema: parsed.fields,
        extraStamps,
        // Même calage des peignes qu'en production : sans lui, les widgets
        // écrits par une RÈGLE serveur sortiraient d'un bloc sur leur guide.
        combWidgets: getCombWidgetsForSlug(SLUG),
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
