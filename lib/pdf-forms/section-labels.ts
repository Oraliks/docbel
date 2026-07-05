import { Locale } from "./types";

/// Libellés localisés des sections auto-détectées (field-inference).
const LABELS: Record<string, Record<Locale, string>> = {
  identite: { fr: "Identité", nl: "Identiteit", de: "Identität" },
  adresse: { fr: "Adresse", nl: "Adres", de: "Adresse" },
  employeur: { fr: "Employeur", nl: "Werkgever", de: "Arbeitgeber" },
  banque: { fr: "Coordonnées bancaires", nl: "Bankgegevens", de: "Bankverbindung" },
  demande: { fr: "Motifs d'introduction", nl: "Aanvraagredenen", de: "Antragsgründe" },
  "situation-familiale": { fr: "Situation familiale", nl: "Gezinssituatie", de: "Familienstand" },
  "mes-activites": { fr: "Mes activités", nl: "Mijn activiteiten", de: "Meine Tätigkeiten" },
  "activites-anterieures": { fr: "Activités antérieures", nl: "", de: "" },
  "mandat-culturel": { fr: "Votre mandat", nl: "", de: "" },
  "mes-revenus": { fr: "Mes revenus", nl: "Mijn inkomsten", de: "Meine Einkünfte" },
  "mode-paiement": { fr: "Mode de paiement", nl: "Betaalwijze", de: "Zahlungsweise" },
  "cotisation-syndicale": { fr: "Cotisation syndicale", nl: "Vakbondsbijdrage", de: "Gewerkschaftsbeitrag" },
  "non-eee": { fr: "Travailleur hors EEE / Suisse", nl: "Werknemer buiten EER/Zwitserland", de: "Arbeitnehmer außerhalb EWR/Schweiz" },
  partenaire: { fr: "Le partenaire", nl: "", de: "" },
  divers: { fr: "Divers", nl: "Diversen", de: "Sonstiges" },
  absences: { fr: "Absences et interruptions", nl: "Afwezigheden en onderbrekingen", de: "Abwesenheiten und Unterbrechungen" },
  inscription: { fr: "Inscription comme demandeur d'emploi", nl: "Inschrijving als werkzoekende", de: "Anmeldung als Arbeitsuchender" },
  affirmations: { fr: "Affirmations sur l'honneur", nl: "Eervolle verklaringen", de: "Eidesstattliche Erklärung" },
  annexes: { fr: "Annexes (optionnelles)", nl: "Bijlagen (optioneel)", de: "Anlagen (optional)" },
  signature: { fr: "Date et signature", nl: "Datum en handtekening", de: "Datum und Unterschrift" },
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
