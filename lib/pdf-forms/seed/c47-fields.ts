// Schéma enrichi du formulaire "C47 - DEMANDE DE FIXATION DES ALLOCATIONS"
// (incapacité permanente au travail de 33 % au moins).
//
// Petit formulaire compagnon (1 page, 11 widgets AcroForm), déclenché depuis
// le C1 quand le citoyen répond "oui" à la question "incapacité de travail
// permanente d'au moins 33 %" (cf. C1_TRIGGERS dans c1-fields-improvements.ts,
// requiresFormSlug: "c47").
//
// Base légale imprimée sur le PDF officiel :
//   - art. 114 AR 25.11.1991 : fixation du montant de l'allocation en dehors
//     du contrôle de la disponibilité active.
//   - art. 36/3, § 2 AR 25.11.1991 : jeune travailleur en stage d'insertion
//     professionnelle, dans le cadre du contrôle de la disponibilité active.
//   - art. 58, § 1er et art. 58/3, § 4 AR 25.11.1991 : chômeur complet
//     indemnisé, dans le cadre du contrôle de la disponibilité active.
//   - art. 63, § 2, al. 4, 4° AR 25.11.1991 : renvoi depuis le C1.
//
// Mapping AcroForm : dump JSON fourni (11 champs, pdfFieldName vérifié tel
// quel — aucune modification de casse/espaces).
// Version imprimée : 01.10.2020/833.10.047.

import type { PdfFormField } from "../types";

const SECTION_IDENTITE = "identite";
const SECTION_ADRESSE = "adresse";
const SECTION_DEMANDE = "demande";
const SECTION_SIGNATURE = "signature";

export const C47_FIELDS: PdfFormField[] = [
  // ==========================================================================
  // Votre identité
  // ==========================================================================
  {
    id: "pr_nom_et_nom",
    pdfFieldName: "Prénom et nom",
    type: "fullname",
    required: true,
    label: { fr: "Prénom et nom", nl: "", de: "" },
    prefillFrom: "profile.lastName",
    section: SECTION_IDENTITE,
    order: 0,
  },
  {
    id: "rue",
    pdfFieldName: "Rue",
    type: "text",
    required: true,
    label: { fr: "Numéro et rue", nl: "", de: "" },
    prefillFrom: "profile.street",
    section: SECTION_ADRESSE,
    order: 1,
  },
  {
    id: "commune_et_code_postal",
    pdfFieldName: "Commune et code postal",
    type: "postal_be",
    required: true,
    label: { fr: "Code postal et commune", nl: "", de: "" },
    prefillFrom: "profile.postalCode",
    section: SECTION_ADRESSE,
    order: 2,
  },
  {
    id: "niss",
    pdfFieldName: "NISS",
    type: "niss",
    required: true,
    label: { fr: "Numéro NISS (registre national)", nl: "", de: "" },
    help: {
      fr: "11 chiffres au dos de ta carte d'identité (eID), au-dessus du code-barres.",
      nl: "", de: "",
    },
    placeholder: { fr: "00.00.00-000.00", nl: "", de: "" },
    prefillFrom: "profile.niss",
    section: SECTION_IDENTITE,
    order: 3,
  },
  {
    id: "t_l_phone",
    pdfFieldName: "Téléphone",
    type: "phone_be",
    required: false,
    label: { fr: "Téléphone", nl: "", de: "" },
    help: { fr: "Facultatif.", nl: "", de: "" },
    prefillFrom: "profile.phone",
    section: SECTION_IDENTITE,
    order: 4,
  },
  {
    id: "email",
    pdfFieldName: "Email",
    type: "email",
    required: false,
    label: { fr: "E-mail", nl: "", de: "" },
    help: { fr: "Facultatif.", nl: "", de: "" },
    prefillFrom: "profile.email",
    section: SECTION_IDENTITE,
    order: 5,
  },

  // ==========================================================================
  // Votre demande
  //
  // A VALIDER Oraliks : le PDF imprimé distingue clairement 2 cadres de
  // demande (cf. texte extrait) :
  //   1) "si elle ne s'inscrit PAS dans le cadre du contrôle de la
  //      disponibilité active" → une seule phrase "je demande que le montant
  //      de mon allocation de chômage soit fixé à partir du __/__/____"
  //      (art. 114), avec juste au-dessus l'instruction "indiquez ici la date
  //      de début de l'inaptitude permanente de 33 %".
  //   2) "si elle s'inscrit dans le cadre du contrôle de la disponibilité
  //      active" → les 2 cases jeune travailleur en stage / chômeur complet
  //      indemnisé.
  // Mais le dump AcroForm ne contient qu'UN SEUL champ date ("Date de DA") au
  // total, pas deux. Le champ "dateDA" ci-dessous est donc mappé sur ce widget
  // unique et sert de date de début d'inaptitude dans les deux cas — mais je
  // n'ai pas de confirmation que le widget est bien positionné/utilisé pour le
  // cas 1) (hors contrôle dispo active) autant que pour le cas 2). Idem :
  // aucun widget checkbox distinct ne semble exister sur le PDF pour la phrase
  // "j'invoque une inaptitude permanente au travail d'au moins 33 %" du cas 1)
  // ni pour "je demande que le montant soit fixé à partir du..." — seule la
  // date semble matérialiser ce cas dans l'AcroForm. Merci de confirmer que
  // c'est le comportement réel du PDF (peut-être un unique champ date
  // volontairement partagé) avant de considérer ce formulaire complet à 100%.
  {
    id: "dateDA",
    pdfFieldName: "Date de DA",
    type: "date",
    required: true,
    label: { fr: "Date de début de l'inaptitude permanente de 33 %", nl: "", de: "" },
    help: {
      fr: "Indique la date à partir de laquelle ton inaptitude permanente au travail d'au moins 33 % a débuté. C'est aussi la date à partir de laquelle tu demandes que le montant de ton allocation soit fixé (art. 114).",
      nl: "", de: "",
    },
    section: SECTION_DEMANDE,
    order: 100,
  },
  {
    id: "jeuneTravailleurStageInsertion",
    pdfFieldName:
      "Je suis un jeune travailleur en stage d'insertion professionnelle et j'invoque une inaptitude permanente au travail de 33 % au moins.\n(art. 36/3, § 2, AR 25.11.1991)",
    type: "checkbox",
    required: false,
    label: {
      fr: "Je suis un jeune travailleur en stage d'insertion professionnelle et j'invoque une inaptitude permanente au travail de 33 % au moins",
      nl: "", de: "",
    },
    help: {
      fr: "Ne coche cette case que si tu es en stage d'insertion professionnelle (art. 36/3, § 2). Cette case et la suivante (« chômeur complet indemnisé ») sont mutuellement exclusives : coche celle qui correspond à ta situation, jamais les deux. Cette partie ne concerne que le cas où ta demande s'inscrit dans le cadre du contrôle de la disponibilité active par le service régional de l'emploi compétent.",
      nl: "", de: "",
    },
    section: SECTION_DEMANDE,
    order: 101,
  },
  {
    id: "chomeurCompletIndemniseInaptitude",
    pdfFieldName:
      "Je suis chômeur complet indemnisé et j'invoque une inaptitude permanente au travail de 33 % au moins.\n(art. 58, § 1er, et 58/3, § 4, AR 25.11.1991)",
    type: "checkbox",
    required: false,
    label: {
      fr: "Je suis chômeur complet indemnisé et j'invoque une inaptitude permanente au travail de 33 % au moins",
      nl: "", de: "",
    },
    help: {
      fr: "Ne coche cette case que si tu es chômeur complet indemnisé (art. 58, § 1er, et 58/3, § 4). Cette case et la précédente (« jeune travailleur en stage d'insertion professionnelle ») sont mutuellement exclusives : coche celle qui correspond à ta situation, jamais les deux. Cette partie ne concerne que le cas où ta demande s'inscrit dans le cadre du contrôle de la disponibilité active par le service régional de l'emploi compétent.",
      nl: "", de: "",
    },
    section: SECTION_DEMANDE,
    order: 102,
  },

  // ==========================================================================
  // Document à joindre (rappel imprimé sur le PDF — pas de widget dédié)
  // ==========================================================================
  // A VALIDER Oraliks : aucun widget AcroForm ne correspond à ce rappel
  // documentaire ("Certificat médical qui atteste de votre inaptitude
  // permanente au travail — l'indication du taux d'inaptitude n'est pas
  // obligatoire"). Faut-il l'ajouter comme information statique côté
  // BundleRunner (hors PdfFormField), ou un champ purement informatif est-il
  // attendu ici malgré l'absence de pdfFieldName ? Je ne crée pas de champ
  // pour ce rappel documentaire faute de widget PDF à cibler.

  // ==========================================================================
  // Signature
  // ==========================================================================
  {
    id: "aujourd_hui",
    pdfFieldName: "AUJOURD'HUI",
    type: "date",
    required: true,
    label: { fr: "Date", nl: "", de: "" },
    help: { fr: "Date à laquelle tu signes cette déclaration.", nl: "", de: "" },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 200,
  },
  {
    id: "signature",
    pdfFieldName: "Signature",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique", nl: "", de: "" },
    help: {
      fr: "En signant, tu affirmes sur l'honneur que ta déclaration est sincère et complète.",
      nl: "", de: "",
    },
    section: SECTION_SIGNATURE,
    order: 201,
  },
];

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id`).
export function applyC47Improvements(fields: PdfFormField[]): PdfFormField[] {
  const newIds = new Set(C47_FIELDS.map((f) => f.id));
  const preserved = fields.filter((f) => !newIds.has(f.id));
  return [...preserved, ...C47_FIELDS];
}
