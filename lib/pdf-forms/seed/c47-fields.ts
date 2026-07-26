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
import { mergeEnrichedFields } from "./_merge";

const SECTION_IDENTITE = "identite";
const SECTION_ADRESSE = "adresse";
const SECTION_DEMANDE = "demande";
const SECTION_SIGNATURE = "signature";

export const C47_FIELDS: PdfFormField[] = [
  // ==========================================================================
  // Votre identité
  // ==========================================================================
  {
    // `prefillFrom` retiré le 2026-07-26 : sur un champ `fullname` il ne
    // transportait que le NOM, et le runner relisant une chaîne comme un nom,
    // le prénom se perdait. Le type suffit — cf. `canonicalToPrefill` et
    // `buildProfilePrefill`, qui remplissent tous deux les composites.
    id: "pr_nom_et_nom",
    pdfFieldName: "Prénom et nom",
    type: "fullname",
    required: true,
    label: { fr: "Prénom et nom" },
    section: SECTION_IDENTITE,
    order: 0,
  },
  // ADRESSE — les deux widgets du PDF fusionnent chacun DEUX informations. On
  // saisit donc les quatre valeurs séparément, chacune canonisée pour hériter
  // du C1, et deux règles serveur recomposent les lignes imprimées
  // (`bindings/per-form/c47.ts`). Même pattern que le C1A.
  //
  // Ordre d'assemblage : rue puis numéro, code postal puis commune (confirmé
  // par Oraliks le 2026-07-26). Les noms de widgets du C47 disent l'inverse
  // (« Commune et code postal ») et son libellé d'origine disait « Numéro et
  // rue » : c'est SANS IMPORTANCE. Les formulaires ONEM alternent librement
  // « nom, prénom » et « prénom, nom », idem pour l'adresse — ces libellés ne
  // dictent pas l'ordre attendu dans la case.
  {
    id: "rue",
    pdfFieldName: "",
    type: "text",
    required: true,
    label: { fr: "Rue" },
    prefillFrom: "profile.street",
    canonicalKey: "adresse.rue",
    section: SECTION_ADRESSE,
    order: 1,
  },
  {
    id: "numero",
    pdfFieldName: "",
    type: "text",
    required: true,
    label: { fr: "Numéro" },
    canonicalKey: "adresse.numero",
    section: SECTION_ADRESSE,
    order: 1.5,
  },
  {
    id: "codePostal",
    pdfFieldName: "",
    type: "postal_be",
    required: true,
    label: { fr: "Code postal" },
    prefillFrom: "profile.postalCode",
    canonicalKey: "adresse.codePostal",
    section: SECTION_ADRESSE,
    order: 2,
  },
  {
    id: "commune",
    pdfFieldName: "",
    type: "text",
    required: true,
    label: { fr: "Commune" },
    prefillFrom: "profile.city",
    canonicalKey: "adresse.commune",
    section: SECTION_ADRESSE,
    order: 2.5,
  },
  {
    id: "niss",
    pdfFieldName: "NISS",
    type: "niss",
    required: true,
    label: { fr: "Numéro NISS (registre national)" },
    help: {
      fr: "11 chiffres au dos de ta carte d'identité (eID), au-dessus du code-barres.",
    },
    placeholder: { fr: "00.00.00-000.00" },
    prefillFrom: "profile.niss",
    canonicalKey: "identity.niss",
    section: SECTION_IDENTITE,
    order: 3,
  },
  {
    id: "t_l_phone",
    pdfFieldName: "Téléphone",
    type: "phone_be",
    required: false,
    label: { fr: "Téléphone" },
    help: { fr: "Facultatif." },
    prefillFrom: "profile.phone",
    canonicalKey: "contact.telephone",
    section: SECTION_IDENTITE,
    order: 4,
  },
  {
    id: "email",
    pdfFieldName: "Email",
    type: "email",
    required: false,
    label: { fr: "E-mail" },
    help: { fr: "Facultatif." },
    prefillFrom: "profile.email",
    canonicalKey: "contact.email",
    section: SECTION_IDENTITE,
    order: 5,
  },
  // NOTE canonique : `pr_nom_et_nom` (fullname composite) et `rue` +
  // `commune_et_code_postal` (widgets combinés « rue+numéro » et
  // « commune+CP ») ne sont pas tagués canonicalKey — leur structure n'est
  // pas 1-clé/1-valeur.

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
    label: { fr: "Date de début de l'inaptitude permanente de 33 %" },
    help: {
      fr: "Indique la date à partir de laquelle ton inaptitude permanente au travail d'au moins 33 % a débuté. C'est aussi la date à partir de laquelle tu demandes que le montant de ton allocation soit fixé (art. 114).",
    },
    section: SECTION_DEMANDE,
    order: 100,
  },
  {
    id: "jeuneTravailleurStageInsertion",
    // ⚠ Apostrophes TYPOGRAPHIQUES (’, U+2019) : c'est ce que contient le nom
    // du widget dans C47_FR.pdf. Avec l'apostrophe ASCII (') le champ pointait
    // vers un widget inexistant → 2 erreurs bloquantes à la publication et 2
    // cases jamais cochées. Ne jamais RETAPER un pdfFieldName : le copier
    // depuis `pnpm tsx scripts/dump-pdf-widgets.ts C47_FR`.
    pdfFieldName:
      "Je suis un jeune travailleur en stage d’insertion professionnelle et j’invoque une inaptitude permanente au travail de 33 % au moins.\n(art. 36/3, § 2, AR 25.11.1991)",
    type: "checkbox",
    required: false,
    label: {
      fr: "Je suis un jeune travailleur en stage d'insertion professionnelle et j'invoque une inaptitude permanente au travail de 33 % au moins",
    },
    help: {
      fr: "Ne coche cette case que si tu es en stage d'insertion professionnelle (art. 36/3, § 2). Cette case et la suivante (« chômeur complet indemnisé ») sont mutuellement exclusives : coche celle qui correspond à ta situation, jamais les deux. Cette partie ne concerne que le cas où ta demande s'inscrit dans le cadre du contrôle de la disponibilité active par le service régional de l'emploi compétent.",
    },
    section: SECTION_DEMANDE,
    order: 101,
  },
  {
    id: "chomeurCompletIndemniseInaptitude",
    // Idem : apostrophe typographique (’) exigée par le widget du PDF.
    pdfFieldName:
      "Je suis chômeur complet indemnisé et j’invoque une inaptitude permanente au travail de 33 % au moins.\n(art. 58, § 1er, et 58/3, § 4, AR 25.11.1991)",
    type: "checkbox",
    required: false,
    label: {
      fr: "Je suis chômeur complet indemnisé et j'invoque une inaptitude permanente au travail de 33 % au moins",
    },
    help: {
      fr: "Ne coche cette case que si tu es chômeur complet indemnisé (art. 58, § 1er, et 58/3, § 4). Cette case et la précédente (« jeune travailleur en stage d'insertion professionnelle ») sont mutuellement exclusives : coche celle qui correspond à ta situation, jamais les deux. Cette partie ne concerne que le cas où ta demande s'inscrit dans le cadre du contrôle de la disponibilité active par le service régional de l'emploi compétent.",
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
    label: { fr: "Date" },
    help: { fr: "Date à laquelle tu signes cette déclaration." },
    prefillFrom: "system.today",
    section: SECTION_SIGNATURE,
    order: 200,
  },
  {
    id: "signature",
    pdfFieldName: "Signature",
    type: "signature",
    required: true,
    label: { fr: "Signature électronique" },
    help: {
      fr: "En signant, tu affirmes sur l'honneur que ta déclaration est sincère et complète.",
    },
    section: SECTION_SIGNATURE,
    order: 201,
  },
];

/// Applique le schéma enrichi sur une liste de champs bruts (typiquement
/// issue de l'inférence automatique au moment de l'import). Idempotent :
/// ré-exécutable sans dupliquer (compare les `id`).
/// Champs d'une version antérieure dont le widget est désormais écrit par une
/// RÈGLE serveur. Sans cette liste ils survivraient en base — ce filtre ne
/// compare que les `id`, pas les `pdfFieldName` — et se battraient avec la
/// règle pour le même widget.
const LEGACY_C47_FIELD_IDS = new Set<string>([
  // Scindé en `codePostal` + `commune` (2026-07-26) ; le widget fusionné est
  // recomposé par `bindings/per-form/c47.ts`.
  "commune_et_code_postal",
]);

export function applyC47Improvements(fields: PdfFormField[]): PdfFormField[] {
  return mergeEnrichedFields(fields, C47_FIELDS, LEGACY_C47_FIELD_IDS);
}
