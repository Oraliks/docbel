// Géométrie du peigne imprimé, PAR WIDGET.
//
// Certains widgets ne sont pas écrits par un champ du schéma mais par une règle
// serveur : les lignes de date du motif du C1 (« à partir du __ __ / __ __ /
// __ __ __ __ ») changent de destination selon les cases cochées, c'est la
// règle qui tranche. Le peigne déclaré sur un champ ne pouvait donc pas les
// atteindre.
//
// Le calage est déclaré ICI, sur le WIDGET, et non sur la règle : la géométrie
// du guide est une propriété du formulaire imprimé, pas de la logique qui
// décide d'y écrire. Deux règles visant le même widget doivent produire le même
// alignement, et une règle qui change de cible ne doit rien emporter avec elle.

import type { PdfFormField } from "../types";

/// Calage d'un widget + taille de police à utiliser pour le dessin.
export type CombWidgetSpec = NonNullable<PdfFormField["printAsComb"]> & {
  fontSize?: number;
};

/// Les quatre lignes « à partir du » du motif partagent le même guide imprimé,
/// donc le même calage. Validé à l'œil par Oraliks le 2026-07-27, sur un PDF
/// cochant adresse + situation de ménage + compte pour juger les trois lignes
/// ensemble. Mêmes valeurs que la date de naissance de la page 1 : sans
/// surprise, c'est le même guide imprimé.
const C1_DATE_MOTIF: CombWidgetSpec = {
  groups: [2, 2, 4],
  slotWidth: 11,
  groupExtra: 5,
  startX: 2,
  baselineY: 3,
  fontSize: 12,
};

const PAR_SLUG: Record<string, Record<string, CombWidgetSpec>> = {
  "c1-changement-situation": {
    DateAdresse: C1_DATE_MOTIF,
    DatePersonnelleOuMenage: C1_DATE_MOTIF,
    DateBanque: C1_DATE_MOTIF,
    DateDeTransfert: C1_DATE_MOTIF,
  },
};

/// Calages du formulaire. Slug inconnu → objet vide : aucun widget en peigne,
/// comportement strictement identique à avant.
export function getCombWidgetsForSlug(slug: string): Record<string, CombWidgetSpec> {
  return PAR_SLUG[slug] ?? {};
}
