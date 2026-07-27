// IDENTITÉ & ADRESSE — extrait de `c1-fields-improvements.ts` (2026-07-26).
//
// Identité, adresse et contact du citoyen — en-tête de la page 1.
//
// Découpage PUREMENT structurel : les définitions sont déplacées telles
// quelles. Le tableau complet est réassemblé dans `./index.ts`, dans l'ordre
// des modules — c'est cet ordre qui détermine l'ordre d'affichage.

import type { PdfFormField } from "../../types";
import {
  SECTION_IDENTITE,
} from "./helpers";

export const C1_IDENTITE: PdfFormField[] = [
  // ====================================================================
  // SECTION 0 — IDENTITÉ & ADRESSE (page 1, en haut du PDF)
  // Ces champs étaient auparavant inférés automatiquement à l'import :
  // libellés laids ("nationalité 3", "numéro de boîte"…) et tous typés
  // "text" sans validation. On les enrichit ici avec libellés FR propres,
  // types sémantiques (niss, postal_be, phone_be, email, date) et prefill
  // depuis le profil utilisateur quand c'est pertinent.
  //
  // Les `id` reprennent ceux que `field-inference.ts#makeId` produit à
  // partir du `pdfFieldName` officiel — ainsi `applyC1Improvements()`
  // remplace l'entrée inférée par cette version enrichie (et n'en duplique
  // pas une seconde).
  // ====================================================================
  {
    id: "nom",
    pdfFieldName: "Nom",
    type: "text",
    required: true,
    label: { fr: "Nom" },
    prefillFrom: "profile.lastName",
    canonicalKey: "identity.nom",
    section: SECTION_IDENTITE,
    order: -100,
  },
  {
    id: "pr_nom",
    pdfFieldName: "Prenom",
    type: "text",
    required: true,
    label: { fr: "Prénom" },
    prefillFrom: "profile.firstName",
    canonicalKey: "identity.prenom",
    section: SECTION_IDENTITE,
    order: -99,
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
    // `autoSizeFont` RETIRÉ le 2026-07-27. Il compensait le /Helvetica 12 Tf
    // impose par le widget source sur une case de 10,8 pt de haut, superposée
    // à un guide imprimé en peigne où tout débordement se voit (Oraliks
    // 2026-07-08) : on déléguait l'ajustement au lecteur PDF, qui rendait le
    // NISS nettement plus petit que ses voisins de ligne.
    //
    // Le filler ne subit plus les 12 pt du gabarit : il pose 10 pt et réduit
    // lui-même si le texte dépasse la case. Or « 85.06.12-345.67 » y occupe
    // 83 pt sur les 142 disponibles — il tient largement, et à la même taille
    // que le nom juste à côté.
    //
    // 12 pt, et non la taille uniforme : le peigne imprimé sous la case est
    // dessiné pour cette taille (c'est celle qu'imposait le gabarit), et à
    // 10 pt la saisie paraît rabougrie entre ses tirets (Oraliks 2026-07-27,
    // capture à l'appui). « 85.06.12-345.67 » y occupe alors 100 pt sur 142.
    fontSize: 12,
    // Les points et tirets du NISS sont DEJA imprimes sur le peigne du
    // formulaire : les reimprimer les doublait (Oraliks 2026-07-27).
    printAsComb: true,
    section: SECTION_IDENTITE,
    order: -98,
  },
  {
    id: "date_de_naissance",
    pdfFieldName: "DateNaissance",
    type: "date",
    required: true,
    label: { fr: "Date de naissance" },
    help: {
      fr: "Déduite automatiquement de ton NISS dès qu'il est complet et valide — sinon, renseigne-la toi-même.",
    },
    prefillFrom: "itsme.birthDate",
    canonicalKey: "identity.dateNaissance",
    // Se recalcule en direct depuis le NISS (checksum T.I. 000, cf.
    // lib/pdf-forms/niss-birthdate.ts) et se verrouille (lecture seule)
    // TANT QUE le NISS produit une date valide ; redevient éditable si le
    // NISS est vide/incomplet (jamais de champ requis inaccessible).
    derivedFrom: { fieldId: "niss", via: "niss-birth-date" },
    // Retiré pour la même raison que `niss` — et sur la même ligne du
    // formulaire, donc les deux doivent s'afficher à la même taille sous peine
    // de paraître dépareillés. « 12/06/1985 » occupe 69 pt sur 95 à 12 pt.
    fontSize: 12,
    section: SECTION_IDENTITE,
    order: -97,
  },
  {
    id: "nationalit_3",
    pdfFieldName: "Nationalite",
    type: "text",
    required: true,
    label: { fr: "Nationalité" },
    help: {
      fr: "Tape le début du nom de ton pays (ex. « maro » → Maroc). Si tu es hors EEE/Suisse, complète aussi la rubrique dédiée plus bas.",
    },
    // Recherche + drapeau (countrySelect, cf. lib/pdf-forms/world-countries.ts
    // — même mécanisme que le champ `pays`). La valeur stockée/stampée est le
    // NOM du pays ("Maroc"), pas le démonyme grammatical ("Marocaine") — reste
    // compatible avec le matching EEE de field-derivations.ts#nationalite-
    // hors-eee (accepte déjà les deux formes, cf. nationalite-eee.ts).
    countrySelect: true,
    canonicalKey: "identity.nationalite",
    section: SECTION_IDENTITE,
    order: -96,
  },
  // Code postal EN PREMIER (Oraliks, 2026-07-06) : une fois connu, il
  // priorise les suggestions de rue correspondantes (sans jamais masquer les
  // autres — cf. lib/pdf-forms/street-suggestions.ts) et affiche un indice
  // de commune (via /api/postal-lookup, données Commune/PostalCode en base).
  {
    id: "code_postal",
    // Pas de widget direct : le widget « CodePostal et Commune » est stampé
    // UNIQUEMENT par la règle serveur `code-postal-commune` (« 1000 Bruxelles »),
    // qui lit la valeur de ce champ + la commune résolue. Évite un conflit
    // champ↔règle sur le même widget (cf. mapping-report). Le champ reste
    // validé (postal_be), prérempli et source de l'autocomplete rue + commune.
    pdfFieldName: "",
    type: "postal_be",
    required: true,
    label: { fr: "Code postal" },
    placeholder: { fr: "1000" },
    prefillFrom: "profile.postalCode",
    canonicalKey: "adresse.codePostal",
    section: SECTION_IDENTITE,
    order: -90,
  },
  {
    id: "adresse_rue",
    pdfFieldName: "Adresse - Rue",
    type: "text",
    required: true,
    label: { fr: "Rue" },
    help: {
      fr: "Commence à taper puis CHOISIS ta rue dans la liste (noms officiels FR et NL). Si elle n'apparaît pas, coche « ma rue n'est pas dans la liste » juste en dessous.",
    },
    prefillFrom: "profile.street",
    streetAutocomplete: { postalFieldId: "code_postal" },
    // Input plus large (Oraliks 2026-07-11) : le nom de rue est souvent long.
    wide: true,
    // Forçage (Oraliks 2026-07-09/11) : la rue doit être choisie dans les
    // suggestions BeStAddress (FR ou NL) POUR une adresse belge — sauf
    // échappatoire ci-dessous. Pour un pays étranger (`pays` ≠ Belgique), la
    // saisie libre est autorisée (BeStAddress ne couvre que la Belgique).
    // Contrôle côté runner (cf. list-match.ts).
    requireListMatch: { escapeFieldId: "adresse_rue_hors_liste", countryFieldId: "pays" },
    canonicalKey: "adresse.rue",
    section: SECTION_IDENTITE,
    order: -89,
  },
  {
    // Échappatoire du forçage de rue : rues neuves, rurales, ou absentes de
    // BeStAddress ne doivent jamais bloquer un dossier légitime.
    id: "adresse_rue_hors_liste",
    pdfFieldName: "",
    type: "checkbox",
    required: false,
    label: { fr: "Ma rue n'est pas dans la liste proposée" },
    help: {
      fr: "Coche uniquement si ta rue n'apparaît pas dans les suggestions — tu pourras alors la saisir librement (vérifie bien l'orthographe).",
    },
    section: SECTION_IDENTITE,
    order: -88.5,
  },
  {
    id: "num_ro",
    pdfFieldName: "Numero",
    type: "text",
    required: true,
    label: { fr: "Numéro" },
    canonicalKey: "adresse.numero",
    section: SECTION_IDENTITE,
    order: -88,
  },
  {
    id: "num_ro_de_bo_te",
    pdfFieldName: "NumeroBoite",
    type: "text",
    required: false,
    label: { fr: "Boîte" },
    help: { fr: "Numéro de boîte si applicable (laisser vide sinon)." },
    canonicalKey: "adresse.boite",
    section: SECTION_IDENTITE,
    order: -87,
  },
  {
    // Commune (Oraliks 2026-07-09/10) : champ auto-rempli à l'écran depuis le
    // code postal (cf. commune-select-input.tsx : 1 commune verrouillé,
    // plusieurs = menu, étranger = libre). Sur le PDF, le nouvel AcroForm
    // d'Oraliks fusionne code postal + commune dans le widget unique
    // « CodePostal et Commune » (le champ code_postal y est mappé) → la règle
    // serveur `codePostalCommune` (bindings) y écrit « 1000 Bruxelles ». Plus
    // de dessin positionnel `drawAt` (le widget existe désormais).
    id: "commune",
    pdfFieldName: "",
    type: "text",
    required: true,
    label: { fr: "Commune" },
    help: {
      fr: "Remplie automatiquement à partir de ton code postal. Si le code couvre plusieurs communes, choisis la tienne ; pour une adresse à l'étranger, saisis-la à la main.",
    },
    communeFrom: { postalFieldId: "code_postal" },
    canonicalKey: "adresse.commune",
    section: SECTION_IDENTITE,
    order: -86.5,
  },
  {
    id: "pays",
    pdfFieldName: "Pays",
    type: "text",
    required: true,
    label: { fr: "Pays" },
    help: {
      fr: "Rempli automatiquement à partir du code postal (belge à 4 chiffres → Belgique). Pour une adresse à l'étranger, tape le début du nom (ex. « maro » → Maroc).",
    },
    // Dérivé du code postal : belge (4 chiffres) → « Belgique » et verrouillé ;
    // sinon éditable via recherche (countrySelect, ~195 pays + drapeau, cf.
    // lib/pdf-forms/world-countries.ts) — on n'a pas de base postale UE dans
    // le repo pour dériver automatiquement un pays étranger depuis son code
    // postal (cf. field-derivations.ts#postal-be-country).
    derivedFrom: { fieldId: "code_postal", via: "postal-be-country" },
    countrySelect: true,
    canonicalKey: "adresse.pays",
    section: SECTION_IDENTITE,
    order: -86,
  },
  // Remarque : la ville n'a pas de widget dédié sur le C1 (le code postal
  // suffit côté ONEM). On la prefill quand même via profile.city si l'admin
  // ajoute un champ « ville » manuellement plus tard.
  {
    id: "adresse_email_facultatif",
    pdfFieldName: "Email",
    type: "email",
    required: false,
    // Masqué du form runner (Oraliks 2026-07-11) : champ optionnel, retiré de
    // l'UI mais conservé dans le schéma (widget PDF `Email` toujours mappé si
    // un jour on le réactive). `hidden` = ni affiché, ni soumis.
    hidden: true,
    label: { fr: "Adresse e-mail (facultatif)" },
    placeholder: { fr: "nom@exemple.be" },
    prefillFrom: "profile.email",
    canonicalKey: "contact.email",
    section: SECTION_IDENTITE,
    order: -85,
  },
  {
    id: "num_ro_de_t_l_phone_facultatif",
    pdfFieldName: "Telephone",
    type: "phone_be",
    required: false,
    // Masqué du form runner (Oraliks 2026-07-11) : optionnel, retiré de l'UI
    // mais conservé dans le schéma.
    hidden: true,
    label: { fr: "Numéro de téléphone (facultatif)" },
    placeholder: { fr: "0470 12 34 56" },
    prefillFrom: "profile.phone",
    canonicalKey: "contact.telephone",
    section: SECTION_IDENTITE,
    order: -84,
  },
];
