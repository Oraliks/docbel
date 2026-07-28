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

import type { Locale } from "./types";
import { sectionLabel } from "./section-labels";

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
    stepGroupOrder: ["identite", "aide-independant", "mandat", "activite", "final"],
    stepGroupTitleKey: {
      identite: "runnerGroupC1aIdentite",
      "aide-independant": "runnerGroupC1aAide",
      mandat: "runnerGroupC1aMandat",
      activite: "runnerGroupC1aActivite",
      final: "runnerGroupC1aFinal",
    },
    stepGroupDescriptionKey: {
      identite: "runnerGroupC1aIdentiteDesc",
      "aide-independant": "runnerGroupC1aAideDesc",
      mandat: "runnerGroupC1aMandatDesc",
      activite: "runnerGroupC1aActiviteDesc",
      final: "runnerGroupC1aFinalDesc",
    },
    // Parcours en arbre : les étapes suivantes dépendent des réponses
    // précédentes, la navigation libre n'aurait pas de sens.
    hideStepList: true,
  },
};

const AUCUNE: FormPresentation = {};

/// Présentation d'un slug. Objet vide si le formulaire n'est pas enregistré —
/// tous les repères ci-dessous ont un comportement de repli utilisable.
export function getFormPresentation(slug: string): FormPresentation {
  return PRESENTATION_BY_SLUG[slug] ?? AUCUNE;
}

/// Titre d'une macro-étape. À défaut de clé enregistrée, on retombe sur le
/// libellé de section correspondant : les identifiants de groupe reprennent
/// souvent une clé de section (`identite`, `famille`…), et un libellé
/// générique vaut mieux qu'un identifiant brut affiché à un citoyen.
export function stepGroupTitle(
  presentation: FormPresentation,
  groupId: string,
  locale: Locale,
  translate: (key: string) => string
): string {
  const key = presentation.stepGroupTitleKey?.[groupId];
  return key ? translate(key) : sectionLabel(groupId, locale);
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
