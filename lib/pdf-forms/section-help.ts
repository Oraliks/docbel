// Textes d'aide contextuelle par section, affichés dans ContextHelpPanel.
// Trilingue belge (fr/nl/de = le type Locale des formulaires PDF). Les autres
// langues de l'app (es/it/… ) ne s'appliquent pas ici : l'aide des
// formulaires PDF est du contenu scopé Belgique. FR = référence ; NL/DE
// retombent sur FR par clé si une traduction manque.
//
// ⚠️ Traductions NL/DE produites automatiquement, alignées sur la
// terminologie de `section-labels.ts` — à faire relire par un locuteur natif
// avant diffusion large (même précaution que le reste de l'i18n du projet).

import { DEFAULT_LOCALE, type Locale } from "./types";

export interface SectionHelp {
  title: string;
  body: string;
  examples?: string[];
}

/// Aide par section, par locale. Chaque section fournit AU MOINS `fr`
/// (garanti par le repli dans `getSectionHelp`) ; nl/de sont ajoutées quand
/// disponibles.
const HELP: Record<string, Partial<Record<Locale, SectionHelp>>> = {
  identite: {
    fr: {
      title: "Votre identité",
      body: "Vérifiez que votre nom, prénom et numéro NISS correspondent à votre carte d'identité.",
    },
    nl: {
      title: "Uw identiteit",
      body: "Controleer of uw naam, voornaam en rijksregisternummer overeenkomen met uw identiteitskaart.",
    },
    de: {
      title: "Ihre Identität",
      body: "Überprüfen Sie, ob Name, Vorname und NISS-Nummer mit Ihrem Personalausweis übereinstimmen.",
    },
  },
  adresse: {
    fr: {
      title: "Votre adresse",
      body: "Indiquez l'adresse à laquelle vous habitez actuellement (celle de votre domiciliation officielle).",
    },
    nl: {
      title: "Uw adres",
      body: "Geef het adres op waar u momenteel woont (uw officiële woonplaats).",
    },
    de: {
      title: "Ihre Adresse",
      body: "Geben Sie die Adresse an, an der Sie derzeit wohnen (Ihr offizieller Wohnsitz).",
    },
  },
  demande: {
    fr: {
      title: "Comprendre cette étape",
      body: "Indiquez la nature du changement intervenu dans votre situation.",
      examples: ["Mariage, séparation", "Déménagement", "Nouveau revenu", "Changement d'emploi", "Naissance ou départ d'un enfant"],
    },
    nl: {
      title: "Deze stap begrijpen",
      body: "Geef aan welke wijziging er in uw situatie heeft plaatsgevonden.",
      examples: ["Huwelijk, scheiding", "Verhuizing", "Nieuw inkomen", "Verandering van werk", "Geboorte of vertrek van een kind"],
    },
    de: {
      title: "Diesen Schritt verstehen",
      body: "Geben Sie an, welche Änderung in Ihrer Situation eingetreten ist.",
      examples: ["Heirat, Trennung", "Umzug", "Neues Einkommen", "Arbeitsplatzwechsel", "Geburt oder Auszug eines Kindes"],
    },
  },
  "situation-familiale": {
    fr: {
      title: "Votre situation familiale",
      body: "Ces informations déterminent votre catégorie (isolé, cohabitant, chef de ménage) et donc le montant de vos allocations.",
    },
    nl: {
      title: "Uw gezinssituatie",
      body: "Deze gegevens bepalen uw categorie (alleenwonend, samenwonend, gezinshoofd) en dus het bedrag van uw uitkering.",
    },
    de: {
      title: "Ihre Familiensituation",
      body: "Diese Angaben bestimmen Ihre Kategorie (alleinstehend, zusammenwohnend, Haushaltsvorstand) und damit die Höhe Ihrer Leistungen.",
    },
  },
  "mes-activites": {
    fr: {
      title: "Vos activités",
      body: "Toute activité professionnelle, même accessoire, doit être déclarée — elle peut nécessiter un formulaire complémentaire.",
    },
    nl: {
      title: "Uw activiteiten",
      body: "Elke beroepsactiviteit, ook een bijkomende, moet worden aangegeven — daarvoor kan een aanvullend formulier nodig zijn.",
    },
    de: {
      title: "Ihre Tätigkeiten",
      body: "Jede berufliche Tätigkeit, auch eine nebenberufliche, muss angegeben werden — dafür kann ein zusätzliches Formular erforderlich sein.",
    },
  },
  "mes-revenus": {
    fr: {
      title: "Vos revenus",
      body: "Ces questions permettent de vérifier si un autre revenu de remplacement doit être pris en compte.",
    },
    nl: {
      title: "Uw inkomsten",
      body: "Met deze vragen wordt nagegaan of er met een ander vervangingsinkomen rekening moet worden gehouden.",
    },
    de: {
      title: "Ihre Einkünfte",
      body: "Diese Fragen dienen dazu, zu prüfen, ob ein anderes Ersatzeinkommen zu berücksichtigen ist.",
    },
  },
  "mode-paiement": {
    fr: {
      title: "Votre compte bancaire",
      body: "Le compte sur lequel vos allocations seront versées.",
    },
    nl: {
      title: "Uw bankrekening",
      body: "De rekening waarop uw uitkering wordt gestort.",
    },
    de: {
      title: "Ihr Bankkonto",
      body: "Das Konto, auf das Ihre Leistungen überwiesen werden.",
    },
  },
  "cotisation-syndicale": {
    fr: {
      title: "Cotisation syndicale",
      body: "Concerne la retenue de la cotisation syndicale sur vos allocations, si applicable.",
    },
    nl: {
      title: "Vakbondsbijdrage",
      body: "Betreft de inhouding van de vakbondsbijdrage op uw uitkering, indien van toepassing.",
    },
    de: {
      title: "Gewerkschaftsbeitrag",
      body: "Betrifft den Abzug des Gewerkschaftsbeitrags von Ihren Leistungen, sofern zutreffend.",
    },
  },
  "non-eee": {
    fr: {
      title: "Hors Espace économique européen",
      body: "Ces questions concernent les travailleurs venant d'un pays hors UE/EEE/Suisse.",
    },
    nl: {
      title: "Buiten de Europese Economische Ruimte",
      body: "Deze vragen gelden voor werknemers uit een land buiten de EU/EER/Zwitserland.",
    },
    de: {
      title: "Außerhalb des Europäischen Wirtschaftsraums",
      body: "Diese Fragen betreffen Arbeitnehmer aus einem Land außerhalb der EU/des EWR/der Schweiz.",
    },
  },
  divers: {
    fr: {
      title: "Informations complémentaires",
      body: "Quelques questions additionnelles nécessaires à l'examen de votre dossier.",
    },
    nl: {
      title: "Aanvullende informatie",
      body: "Enkele bijkomende vragen die nodig zijn voor het onderzoek van uw dossier.",
    },
    de: {
      title: "Ergänzende Angaben",
      body: "Einige zusätzliche Fragen, die für die Prüfung Ihrer Akte erforderlich sind.",
    },
  },
  affirmations: {
    fr: {
      title: "Déclaration sur l'honneur",
      body: "Ces affirmations engagent votre responsabilité — relisez-les avant de continuer.",
    },
    nl: {
      title: "Verklaring op eer",
      body: "Deze verklaringen vallen onder uw verantwoordelijkheid — lees ze na voordat u verdergaat.",
    },
    de: {
      title: "Ehrenwörtliche Erklärung",
      body: "Diese Erklärungen liegen in Ihrer Verantwortung — lesen Sie sie durch, bevor Sie fortfahren.",
    },
  },
  annexes: {
    fr: {
      title: "Annexes",
      body: "Documents ou informations complémentaires, à fournir seulement si votre situation le nécessite.",
    },
    nl: {
      title: "Bijlagen",
      body: "Aanvullende documenten of gegevens, enkel te bezorgen als uw situatie dit vereist.",
    },
    de: {
      title: "Anlagen",
      body: "Zusätzliche Dokumente oder Angaben, nur bereitzustellen, wenn Ihre Situation dies erfordert.",
    },
  },
};

const FALLBACK: Record<Locale, SectionHelp> = {
  fr: { title: "Pourquoi ces questions ?", body: "Ces informations permettent d'actualiser votre dossier et de vérifier si vos droits peuvent changer." },
  nl: { title: "Waarom deze vragen?", body: "Met deze gegevens kan uw dossier worden bijgewerkt en kan worden nagegaan of uw rechten kunnen wijzigen." },
  de: { title: "Warum diese Fragen?", body: "Mit diesen Angaben kann Ihre Akte aktualisiert und geprüft werden, ob sich Ihre Ansprüche ändern können." },
};

/// Renvoie l'aide contextuelle pour une section, dans la locale demandée.
/// Repli sur le FR si la traduction manque pour cette section/locale, puis
/// sur un texte générique si la section n'a pas d'entrée dédiée (ex. un
/// formulaire compagnon non documenté ici) — ne renvoie jamais de chaîne vide.
export function getSectionHelp(key: string | undefined, lang: Locale): SectionHelp {
  if (key && HELP[key]) {
    return HELP[key][lang] ?? HELP[key][DEFAULT_LOCALE] ?? FALLBACK[lang];
  }
  return FALLBACK[lang] ?? FALLBACK[DEFAULT_LOCALE];
}
