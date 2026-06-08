import { Locale } from "./types";

/// Libellés localisés des sections auto-détectées (field-inference).
const LABELS: Record<string, Record<Locale, string>> = {
  identite: { fr: "Identité", nl: "Identiteit", de: "Identität" },
  adresse: { fr: "Adresse", nl: "Adres", de: "Adresse" },
  employeur: { fr: "Employeur", nl: "Werkgever", de: "Arbeitgeber" },
  banque: { fr: "Coordonnées bancaires", nl: "Bankgegevens", de: "Bankverbindung" },
  "mes-activites": { fr: "Mes activités", nl: "Mijn activiteiten", de: "Meine Tätigkeiten" },
  "mes-revenus": { fr: "Mes revenus", nl: "Mijn inkomsten", de: "Meine Einkünfte" },
};

const DEFAULT: Record<Locale, string> = {
  fr: "Informations",
  nl: "Gegevens",
  de: "Angaben",
};

export function sectionLabel(key: string | undefined, lang: Locale): string {
  if (!key) return DEFAULT[lang];
  return LABELS[key]?.[lang] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
