/**
 * Catégories canoniques du domaine chômage (ONEM Belgique).
 *
 * SOURCE DE VÉRITÉ UNIQUE de ces types pour tout le repo : calculateurs,
 * simulateurs, dossiers, explications et (à terme) règles d'éligibilité
 * importent d'ici. Ne PAS redéclarer ces unions ailleurs — les réexporter.
 *
 * Ce module est du domaine pur : aucune dépendance UI / Prisma / i18n.
 * Les libellés humains restent chez les consommateurs (i18n côté front).
 */

/** Situations familiales au sens ONEM (catégories d'allocataires). */
export const SITUATIONS_FAMILIALES = [
  "chef_menage",
  "isole",
  "cohabitant",
] as const;

export type SituationFamiliale = (typeof SITUATIONS_FAMILIALES)[number];

/**
 * Phases d'indemnisation du chômage complet (ONEM, régime à partir du 01/03/2026).
 *
 * Structure sourcée (`chomage_complet_degressivite_structure`, AR 25/11/1991
 * art. 114 & 116) : 1ʳᵉ période de 12 mois dégressive proportionnelle, puis
 * 2ᵉ période de max 12 mois FORFAITAIRE selon la catégorie familiale (et non
 * plus fonction du dernier salaire). Total limité à 24 mois.
 *  - 1A : mois 1-3   (65 % du salaire plafonné, plafond A)
 *  - 1B : mois 4-6   (60 %, plafond A bis)
 *  - 2A : mois 7-12  (60 %, plafond B)
 *  - 2B : mois 13-24 (2ᵉ période — forfait familial, montant à vérifier)
 *
 * Au-delà de 24 mois : fin de droit (limitation réforme 2026), ce n'est pas une
 * phase de calcul. Les anciennes phases 2C/3 (3ᵉ période pré-réforme) sont retirées.
 */
export const CHOMAGE_PHASES = ["1A", "1B", "2A", "2B"] as const;

export type ChomagePhase = (typeof CHOMAGE_PHASES)[number];
