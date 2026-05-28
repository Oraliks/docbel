import { FieldType, Localized } from "./types";

/// Définition d'un preset de champ réutilisable.
export interface FieldPresetDef {
  key: string;
  label: string;
  fieldType: FieldType;
  regex?: string;
  errorMsg?: Localized;
  helpText?: Localized;
  maxLength?: number;
}

/// Presets fournis d'origine (builtin). Couvrent les champs belges courants.
/// Ils sont semés en base via scripts/seed-pdf-presets et marqués builtin.
export const BUILTIN_PRESETS: FieldPresetDef[] = [
  {
    key: "be_niss",
    label: "NISS (registre national)",
    fieldType: "niss",
    helpText: {
      fr: "11 chiffres au dos de votre carte d'identité.",
      nl: "11 cijfers op de achterkant van uw identiteitskaart.",
      de: "11 Ziffern auf der Rückseite Ihres Personalausweises.",
    },
  },
  {
    key: "be_iban",
    label: "IBAN belge",
    fieldType: "iban",
    helpText: { fr: "Format BE.. (16 caractères).", nl: "Formaat BE.. (16 tekens).", de: "Format BE.. (16 Zeichen)." },
  },
  {
    key: "be_postal",
    label: "Code postal belge",
    fieldType: "postal_be",
    maxLength: 4,
  },
  { key: "be_phone", label: "Téléphone belge", fieldType: "phone_be" },
  { key: "be_bce", label: "Numéro d'entreprise (BCE)", fieldType: "bce" },
  { key: "be_tva", label: "Numéro de TVA", fieldType: "tva_be" },
  { key: "email", label: "Adresse e-mail", fieldType: "email" },
  { key: "date", label: "Date", fieldType: "date" },
];
