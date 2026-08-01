// PAIEMENT & COTISATION — extrait de `c1-fields-improvements.ts` (2026-07-26).
//
// Mode de paiement, compte bancaire, cotisation syndicale.
//
// Découpage PUREMENT structurel : les définitions sont déplacées telles
// quelles. Le tableau complet est réassemblé dans `./index.ts`, dans l'ordre
// des modules — c'est cet ordre qui détermine l'ordre d'affichage.

import type { PdfFormField } from "../../types";
import {
  SECTION_PAIEMENT,
  SECTION_COTISATION,
} from "./helpers";

export const C1_PAIEMENT: PdfFormField[] = [
  // ====================================================================
  // SECTION — MODE DE PAIEMENT
  // ====================================================================
  {
    id: "modePaiement",
    pdfFieldName: "dun virement bancaire Ce compte est à mon nom|dun chèque circulaire envoyé à ladresse mentionnée à la rubrique  MON IDENTITÉ  voir p 1",
    type: "radio",
    required: true,
    label: { fr: "Comment souhaitez-vous recevoir vos allocations ?" },
    help: { fr: "Le virement bancaire est le mode standard. Le chèque circulaire est exceptionnel." },
    options: [
      { value: "virement", label: { fr: "Par virement bancaire" } },
      { value: "cheque", label: { fr: "Par chèque circulaire envoyé à mon adresse" } },
    ],
    defaultValue: "virement",
    section: SECTION_PAIEMENT,
    order: 600,
  },
  {
    id: "modePaiementChequeWarning",
    pdfFieldName: "",
    type: "checkbox",
    // Obligatoire quand le chèque circulaire est choisi (Oraliks 2026-07-11) :
    // le citoyen DOIT confirmer avoir compris avant de continuer. `required`
    // sur un champ `visibleIf` ne s'applique que lorsque le champ est visible
    // (cf. superRefine) → n'exige la case que si mode = chèque.
    required: true,
    label: {
      fr: "Je confirme avoir compris que le chèque circulaire est rare et plus lent à la réception. Celui-ci sera envoyé à l'adresse mentionnée sur le formulaire C1.",
    },
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "cheque" },
    section: SECTION_PAIEMENT,
    order: 601,
  },
  {
    id: "titulaireCompte",
    pdfFieldName: "ouiOK|non au nom de",
    type: "radio",
    // Obligatoire (Oraliks 2026-07-07) : la case correspondante existe sur le
    // PDF officiel ONEM — la laisser vide côté citoyen fait remonter un doute
    // sur la propriété du compte à l'organisme de paiement.
    required: true,
    // Uniquement pour le VIREMENT (Oraliks 2026-07-11) : la question de la
    // propriété du compte n'a plus de sens pour le chèque circulaire (envoyé à
    // l'adresse, pas viré sur un compte) → masquée quand mode = chèque.
    label: { fr: "Le compte bancaire est à mon nom ?" },
    options: [
      { value: "mon-nom", label: { fr: "Oui, à mon nom" } },
      { value: "autre-nom", label: { fr: "Non, au nom d'une autre personne" } },
    ],
    defaultValue: "mon-nom",
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "virement" },
    section: SECTION_PAIEMENT,
    order: 602,
  },
  // Champ IBAN UNIQUE (Oraliks 2026-07-07) : un seul input à l'écran, accepte
  // IBAN belge (BE…) ET étranger (FR…, DE…, NL…, LT…, LU…, ES…, IT…, AL…,
  // etc. — 31 pays via `isValidInternationalIBAN`). Au submit, la valeur est
  // routée vers le bon widget PDF selon le préfixe pays par les règles
  // serveur `iban-be-split` (4 slots "B E" + undefined_11/12/13, y=440) et
  // `iban-etranger` (widget « SEPA étranger IBAN BIC »).
  {
    id: "iban",
    // pdfFieldName vide : le stamping est intégralement piloté par les
    // règles serveur (`lib/pdf-forms/bindings/per-form/c1-changement.ts`) —
    // aucun widget cible côté schéma.
    pdfFieldName: "",
    type: "iban",
    required: true,
    label: { fr: "N° de compte bancaire (IBAN)" },
    help: {
      fr: "IBAN belge (BE…) ou étranger de la zone SEPA (FR…, DE…, NL…, LU…, ES…, IT…, LT… etc.). Le pays est détecté depuis les 2 premières lettres. Pour certaines banques étrangères, le BIC est prérempli automatiquement.",
    },
    placeholder: { fr: "BE00 0000 0000 0000" },
    internationalIban: true,
    canonicalKey: "banque.iban",
    visibleIf: { fieldId: "modePaiement", op: "equals", value: "virement" },
    section: SECTION_PAIEMENT,
    order: 603,
  },
  // NOTE Phase 7 : 4 slots visuels IBAN belge ("B E", undefined_11/12/13),
  // widget « Nom du titulaire » (via `titulaireCompteNomStamp`) et widget
  // « SEPA étranger IBAN BIC » (via `sepa_tranger_iban_bic`) sont désormais
  // stampés par les règles serveur `iban-be-split` / `titulaire-mon-nom` /
  // `titulaire-autre` / `iban-etranger`
  // (`lib/pdf-forms/bindings/per-form/c1-changement.ts`). Les 6 champs
  // workaround `ibanCheckDigits` / `ibanPart1/2/3` / `titulaireCompteNomStamp`
  // / `sepa_tranger_iban_bic` ont été supprimés du schéma.
  {
    id: "titulaireCompteNom",
    // Champ PUREMENT UI : saisie manuelle du nom du titulaire quand
    // `titulaireCompte === "autre-nom"`. Le widget PDF « Nom du titulaire »
    // est stampé côté serveur par la règle `titulaire-autre` (ou
    // `titulaire-mon-nom` avec la valeur "Prénom Nom" du citoyen).
    pdfFieldName: "",
    type: "text",
    required: true,
    label: { fr: "Nom et prénom du propriétaire du compte" },
    placeholder: { fr: "Nom et prénom de la personne" },
    // ET mode = virement (Oraliks 2026-07-18) : même garde-fou que le BIC. Sans
    // ça, un usager qui choisit « au nom d'une autre personne » PUIS bascule sur
    // « chèque » verrait ce champ (requis) rester actif via la valeur résiduelle
    // de `titulaireCompte`, alors même que `titulaireCompte` est masqué — cf.
    // VisibleIf.and et le même correctif sur `bic`.
    visibleIf: {
      fieldId: "titulaireCompte",
      op: "equals",
      value: "autre-nom",
      and: [{ fieldId: "modePaiement", op: "equals", value: "virement" }],
    },
    canonicalKey: "banque.titulaire",
    section: SECTION_PAIEMENT,
    order: 604,
  },
  {
    id: "bic",
    pdfFieldName: "BIC",
    type: "text",
    // Obligatoire dès qu'il est visible (donc dès qu'un IBAN non-BE est
    // saisi) — la validation Zod n'exige un champ requis que s'il est
    // visible, cf. buildValidator + isFieldVisible dans validation.ts.
    required: true,
    label: { fr: "BIC (code SWIFT de la banque)" },
    help: {
      fr: "Obligatoire pour un IBAN étranger. Lorsqu'il est trouvé automatiquement, le BIC est ajouté et verrouillé. Sinon, retrouvez-le sur vos extraits de compte (8 ou 11 caractères, ex. BNPAFRPP).",
    },
    placeholder: { fr: "BNPAFRPP" },
    // Format ISO 9362 (4 lettres banque + 2 lettres pays + 2 alphanumériques
    // + 3 alphanumériques optionnels) — vérifie juste la FORME, jamais
    // l'exactitude d'un code banque réel (aucune base fiable disponible ici
    // pour ça ; le mauvais code enverrait un paiement au mauvais endroit).
    regex: "^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$",
    canonicalKey: "banque.bic",
    // Visible seulement pour un IBAN étranger (préfixe 2 lettres ≠ BE). La
    // regex `^(?![Bb][Ee])[A-Za-z]{2}` ancre 2 lettres au début de l'IBAN,
    // avec un negative-lookahead sur BE — évite d'afficher le BIC tant que
    // l'IBAN est vide ou incomplet (< 2 lettres). Case-insensitive côté
    // regex source pour absorber une saisie en minuscules.
    // ET mode = virement (Oraliks 2026-07-18) : sur un chèque circulaire il
    // n'y a pas de compte à créditer → le BIC n'a plus de sens. Le `and` gère
    // aussi le cas où l'usager avait saisi un IBAN étranger PUIS basculé sur
    // « chèque » : l'IBAN est masqué mais sa valeur persiste dans le payload,
    // ce qui laissait sinon le BIC visible ET requis (blocage) — cf. VisibleIf.
    visibleIf: {
      fieldId: "iban",
      op: "matchesRegex",
      value: "^(?![Bb][Ee])[A-Za-z]{2}",
      and: [{ fieldId: "modePaiement", op: "equals", value: "virement" }],
    },
    section: SECTION_PAIEMENT,
    order: 606,
  },

  // ====================================================================
  // SECTION — COTISATION SYNDICALE
  // Les deux cases doivent rester DÉCOCHÉES par défaut et ne pas être
  // cochables côté UX standard — la gestion est externe (organisme de
  // paiement). readOnly empêche la saisie utilisateur.
  // ====================================================================
  {
    id: "autoriseCotisationSyndicale",
    pdfFieldName: "Jautorise la retenue de la cotisation syndicale sur mes allocations à partir du mois de chômage de",
    type: "checkbox",
    required: false,
    label: { fr: "J'autorise la retenue de la cotisation syndicale sur mes allocations" },
    help: {
      fr: "Cette case est gérée directement par votre organisme de paiement — ne la cochez pas ici.",
    },
    readOnly: true,
    section: SECTION_COTISATION,
    order: 700,
    stepPriority: "optional",
  },
  {
    id: "retireCotisationSyndicale",
    pdfFieldName: "Je nautorise plus la retenue de la cotisation syndicale sur mes allocations à partir du mois de chômage de",
    type: "checkbox",
    required: false,
    label: { fr: "Je n'autorise plus la retenue de la cotisation syndicale" },
    help: { fr: "Gérée par l'organisme de paiement — ne pas cocher ici." },
    readOnly: true,
    section: SECTION_COTISATION,
    order: 701,
    stepPriority: "optional",
  },
  {
    // Le mois à partir duquel la retenue prend (ou cesse de prendre) effet —
    // les DEUX lignes ci-dessus se terminent par « à partir du mois de chômage
    // de », et le PDF n'a qu'une seule case pour les deux. Même régime que ces
    // lignes : `readOnly`, vide par défaut (Oraliks 2026-07-26 : « on laisse
    // vide par défaut et on ne coche pas la ligne non plus »). Sans ce champ,
    // la case restait orpheline et rien ne disait à quoi elle servait.
    id: "cotisationSyndicaleMoisAnnee",
    pdfFieldName: "Mois + Année",
    type: "text",
    required: false,
    label: { fr: "Mois et année de prise d'effet de la retenue" },
    help: {
      fr: "Format MM/AAAA. Renseignée par l'organisme de paiement en même temps que la case ci-dessus — laisser vide ici.",
    },
    placeholder: { fr: "MM/AAAA" },
    readOnly: true,
    section: SECTION_COTISATION,
    order: 702,
    stepPriority: "optional",
  },
];
