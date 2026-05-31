// Catalogue de champs canoniques partagés entre TOUS les dossiers.
//
// "Les data sont souvent liées" : NISS, nom, adresse, IBAN, employeur… sont
// les mêmes d'un dossier à l'autre. On les définit UNE fois ici (type,
// validation implicite via le type, libellé multilingue, source de prefill),
// et chaque dossier/document les réutilise par clé.
//
// Avantages :
//  - un PdfForm qui "utilise NISS" hérite automatiquement du bon type, du
//    prefill profil/itsme, et participe à la propagation cross-document dans
//    un bundle (cf. lib/bundles/shared-values.ts via `prefillFrom`).
//  - changer un libellé / un prefill = un seul endroit.

import type { FieldType, Localized, PrefillSource } from "@/lib/pdf-forms/types";

export interface CanonicalField {
  /// Clé stable référencée par les dossiers (ex. "niss", "iban").
  key: string;
  /// Nom de champ AcroForm par défaut (pour les PDFs générés/gabarits).
  /// Pour un vrai PDF officiel, l'admin remappe sur le nom réel du widget.
  pdfFieldName: string;
  type: FieldType;
  label: Localized;
  help?: Localized;
  /// Source de pré-remplissage (profil utilisateur / itsme / système).
  prefillFrom?: PrefillSource;
}

/// Définition typée du catalogue. `as const satisfies` garde l'autocomplétion
/// sur les clés tout en validant la forme.
export const CATALOG = {
  fullName: {
    key: "fullName",
    pdfFieldName: "FullName",
    type: "fullname",
    label: { fr: "Nom complet", nl: "Volledige naam", de: "Vollständiger Name" },
  },
  firstName: {
    key: "firstName",
    pdfFieldName: "FirstName",
    type: "text",
    label: { fr: "Prénom", nl: "Voornaam", de: "Vorname" },
    prefillFrom: "profile.firstName",
  },
  lastName: {
    key: "lastName",
    pdfFieldName: "LastName",
    type: "text",
    label: { fr: "Nom", nl: "Naam", de: "Name" },
    prefillFrom: "profile.lastName",
  },
  niss: {
    key: "niss",
    pdfFieldName: "NISS",
    type: "niss",
    label: { fr: "Numéro NISS", nl: "Rijksregisternummer", de: "NISS-Nummer" },
    help: { fr: "11 chiffres au dos de votre carte d'identité (eID)." },
    prefillFrom: "profile.niss",
  },
  birthDate: {
    key: "birthDate",
    pdfFieldName: "BirthDate",
    type: "date",
    label: { fr: "Date de naissance", nl: "Geboortedatum", de: "Geburtsdatum" },
    prefillFrom: "itsme.birthDate",
  },
  street: {
    key: "street",
    pdfFieldName: "Street",
    type: "text",
    label: { fr: "Rue", nl: "Straat", de: "Straße" },
    prefillFrom: "profile.street",
  },
  postalCode: {
    key: "postalCode",
    pdfFieldName: "PostalCode",
    type: "postal_be",
    label: { fr: "Code postal", nl: "Postcode", de: "Postleitzahl" },
    prefillFrom: "profile.postalCode",
  },
  city: {
    key: "city",
    pdfFieldName: "City",
    type: "text",
    label: { fr: "Ville", nl: "Gemeente", de: "Stadt" },
    prefillFrom: "profile.city",
  },
  iban: {
    key: "iban",
    pdfFieldName: "IBAN",
    type: "iban",
    label: { fr: "IBAN", nl: "IBAN", de: "IBAN" },
    prefillFrom: "profile.iban",
  },
  employerName: {
    key: "employerName",
    pdfFieldName: "EmployerName",
    type: "text",
    label: { fr: "Nom de l'employeur", nl: "Naam werkgever", de: "Name des Arbeitgebers" },
  },
  employerBce: {
    key: "employerBce",
    pdfFieldName: "EmployerBCE",
    type: "bce",
    label: { fr: "N° BCE de l'employeur", nl: "KBO-nummer werkgever", de: "ZDU-Nummer des Arbeitgebers" },
  },
  /// Date de génération du document (jamais saisie : injectée à la génération).
  creationDate: {
    key: "creationDate",
    pdfFieldName: "CreationDate",
    type: "date",
    label: { fr: "Date de création", nl: "Aanmaakdatum", de: "Erstellungsdatum" },
    prefillFrom: "system.today",
  },
  signature: {
    key: "signature",
    pdfFieldName: "Signature",
    type: "signature",
    label: { fr: "Signature", nl: "Handtekening", de: "Unterschrift" },
  },
} as const satisfies Record<string, CanonicalField>;

export type CanonicalKey = keyof typeof CATALOG;

export function getCanonicalField(key: CanonicalKey): CanonicalField {
  return CATALOG[key];
}
