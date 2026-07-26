// ACTIVITÉS & REVENUS — extrait de `c1-fields-improvements.ts` (2026-07-26).
//
// Les 15 déclarations d'activité et de revenus, et leurs suivis « déjà déclaré ».
//
// Découpage PUREMENT structurel : les définitions sont déplacées telles
// quelles. Le tableau complet est réassemblé dans `./index.ts`, dans l'ordre
// des modules — c'est cet ordre qui détermine l'ordre d'affichage.

import type { PdfFormField } from "../../types";
import {
  SECTION_ACTIVITES,
  SECTION_REVENUS,
  ouiNon,
  dejaDeclare,
  dateAPartirDu,
} from "./helpers";

export const C1_ACTIVITES: PdfFormField[] = [
  // ---------- MES ACTIVITÉS (10 questions, page 2) ----------
  ouiNon({
    id: "etudesPleinExercice",
    pdfFieldName: "oui_2|non_2",
    label: "Je suis des études de plein exercice (cours du jour)",
    help: "⚠ Si oui, perte du droit aux allocations sauf dispense FOREM / ACTIRIS / VDAB / ARBEITSAMT DG.",
    section: SECTION_ACTIVITES,
    order: 200,
  }),
  dateAPartirDu({
    id: "etudesPleinExerciceDate",
    pdfFieldName: "DateEtudes",
    parentId: "etudesPleinExercice",
    section: SECTION_ACTIVITES,
    order: 201,
  }),
  ouiNon({
    id: "apprentissageAlternance",
    pdfFieldName: "oui_3|non_3",
    label: "Je suis un apprentissage ou une formation en alternance",
    help: "⚠ Idem études — perte du droit sauf dispense. Si chômage temporaire pendant la formation, complète aussi la section « Situation familiale ».",
    section: SECTION_ACTIVITES,
    order: 210,
  }),
  dateAPartirDu({
    id: "apprentissageAlternanceDate",
    pdfFieldName: "DateFormation",
    parentId: "apprentissageAlternance",
    section: SECTION_ACTIVITES,
    order: 211,
  }),
  ouiNon({
    id: "formationStageSyntra",
    pdfFieldName: "oui_4|non_4",
    label: "Je suis une formation avec convention de stage (SYNTRA / IFAPME / EFEPME / IAWM)",
    help: "⚠ Idem études — perte du droit sauf dispense.",
    section: SECTION_ACTIVITES,
    order: 220,
  }),
  dateAPartirDu({
    id: "formationStageSyntraDate",
    pdfFieldName: "DateFormationStageSyntraIfapmeEpepmeIawm",
    parentId: "formationStageSyntra",
    section: SECTION_ACTIVITES,
    order: 221,
  }),
  ouiNon({
    id: "mandatArtistique",
    pdfFieldName: "oui_5|non_5",
    label: "J'exerce un mandat rémunéré dans un organe consultatif du secteur culturel ou de la Commission du travail des arts",
    help: "→ Joindre un FORMULAIRE C46 si pas encore déclaré.",
    section: SECTION_ACTIVITES,
    order: 230,
  }),
  dejaDeclare({
      id: "mandatArtistiqueDejaDeclare",
      parentId: "mandatArtistique",
      helpText: "Si non, tu devras compléter le FORMULAIRE C46 — il sera ajouté à ton parcours.",
      section: SECTION_ACTIVITES,
      order: 231,
      pdfFieldName: "Oui_PremièreFoisC45DéjàDéclaré|Oui_PremièreFoisC46",
      stepPriority: "optional",
    }),
  ouiNon({
    id: "mandatPolitique",
    pdfFieldName: "oui_6|non_6",
    label: "J'exerce un mandat politique",
    help: "→ Joindre un FORMULAIRE C1A. Exception : si tu es conseiller communal ou membre du Conseil de l'action sociale, réponds « non » (pas de C1A à joindre).",
    section: SECTION_ACTIVITES,
    order: 240,
  }),
  {
    // La paire « 1ʳᵉ fois / déjà déclaré » imprimée en marge du mandat
    // politique (et de lui SEUL — arbitrage Oraliks 2026-07-26, malgré sa
    // position qui semble encadrer la ligne suivante). Ses deux widgets
    // étaient orphelins : la question n'était jamais posée et les deux cases
    // partaient vierges.
    //
    // Pilote le déclencheur `mandatPolitique → c1a` (cf. C1_TRIGGERS) :
    // répondre « oui, déjà déclaré » évite d'ajouter un C1A au dossier pour un
    // mandat signalé lors d'une démarche précédente.
    ...dejaDeclare({
      id: "mandatPolitiqueDejaDeclare",
      parentId: "mandatPolitique",
      helpText: "Réponds « oui » seulement si ce mandat a déjà été signalé à ton organisme de paiement lors d'un dossier précédent.",
      section: SECTION_ACTIVITES,
      order: 241,
      pdfFieldName: "Oui_PremièreFoisC1ADéjàDéclaré|Oui_PremièreFoisC1A",
    }),
    stepPriority: "optional",
  },
  ouiNon({
    id: "chapitreXIIArts",
    pdfFieldName: "oui_7|non_7",
    label: "Je bénéficie (ou souhaite bénéficier) du Chapitre XII sur la base de l'attestation du travail des arts",
    help: "Demande des explications à ton organisme de paiement.",
    section: SECTION_ACTIVITES,
    order: 250,
  }),
  ouiNon({
    id: "tremplinIndependants",
    pdfFieldName: "oui_8|non_8",
    label: "J'exerce une activité accessoire comme indépendant et je bénéficie (ou souhaite bénéficier) de la mesure « Tremplin-indépendants »",
    help: "→ Joindre un FORMULAIRE C1C si pas encore déclaré.",
    section: SECTION_ACTIVITES,
    order: 270,
  }),
  dejaDeclare({
      id: "tremplinIndependantsDejaDeclare",
      parentId: "tremplinIndependants",
      helpText:
        "Si non, tu devras compléter le FORMULAIRE C1C — il sera ajouté à ton parcours.",
      section: SECTION_ACTIVITES,
      order: 271,
      pdfFieldName: "Oui_PremièreFoisC1CDéjàDéclaré|Oui_PremièreFoisC1C",
      stepPriority: "optional",
    }),
  ouiNon({
    id: "activiteAccessoireOuAide",
    pdfFieldName: "oui_9|non_9",
    label: "J'exerce une activité accessoire ou j'aide un travailleur indépendant",
    help: "→ Joindre un FORMULAIRE C1A si pas encore déclaré.",
    section: SECTION_ACTIVITES,
    order: 280,
  }),
  dejaDeclare({
      id: "activiteAccessoireDejaDeclare",
      parentId: "activiteAccessoireOuAide",
      helpText: "Si non, tu devras compléter le FORMULAIRE C1A — il sera ajouté à ton parcours.",
      section: SECTION_ACTIVITES,
      order: 281,
      pdfFieldName: "Oui_PremièreFoisC1A2DejaDéclaré|Oui_PremièreFoisC1A2",
      stepPriority: "optional",
    }),
  ouiNon({
    id: "administrateurSociete",
    pdfFieldName: "oui_10|non_10",
    label: "Je suis administrateur de société",
    help: "→ Joindre un FORMULAIRE C1A si pas encore déclaré.",
    section: SECTION_ACTIVITES,
    order: 290,
  }),
  dejaDeclare({
      id: "administrateurSocieteDejaDeclare",
      parentId: "administrateurSociete",
      helpText: "Si non, tu devras compléter le FORMULAIRE C1A — il sera ajouté à ton parcours.",
      section: SECTION_ACTIVITES,
      order: 291,
      // Le PDF officiel mutualise une seule paire C1A pour les questions 9-11
      // (accessoire / administrateur / indép. accessoire-principal). On pointe
      // donc sur la même paire que les autres follow-ups C1A — le dernier
      // remplissage gagne.
      pdfFieldName: "Oui_PremièreFoisC1A2DejaDéclaré|Oui_PremièreFoisC1A2",
      stepPriority: "optional",
    }),
  ouiNon({
    id: "independantAccessoireOuPrincipal",
    pdfFieldName: "oui_11|non_11",
    label: "Je suis inscrit comme indépendant à titre accessoire ou principal",
    help: "⚠ Si à titre principal, pas de droit aux allocations de chômage. Si accessoire, joindre un FORMULAIRE C1A si pas encore déclaré.",
    section: SECTION_ACTIVITES,
    order: 500,
  }),
  dejaDeclare({
      id: "independantAccessoireDejaDeclare",
      parentId: "independantAccessoireOuPrincipal",
      helpText:
        "Pour une activité accessoire : si non déclarée, tu devras compléter le FORMULAIRE C1A.",
      section: SECTION_ACTIVITES,
      order: 501,
      pdfFieldName: "Oui_PremièreFoisC1A2DejaDéclaré|Oui_PremièreFoisC1A2",
      stepPriority: "optional",
    }),

  // ---------- MES REVENUS (5 questions, page 2) ----------
  ouiNon({
    id: "pensionCategorieParticuliere",
    pdfFieldName: "oui_12|non_12",
    label: "J'appartiens à une catégorie professionnelle particulière (mineur, pilote, marin…) et j'ai droit à une pension complète",
    help: "⚠ Si tu remplis les conditions d'âge et d'ancienneté pour la pension spécifique, pas de droit aux allocations.",
    section: SECTION_REVENUS,
    order: 510,
  }),
  ouiNon({
    id: "pensionRetraiteSurvie",
    pdfFieldName: "oui_13|non_13",
    label: "Je perçois une pension de retraite ou de survie",
    help: "→ Joindre un FORMULAIRE C1B si pas encore déclaré. Exception : une « allocation de transition » (limitée dans le temps) se déclare « non » — cumulable sans limite.",
    section: SECTION_REVENUS,
    order: 520,
  }),
  dejaDeclare({
      id: "pensionRetraiteDejaDeclare",
      parentId: "pensionRetraiteSurvie",
      helpText: "Si non, tu devras compléter le FORMULAIRE C1B — il sera ajouté à ton parcours.",
      section: SECTION_REVENUS,
      order: 521,
      pdfFieldName:
        "ma déclaration précédente sur le FORMULAIRE C1B reste inchangée|je le déclare pour la première fois ou je déclare une modification et je",
      stepPriority: "optional",
    }),
  ouiNon({
    id: "indemniteMaladieInvalidite",
    pdfFieldName: "oui_14|non_14",
    label: "Je perçois une indemnité de maladie ou d'invalidité",
    help: "À déclarer. Demande des explications à ton organisme de paiement.",
    section: SECTION_REVENUS,
    order: 530,
  }),
  ouiNon({
    id: "indemniteAccidentTravail",
    pdfFieldName: "oui_15|non_15",
    label: "Je perçois une indemnité pour accident du travail ou maladie professionnelle",
    help: "À déclarer.",
    section: SECTION_REVENUS,
    order: 540,
  }),
  ouiNon({
    id: "avantageFinancierFormation",
    pdfFieldName: "oui_16|non_16",
    label: "Je perçois un avantage financier dans le cadre ou à la suite d'une formation, d'études, d'un apprentissage, d'un stage ou d'une activité dans une coopérative d'activités",
    help: "⚠ Entraîne la perte du droit aux allocations sauf dispense ou autorisation du service régional de l'emploi.",
    section: SECTION_REVENUS,
    order: 550,
  }),
];
