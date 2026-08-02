// Présentation d'un formulaire dans le runner : ordre et libellés de ses
// macro-étapes, et choix de chrome qui ne se déduisent pas des données.
//
// Tout ceci vivait EN DUR pour le C1, éparpillé dans trois fichiers : l'ordre
// canonique dans `build-steps.ts`, les titres et descriptions dans le runner,
// et un `form.slug === "c1-changement-situation"` qui pilotait la navigation.
// Un second formulaire à macro-étapes aurait affiché ses identifiants bruts en
// guise de titres, dans un ordre arbitraire.
//
// Même idiome que `bindings/registry.ts` : une entrée par slug, et une absence
// d'entrée reste un comportement sûr — l'ordre retombe sur la première
// apparition des groupes, les titres sur les libellés de section.

import { loc, type Locale, type Localized } from "./types";
import { sectionLabel } from "./section-labels";
import { C1A_QUESTIONS, C1A_GROUPE_IDENTITE } from "./seed/c1a-routing";
import { C1C_QUESTIONS, C1C_GROUPE_IDENTITE } from "./seed/c1c-fields";
import { C47_QUESTIONS, C47_GROUPE_IDENTITE } from "./seed/c47-fields";
import {
  C1_PARTENAIRE_QUESTIONS,
  C1_PARTENAIRE_GROUPE_IDENTITE,
} from "./seed/c1-partenaire-fields";
import { C46_QUESTIONS, C46_GROUPE_IDENTITE } from "./seed/c46-fields";
import { C1B_QUESTIONS, C1B_GROUPE_IDENTITE } from "./seed/c1b-fields";
import { C1_REGIS_QUESTIONS, C1_REGIS_GROUPE_IDENTITE } from "./seed/c1-regis-fields";

export interface FormPresentation {
  /// Ordre canonique des macro-étapes. Les groupes absents de cette liste
  /// viennent après, dans leur ordre de première apparition parmi les champs.
  /// Nécessaire parce que l'ordre du PDF n'est pas celui du parcours voulu
  /// (l'identité est en tête sur le papier, pas à l'écran).
  stepGroupOrder?: readonly string[];
  /// Clé i18n du titre de chaque macro-étape (namespace `public.dossier`).
  stepGroupTitleKey?: Readonly<Record<string, string>>;
  /// Clé i18n de la phrase affichée sous le titre dans le stepper.
  stepGroupDescriptionKey?: Readonly<Record<string, string>>;
  /// Masque la liste d'étapes cliquable. Réservé aux parcours volontairement
  /// linéaires : par défaut la navigation reste disponible, c'est elle qui
  /// permet de relire ses réponses avant de signer.
  hideStepList?: boolean;
}

const PRESENTATION_BY_SLUG: Readonly<Record<string, FormPresentation>> = {
  "c1-changement-situation": {
    stepGroupOrder: ["motif", "identite", "activites-revenus", "famille", "final"],
    stepGroupTitleKey: {
      motif: "runnerGroupMotif",
      identite: "runnerGroupIdentite",
      "activites-revenus": "runnerGroupActivitesRevenus",
      famille: "runnerGroupFamille",
      final: "runnerGroupFinal",
    },
    stepGroupDescriptionKey: {
      motif: "runnerGroupMotifDesc",
      identite: "runnerGroupIdentiteDesc",
      "activites-revenus": "runnerGroupActivitesRevenusDesc",
      famille: "runnerGroupFamilleDesc",
      final: "runnerGroupFinalDesc",
    },
    hideStepList: true,
  },
  c1a: {
    // UNE QUESTION = UNE ÉTAPE. L'ordre est celui du document, lu directement
    // dans l'arbre de renvois (`C1A_QUESTIONS`) : pas de seconde liste à tenir
    // à jour, donc pas de liste qui se désynchronise.
    //
    // Les questions sautées par l'arbre n'ont aucun champ visible et ne
    // produisent donc aucune étape (cf. `buildMacroSteps`) : le parcours le
    // plus court se replie tout seul.
    //
    // L'ÉTAPE D'IDENTITÉ N'EST PLUS UNE ÉTAPE DU PARCOURS (Oraliks 2026-07-29).
    // Dans un dossier, le C1 a déjà donné nom, NISS et adresse : les six champs
    // portent `inheritedFromDossier` et deviennent `autoAnswered` à
    // l'ouverture, si bien que `buildMacroSteps` ne voit plus aucun champ
    // visible dans ce groupe et n'en fabrique aucune étape. Elle ne réapparaît
    // que sur l'URL publique du C1A, où il n'y a aucun C1 dont hériter — d'où
    // le groupe MAINTENU en tête de l'ordre : il ne coûte rien quand l'étape
    // n'existe pas, et l'empêche de tomber en fin de parcours, après la
    // signature, quand elle existe.
    stepGroupOrder: [C1A_GROUPE_IDENTITE, ...C1A_QUESTIONS],
    // Aucune clé i18n. Une clé par question ne serait pas tenable — et serait
    // de toute façon un doublon du libellé imprimé : à défaut de clé, l'étape
    // prend pour titre la question elle-même (cf. `stepGroupTitle`).
    // L'identité, elle, avait la sienne ; « Vos coordonnées, déjà reprises de
    // votre C1 » est devenu faux exactement dans le seul cas où l'étape
    // s'affiche encore — hors dossier, sans C1. Elle retombe donc sur le
    // libellé de section, déjà traduit en trois langues.
    // Parcours en arbre : les étapes suivantes dépendent des réponses
    // précédentes, la navigation libre n'aurait pas de sens.
    hideStepList: true,
  },
  c1c: {
    // MÊME GRAMMAIRE QUE LE C1A, et pour les mêmes raisons — une question par
    // étape, aucune clé i18n, pas de liste d'étapes. Ce qui change : le C1C
    // n'a pas d'arbre de renvois imprimé, sa liste de questions est donc
    // écrite à la main dans le seed (`C1C_QUESTIONS`) plutôt que dérivée d'une
    // `TableRoutage`. Côté écran, rien ne distingue les deux parcours.
    //
    // Le groupe d'identité reste EN TÊTE alors qu'il ne produit aucune étape
    // dans un dossier (nom et NISS viennent du C1, cf. `inheritedFromDossier`
    // sur ces deux champs) : il ne coûte rien quand l'étape n'existe pas, et
    // l'empêche de tomber après la signature sur l'URL publique du C1C, où il
    // n'y a aucun C1 dont hériter et où l'étape réapparaît donc.
    stepGroupOrder: [C1C_GROUPE_IDENTITE, ...C1C_QUESTIONS],
    // Aucune clé i18n : à défaut, l'étape prend pour titre la question de son
    // champ ancre — un texte déjà écrit mot pour mot sur le formulaire
    // officiel, qu'un catalogue de traductions ne ferait que recopier.
    hideStepList: true,
  },
  c47: {
    // MÊME GRAMMAIRE QUE LE C1A ET LE C1C. Le C47 tient en une page et n'a
    // qu'une question — le parcours se réduit donc, dans un dossier, à « que
    // demandez-vous ? » puis « signez ». L'en-tête d'identité reste EN TÊTE de
    // l'ordre bien qu'il ne produise aucune étape quand le C1 l'a déjà donnée
    // (cf. `inheritedFromDossier`) : il ne coûte rien quand l'étape n'existe
    // pas, et l'empêche de tomber après la signature sur l'URL publique
    // `/document/onem/c47`, où il n'y a aucun C1 dont hériter.
    stepGroupOrder: [C47_GROUPE_IDENTITE, ...C47_QUESTIONS],
    hideStepList: true,
  },
  "c1-partenaire": {
    // MÊME GRAMMAIRE. Le papier pose six questions oui/non à la suite : six
    // étapes, dont deux ouvrent des précisions « si oui ». L'en-tête d'identité
    // reste en tête de l'ordre — il ne disparaît pas dans un dossier (l'identité
    // du PARTENAIRE, elle, ne s'hérite de rien : c'est un tiers), mais il ne
    // doit pas non plus tomber après la signature.
    stepGroupOrder: [C1_PARTENAIRE_GROUPE_IDENTITE, ...C1_PARTENAIRE_QUESTIONS],
    hideStepList: true,
  },
  c46: {
    // MÊME GRAMMAIRE. Un mandat par étape : les deux mandats supplémentaires
    // n'apparaissent qu'une fois le précédent renseigné, donc le parcours le
    // plus court (un seul mandat) tient en deux écrans.
    stepGroupOrder: [C46_GROUPE_IDENTITE, ...C46_QUESTIONS],
    hideStepList: true,
  },
  c1b: {
    // MÊME GRAMMAIRE, sur le plus long des compagnons : quinze questions
    // imprimées, dont la plupart ne s'affichent que sur leur branche. Le
    // parcours le plus court (« non » partout) tient en huit écrans.
    stepGroupOrder: [C1B_GROUPE_IDENTITE, ...C1B_QUESTIONS],
    hideStepList: true,
  },
  "c1-regis": {
    // MÊME GRAMMAIRE, sur le dernier document à l'avoir rejointe (lot S14). Le
    // papier est un tableau de sept lignes ; chaque ligne pose la même question
    // — « y a-t-il une différence avec les registres ? » — et n'ouvre ses trois
    // précisions que si la réponse est « oui ». Le parcours le plus court
    // (« non » sept fois) tient donc en huit écrans au lieu d'une grille de
    // vingt-huit champs d'un seul tenant.
    stepGroupOrder: [C1_REGIS_GROUPE_IDENTITE, ...C1_REGIS_QUESTIONS],
    hideStepList: true,
  },
};

const AUCUNE: FormPresentation = {};

/// Présentation d'un slug. Objet vide si le formulaire n'est pas enregistré —
/// tous les repères ci-dessous ont un comportement de repli utilisable.
export function getFormPresentation(slug: string): FormPresentation {
  return PRESENTATION_BY_SLUG[slug] ?? AUCUNE;
}

/// Titre d'une macro-étape, par ordre de préférence :
///
///   1. la clé i18n enregistrée pour ce groupe ;
///   2. le libellé du champ ANCRE — celui dont l'identifiant EST celui du
///      groupe. Un parcours d'une question par étape n'a pas de clé i18n par
///      question : ce serait recopier en catalogue un texte déjà écrit, mot
///      pour mot, sur le formulaire officiel. C'est donc la question qui titre
///      son étape ;
///   3. le libellé de section : les identifiants de groupe reprennent souvent
///      une clé de section (`identite`, `famille`…), et un libellé générique
///      vaut mieux qu'un identifiant brut affiché à un citoyen.
export function stepGroupTitle(
  presentation: FormPresentation,
  groupId: string,
  locale: Locale,
  translate: (key: string) => string,
  /// Libellé du champ ancre de l'étape, si elle en a un (cf. `stepAnchorField`).
  anchorLabel?: string
): string {
  const key = presentation.stepGroupTitleKey?.[groupId];
  if (key) return translate(key);
  if (anchorLabel) return anchorLabel;
  return sectionLabel(groupId, locale);
}

/// Le champ ANCRE d'une macro-étape : celui dont l'identifiant est celui du
/// groupe. Il n'existe que sur les formulaires où une étape EST une question
/// (le groupe porte alors l'identifiant du champ qui pose la question).
export function stepAnchorField<T extends { id: string }>(
  groupId: string,
  fields: readonly T[]
): T | undefined {
  return fields.find((f) => f.id === groupId);
}

/// Libellé affiché d'un champ ANCRE (cf. `stepAnchorField`) : préfère la
/// version COURTE quand le champ en porte une — les questions imprimées du
/// PDF sont parfois interminables, et deviennent le titre du bandeau compact
/// du stepper (une question par étape, cf. PDF_FORMS_RULES). Repli sur le
/// libellé complet si `labelShort` est absent ou vide pour la locale
/// courante ; `undefined` si le champ lui-même est absent (pas d'ancre) —
/// même contrat que l'appel direct à `loc(anchor.label, locale)` qu'elle
/// remplace chez l'appelant.
export function stepAnchorLabel(
  field: { label: Localized; labelShort?: Localized } | undefined,
  locale: Locale
): string | undefined {
  if (!field) return undefined;
  return loc(field.labelShort, locale) || loc(field.label, locale) || undefined;
}

/// Vrai si le titre de l'étape est le libellé de son champ ancre — auquel cas
/// ce libellé ne doit pas être affiché DEUX FOIS, en titre puis au-dessus du
/// contrôle. On ne le masque que si l'ancre est SEULE sur l'étape : au milieu
/// de champs voisins, il distingue une ligne des autres et le retirer
/// laisserait une case sans nom à l'écran.
///
/// L'ABSENCE D'ANCRE compte autant que sa présence : sans champ ancre le titre
/// vient du libellé de section (3ᵉ repli de `stepGroupTitle`) et ne redit donc
/// rien du champ. C'est le cas de l'étape d'identité du C1A depuis qu'elle n'a
/// plus de clé i18n — la déduire de la seule absence de clé masquerait le
/// libellé du dernier champ manquant, laissant une case anonyme à l'écran.
export function stepTitleReplacesFieldLabel(
  presentation: FormPresentation,
  groupId: string,
  /// Champs VISIBLES de l'étape (l'ancre y est cherchée, cf. `stepAnchorField`).
  fields: readonly { id: string }[]
): boolean {
  if (fields.length !== 1) return false;
  if (presentation.stepGroupTitleKey?.[groupId]) return false;
  return stepAnchorField(groupId, fields) !== undefined;
}

/// Description d'une macro-étape. Absente par défaut : le stepper l'omet.
export function stepGroupDescription(
  presentation: FormPresentation,
  groupId: string,
  translate: (key: string) => string
): string | undefined {
  const key = presentation.stepGroupDescriptionKey?.[groupId];
  return key ? translate(key) : undefined;
}
