// Schéma enrichi du formulaire "C1-PARTENAIRE" — déclaration de cohabitation
// avec un partenaire financièrement à charge (personne qui n'est pas mariée
// au chômeur, cohabite avec lui, et ne perçoit ni revenu professionnel ni
// revenu de remplacement — ou, pour les allocations d'insertion, perçoit un
// revenu de remplacement).
//
// Mapping AcroForm vérifié sur le dump JSON fourni (1 page, 23 widgets).
// Référence métier : texte imprimé du FORMULAIRE C1-PARTENAIRE (ONEM,
// 15.09.2022/830.20.001) — 6 conditions cumulatives de la rubrique "Qui est
// considéré comme votre partenaire ?" et 6 questions oui/non de la rubrique
// "Le partenaire :".
//
// Déclenché depuis le C1 principal : cf. c1-fields-improvements.ts —
// C1_TRIGGERS[0] (cohabitants[*].c1PartenaireStatus === "premiere-fois").

import type { PdfFormField } from "../types";

const SECTION_IDENTITE = "identite";
const SECTION_PARTENAIRE = "partenaire";
const SECTION_AFFIRMATIONS = "affirmations";
const SECTION_SIGNATURE = "signature";

const YN = [
  { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
  { value: "non", label: { fr: "Non", nl: "", de: "" } },
];

/// Aide complète reprenant les 6 conditions cumulatives du texte imprimé
/// (rubrique "Qui est considéré comme votre partenaire ?"). Affichée sur le
/// premier champ d'identité du partenaire pour que le citoyen la voie avant
/// de remplir quoi que ce soit.
const PARTENAIRE_DEFINITION_HELP =
  "L'ONEM ne considère cette personne comme ton « partenaire à charge » que si TOUTES ces conditions sont remplies en même temps : (1) elle cohabite et forme un ménage de fait avec toi ; (2) elle n'est pas un membre de ta famille (pas un parent ou allié jusqu'au 3e degré inclus) ; (3) elle n'est pas un enfant encore à charge d'un parent qui doit une pension alimentaire ; (4) elle ne perçoit ni le revenu d'intégration, ni l'aide financière qui le remplace (aide du CPAS) ; (5) elle n'est pas déjà déclarée à charge d'un autre membre du ménage ; (6) elle n'est pas mariée et ne cohabite pas avec son/sa conjoint(e). Complète ce formulaire si ton partenaire (non marié) ne perçoit aucun revenu professionnel ni de remplacement — ou, pour une demande d'allocations d'insertion, s'il perçoit un revenu de remplacement.";

/// Construit une question oui/non fusionnée (paire de checkboxes ONEM) avec
/// ses éventuels champs de détail affichés seulement si la réponse est "oui".
function ynQuestion(opts: {
  id: string;
  pdfNon: string;
  pdfOui: string;
  label: string;
  help?: string;
  order: number;
}): PdfFormField {
  return {
    id: opts.id,
    pdfFieldName: `${opts.pdfOui}|${opts.pdfNon}`,
    type: "radio",
    required: true,
    label: { fr: opts.label, nl: "", de: "" },
    help: opts.help ? { fr: opts.help, nl: "", de: "" } : undefined,
    options: YN,
    section: SECTION_PARTENAIRE,
    order: opts.order,
  };
}

export const C1_PARTENAIRE_FIELDS: PdfFormField[] = [
  // ====================================================================
  // IDENTITÉ DU CHÔMEUR ET DU PARTENAIRE
  // ====================================================================
  {
    id: "niss_ch_meur",
    pdfFieldName: "NISS Chômeur",
    type: "niss",
    required: true,
    label: { fr: "Ton numéro NISS (registre national)", nl: "", de: "" },
    help: {
      fr: "11 chiffres au dos de ta carte d'identité (eID), au-dessus du code-barres.",
      nl: "", de: "",
    },
    placeholder: { fr: "00.00.00-000.00", nl: "", de: "" },
    prefillFrom: "profile.niss",
    section: SECTION_IDENTITE,
    order: -100,
  },
  {
    id: "nom_ch_meur",
    pdfFieldName: "Nom chômeur",
    type: "text",
    required: true,
    label: { fr: "Ton nom et prénom", nl: "", de: "" },
    section: SECTION_IDENTITE,
    order: -99,
  },
  {
    id: "niss_partenaire",
    pdfFieldName: "NISS Partenaire",
    type: "text",
    required: true,
    label: { fr: "NISS ou date de naissance du partenaire", nl: "", de: "" },
    help: {
      fr: "Indique le numéro NISS du partenaire. S'il n'en a pas encore (ex. personne récemment arrivée en Belgique), indique sa date de naissance à la place.",
      nl: "", de: "",
    },
    section: SECTION_IDENTITE,
    order: -98,
  },
  {
    id: "nom_partenaire",
    pdfFieldName: "Nom partenaire",
    type: "text",
    required: true,
    label: { fr: "Nom et prénom du partenaire", nl: "", de: "" },
    help: { fr: PARTENAIRE_DEFINITION_HELP, nl: "", de: "" },
    section: SECTION_IDENTITE,
    order: -97,
  },
  {
    id: "dateDA",
    pdfFieldName: "Date de DA",
    type: "date",
    required: false,
    label: { fr: "Date de la demande d'allocations (ou de modification)", nl: "", de: "" },
    help: {
      fr: "Case réservée à l'organisme de paiement (cachet dateur) — tu peux généralement la laisser vide.",
      nl: "", de: "",
    },
    prefillFrom: "system.today",
    section: SECTION_IDENTITE,
    order: -96,
  },

  // ====================================================================
  // "LE PARTENAIRE :" — 6 questions oui/non (dans l'ordre du texte imprimé)
  // ====================================================================
  ynQuestion({
    id: "partenaireRevenuProfessionnel",
    pdfNon: "non",
    pdfOui: "oui",
    label: "Le partenaire a un revenu professionnel",
    help: "Un salaire (comme salarié) ou un revenu d'indépendant, même partiel.",
    order: 100,
  }),
  {
    id: "m_tier",
    pdfFieldName: "métier",
    type: "text",
    required: false,
    label: { fr: "Si oui, quelle activité professionnelle exerce-t-il/elle ?", nl: "", de: "" },
    help: {
      fr: "Indique « salarié » et/ou « indépendant ». Si l'activité est exercée comme indépendant, ne remplis PAS le montant mensuel brut ci-dessous.",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "partenaireRevenuProfessionnel", op: "equals", value: "oui" },
    section: SECTION_PARTENAIRE,
    order: 101,
  },
  {
    id: "montant_mensuel_brut",
    pdfFieldName: "Montant mensuel brut",
    type: "text",
    required: false,
    label: { fr: "Montant mensuel brut (si activité salariée)", nl: "", de: "" },
    help: {
      fr: "Uniquement si l'activité est salariée. Laisse vide si le partenaire est indépendant.",
      nl: "", de: "",
    },
    visibleIf: { fieldId: "partenaireRevenuProfessionnel", op: "equals", value: "oui" },
    section: SECTION_PARTENAIRE,
    order: 102,
  },
  ynQuestion({
    id: "partenaireRevenuRemplacement",
    pdfNon: "non_2",
    pdfOui: "oui_2",
    label: "Le partenaire a un revenu de remplacement",
    help: "Par exemple une indemnité de mutuelle, une pension, ou une allocation de chômage.",
    order: 110,
  }),
  {
    id: "revenu_de_remplacement",
    pdfFieldName: "Revenu de remplacement",
    type: "text",
    required: false,
    label: { fr: "Si oui, nature du revenu de remplacement", nl: "", de: "" },
    // A VALIDER Oraliks : le texte imprimé ne précise pas d'exemples pour
    // cette rubrique (contrairement à la définition de "revenu de
    // remplacement" ailleurs dans le C1) — à confirmer si une liste
    // d'exemples (mutuelle/pension/chômage) doit être ajoutée ici aussi.
    visibleIf: { fieldId: "partenaireRevenuRemplacement", op: "equals", value: "oui" },
    section: SECTION_PARTENAIRE,
    order: 111,
  },
  // A VALIDER Oraliks : le dump JSON ne fournit qu'UN SEUL widget "Montant
  // mensuel brut" (mappé ci-dessus sur "montant_mensuel_brut", au revenu
  // professionnel). Le texte imprimé affiche pourtant "Montant mensuel
  // brut :......" une seconde fois à la ligne du revenu de remplacement
  // (page 1, juste après "nature du revenu de remplacement"). Deux
  // hypothèses possibles : (a) le PDF officiel réel a un second widget
  // absent de ce dump — il faudra le rajouter avec son vrai pdfFieldName ;
  // (b) le formulaire réutilise le MÊME widget pour les deux montants (rare
  // mais déjà vu sur d'autres formulaires ONEM) — auquel cas il faut
  // ajuster le help de "montant_mensuel_brut" pour couvrir les deux cas.
  // Je n'ajoute PAS de champ virtuel supplémentaire pour éviter de deviner
  // un comportement de remplissage PDF qui pourrait écraser la mauvaise
  // case. À corriger dès que le PDF officiel réel (pas seulement le dump)
  // est disponible pour vérification.
  ynQuestion({
    id: "partenaireRevenuIntegration",
    pdfNon: "non_3",
    pdfOui: "oui_3",
    label: "Le partenaire perçoit le revenu d'intégration ou l'aide du CPAS qui le remplace",
    help: "⚠ Si oui, cette personne ne peut pas être déclarée comme partenaire à charge (une des 6 conditions cumulatives n'est plus remplie).",
    order: 120,
  }),
  ynQuestion({
    id: "partenaireDejaDeclareAutreChomeur",
    pdfNon: "non_4",
    pdfOui: "oui_4",
    label: "Le partenaire est déjà déclaré à charge financièrement d'un autre chômeur membre du ménage",
    help: "⚠ Si oui, cette personne ne peut pas être déclarée une seconde fois à charge (une seule déclaration à la fois).",
    order: 130,
  }),
  ynQuestion({
    id: "partenaireApparente3eDegre",
    pdfNon: "non_5",
    pdfOui: "oui_5",
    label: "Le partenaire est apparenté au chômeur jusqu'au troisième degré",
    help: "Parent, beau-parent ou parent d'accueil, enfant, (arrière-)petit-enfant, (arrière-)grand-parent, oncle, tante, frère, sœur, neveu ou nièce. ⚠ Si oui, cette personne ne peut pas être déclarée comme partenaire à charge (elle est considérée comme un membre de la famille).",
    order: 140,
  }),
  ynQuestion({
    id: "partenaireAllocationsFamiliales",
    pdfNon: "non_6",
    pdfOui: "oui_6",
    label: "Le partenaire est une personne pour qui quelqu'un perçoit des allocations familiales",
    order: 150,
  }),

  // ====================================================================
  // AFFIRMATIONS ET SIGNATURES
  // ====================================================================
  {
    id: "aujourd_hui",
    pdfFieldName: "Aujourd'hui",
    type: "date",
    required: true,
    label: { fr: "Date de la déclaration", nl: "", de: "" },
    help: { fr: "Pré-remplie automatiquement avec la date du jour.", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_AFFIRMATIONS,
    order: 900,
  },
  {
    id: "signature_du_ch_meur",
    pdfFieldName: "Signature du chômeur",
    type: "signature",
    required: true,
    label: { fr: "Ta signature", nl: "", de: "" },
    help: {
      fr: "En signant, tu affirmes que cette déclaration est sincère et complète, et tu t'engages à signaler immédiatement à ton organisme de paiement tout changement de situation.",
      nl: "", de: "",
    },
    section: SECTION_SIGNATURE,
    order: 1000,
  },
  {
    id: "signature_du_partenaire",
    pdfFieldName: "Signature du partenaire",
    type: "signature",
    required: true,
    label: { fr: "Signature du partenaire", nl: "", de: "" },
    help: {
      fr: "Le partenaire doit signer aussi — cette déclaration l'engage lui/elle également.",
      nl: "", de: "",
    },
    section: SECTION_SIGNATURE,
    order: 1001,
  },
];

/// Set des `pdfFieldName` (côté oui ET côté non) couverts par les 6
/// questions radio fusionnées. Sert à supprimer les anciens champs
/// checkboxes individuels ("non", "oui", "non_2", "oui_2"…) que le parser
/// AcroForm avait inférés séparément.
function coveredCheckboxNames(): Set<string> {
  const set = new Set<string>();
  for (const f of C1_PARTENAIRE_FIELDS) {
    if (!f.pdfFieldName.includes("|")) continue;
    for (const name of f.pdfFieldName.split("|")) set.add(name.trim());
  }
  return set;
}

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import).
///
/// Comportement :
/// 1. Retire tous les champs inférés correspondant aux 6 paires oui_N/non_N
///    (les nouveaux champs `radio` les couvrent).
/// 2. Retire aussi un éventuel ancien champ portant un id qu'on redéfinit.
/// 3. Append les 17 champs enrichis.
///
/// Idempotent : ré-exécutable sans dupliquer (compare les `id` et les
/// `pdfFieldName` couverts).
export function applyC1PartenaireImprovements(fields: PdfFormField[]): PdfFormField[] {
  const covered = coveredCheckboxNames();
  const newIds = new Set(C1_PARTENAIRE_FIELDS.map((f) => f.id));

  const preserved = fields.filter((f) => {
    if (covered.has(f.pdfFieldName)) return false;
    if (newIds.has(f.id)) return false;
    return true;
  });

  return [...preserved, ...C1_PARTENAIRE_FIELDS];
}
