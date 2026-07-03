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
 * Phases de dégressivité du chômage complet (ONEM).
 *  - 1A : mois 1-3   (taux maximal sur plafond A)
 *  - 1B : mois 4-6   (légère dégressivité sur plafond A bis, réforme 2026)
 *  - 2A : mois 7-12  (plafond intermédiaire B)
 *  - 2B : mois 13-24 (plafond C, aligné sur B depuis la réforme 2026)
 *  - 2C : an 2 → an 3 (forfaitaire dégressif intermédiaire)
 *  - 3  : au-delà (forfaitaire minimum)
 */
export const CHOMAGE_PHASES = ["1A", "1B", "2A", "2B", "2C", "3"] as const;

export type ChomagePhase = (typeof CHOMAGE_PHASES)[number];
