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

  // ── Sections ajoutées le 2026-08-02 ───────────────────────────────────────
  //
  // Elles retombaient toutes sur le générique « Pourquoi ces questions ? ».
  // Chaque texte ci-dessous ne dit que DEUX choses : ce que la rubrique demande
  // (repris du formulaire imprimé) et, le cas échéant, ce que fait Docbel.
  // Aucune condition d'octroi, aucun délai, aucun montant : une aide de section
  // n'est pas une source réglementaire.
  signature: {
    fr: {
      title: "Votre signature",
      body: "Votre signature et la date du jour sont apposées automatiquement à la génération du document. Relisez vos réponses : c'est cette version que vous téléchargerez.",
    },
    nl: {
      title: "Uw handtekening",
      body: "Uw handtekening en de datum van vandaag worden automatisch aangebracht bij het aanmaken van het document. Lees uw antwoorden na: dit is de versie die u zult downloaden.",
    },
    de: {
      title: "Ihre Unterschrift",
      body: "Ihre Unterschrift und das heutige Datum werden bei der Erstellung des Dokuments automatisch eingefügt. Lesen Sie Ihre Antworten noch einmal durch: Das ist die Fassung, die Sie herunterladen.",
    },
  },
  employeur: {
    fr: {
      title: "Votre employeur",
      body: "Indiquez le nom et l'adresse de votre employeur, tels qu'ils figurent sur votre contrat de travail ou votre fiche de paie.",
    },
    nl: {
      title: "Uw werkgever",
      body: "Vermeld de naam en het adres van uw werkgever, zoals ze op uw arbeidsovereenkomst of loonfiche staan.",
    },
    de: {
      title: "Ihr Arbeitgeber",
      body: "Geben Sie Namen und Anschrift Ihres Arbeitgebers an, so wie sie in Ihrem Arbeitsvertrag oder auf Ihrer Lohnabrechnung stehen.",
    },
  },
  "activites-anterieures": {
    fr: {
      title: "Vos activités antérieures",
      body: "Le formulaire demande si vous avez déjà exercé une activité indépendante à titre principal au cours des six dernières années, et laquelle.",
    },
    nl: {
      title: "Uw eerdere activiteiten",
      body: "Het formulier vraagt of u de voorbije zes jaar al een zelfstandige activiteit in hoofdberoep hebt uitgeoefend, en welke.",
    },
    de: {
      title: "Ihre früheren Tätigkeiten",
      body: "Das Formular fragt, ob Sie in den letzten sechs Jahren bereits eine selbständige Tätigkeit im Hauptberuf ausgeübt haben, und welche.",
    },
  },
  "grille-differences": {
    fr: {
      title: "La grille des différences",
      body: "Pour chaque ligne, comparez ce que vous avez déclaré sur le C1 avec ce que disent les registres. Une différence appelle un code d'explication, repris dans la légende du formulaire.",
    },
    nl: {
      title: "Het verschillenrooster",
      body: "Vergelijk voor elke regel wat u op het C1 hebt verklaard met wat de registers vermelden. Een verschil vraagt om een verklarende code, terug te vinden in de legende van het formulier.",
    },
    de: {
      title: "Die Abweichungstabelle",
      body: "Vergleichen Sie Zeile für Zeile Ihre Angaben auf dem C1 mit den Eintragungen der Register. Eine Abweichung erfordert einen Erklärungscode aus der Legende des Formulars.",
    },
  },
  "mandat-culturel": {
    fr: {
      title: "Vos mandats",
      body: "Nommez chaque organe consultatif où vous exercez un mandat. Si votre nomination a paru au Moniteur belge, indiquez-en la date ; sinon, joignez une copie de la nomination.",
    },
    nl: {
      title: "Uw mandaten",
      body: "Noem elk adviesorgaan waar u een mandaat uitoefent. Is uw benoeming in het Belgisch Staatsblad verschenen, vermeld dan de datum; zo niet, voeg een kopie van de benoeming bij.",
    },
    de: {
      title: "Ihre Mandate",
      body: "Nennen Sie jedes Beratungsorgan, in dem Sie ein Mandat ausüben. Wurde Ihre Ernennung im Belgischen Staatsblatt veröffentlicht, geben Sie das Datum an; andernfalls fügen Sie eine Kopie der Ernennung bei.",
    },
  },
  partenaire: {
    fr: {
      title: "Les revenus de votre partenaire",
      body: "Ces six questions servent à déterminer si votre partenaire peut être considéré comme financièrement à votre charge.",
    },
    nl: {
      title: "De inkomsten van uw partner",
      body: "Deze zes vragen dienen om te bepalen of uw partner als financieel ten laste kan worden beschouwd.",
    },
    de: {
      title: "Die Einkünfte Ihrer Partnerin oder Ihres Partners",
      body: "Diese sechs Fragen dienen der Feststellung, ob Ihre Partnerin oder Ihr Partner als finanziell zu Ihren Lasten gelten kann.",
    },
  },
};

/// Surcharges PAR FORMULAIRE, quand deux documents partagent une clé de
/// section mais ne posent pas la même question.
///
/// Le cas qui l'a rendue nécessaire : `demande` sert au C1 (« quel changement
/// déclarez-vous ? ») ET au C47 (« dans quel cadre demandez-vous la fixation
/// de vos allocations ? »). Le texte, écrit pour le C1, s'affichait tel quel
/// sur le C47 : un citoyen déclarant une inaptitude permanente de 33 % lisait
/// « Indiquez la nature du changement intervenu dans votre situation », avec
/// pour exemples un mariage, un déménagement ou une naissance (2026-08-02).
///
/// Indexé `slug → section → locale`. Ne rien y mettre qui vaille pour tous les
/// documents : le tableau commun reste la référence, celui-ci l'exception.
const SURCHARGES: Record<string, Record<string, Partial<Record<Locale, SectionHelp>>>> = {
  c47: {
    demande: {
      // Strictement ce que le papier annonce : le formulaire distingue les
      // demandes qui relèvent du contrôle de la disponibilité active de celles
      // qui n'en relèvent pas, et exige un certificat médical en annexe. Aucune
      // condition d'octroi n'est affirmée ici — ce n'est pas le rôle de l'aide.
      fr: {
        title: "Comprendre cette étape",
        body: "Indiquez dans quel cadre vous demandez la fixation du montant de vos allocations. Un certificat médical attestant votre inaptitude permanente au travail est à joindre au formulaire.",
      },
      nl: {
        title: "Deze stap begrijpen",
        body: "Geef aan in welk kader u de vaststelling van het bedrag van uw uitkeringen vraagt. Een medisch attest van uw blijvende arbeidsongeschiktheid moet bij het formulier worden gevoegd.",
      },
      de: {
        title: "Diesen Schritt verstehen",
        body: "Geben Sie an, in welchem Rahmen Sie die Festsetzung des Betrags Ihrer Leistungen beantragen. Ein ärztliches Attest über Ihre dauerhafte Arbeitsunfähigkeit ist dem Formular beizufügen.",
      },
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
/// Quelle section d'une macro-étape doit titrer le panneau d'aide.
///
/// Par défaut la PREMIÈRE, dans l'ordre du formulaire. Exception : la
/// signature. Elle ne mène jamais une étape — elle partage toujours l'écran
/// avec la dernière question ou avec les annexes, et l'aide affichée parlait
/// donc d'autre chose au moment précis où le citoyen appose une déclaration sur
/// l'honneur (mesuré le 2026-08-02 : l'Annexe REGIS titrait « Annexes », le
/// C1-PARTENAIRE « Les revenus de votre partenaire », le C47 « Comprendre cette
/// étape »). Quand une étape porte la signature, c'est d'elle qu'il faut
/// parler : c'est le geste de l'écran.
export function choisirCleDAide(sectionKeys: readonly string[]): string | undefined {
  return sectionKeys.includes("signature") ? "signature" : sectionKeys[0];
}

export function getSectionHelp(
  key: string | undefined,
  lang: Locale,
  /// Slug du formulaire, quand il est connu de l'appelant : permet à un
  /// document de surcharger une section qu'il PARTAGE avec un autre sans en
  /// changer le texte pour tout le monde (cf. `SURCHARGES`). Absent = strictement
  /// le comportement d'avant.
  formSlug?: string
): SectionHelp {
  if (key && formSlug) {
    const propre = SURCHARGES[formSlug]?.[key];
    if (propre) return propre[lang] ?? propre[DEFAULT_LOCALE] ?? FALLBACK[lang];
  }
  if (key && HELP[key]) {
    return HELP[key][lang] ?? HELP[key][DEFAULT_LOCALE] ?? FALLBACK[lang];
  }
  return FALLBACK[lang] ?? FALLBACK[DEFAULT_LOCALE];
}
