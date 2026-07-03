/**
 * Paramètres réglementaires du chômage complet — jeux DATÉS et SOURCÉS.
 *
 * SOURCE DE VÉRITÉ UNIQUE des montants (plafonds salariaux, taux, forfaits).
 * Une réforme ou une indexation = un NOUVEAU jeu ajouté à CHOMAGE_PARAM_SETS
 * (l'ancien reste, borné par `validTo`) — jamais une constante écrasée.
 * Les consommateurs résolvent par date via `getChomageParams(date)`.
 *
 * Pourquoi en code et pas en DB : un calcul légal doit être typé, testé,
 * reviewé (diff git) et reproductible. La base barèmes importée de l'ONEM
 * (BaremeFile/BaremeAmount, admin 4 yeux) sert de source de VÉRIFICATION :
 * un test de parité confrontera ces valeurs au dernier barème publié
 * (cf. audit docs/audits/AUDIT_ARCHITECTURE_CHOMAGE_2026-07-04.md, lot 2).
 *
 * Module de domaine pur : aucune dépendance UI / Prisma / i18n.
 */

import type { ChomagePhase, SituationFamiliale } from "./categories";

/** Référence vers la source officielle d'un paramètre ou d'une règle. */
export interface SourceRef {
  /** Libellé humain, ex. "ONEM — barèmes au 01/03/2026". */
  label: string;
  /** URL officielle (page ONEM, Moniteur…). */
  url?: string;
  /** Identifiant d'article dans le corpus RioLex (/partenaire/reglementation). */
  riolexId?: string;
  /** Date (ISO) de dernière vérification humaine de la valeur. */
  verifiedAt: string;
}

/**
 * Jeu de valeurs valable sur une période. `validTo` absent = en vigueur.
 * Convention de bornes : validFrom INCLUS, validTo EXCLU.
 */
export interface VersionedParams<T> {
  /** Date d'entrée en vigueur (ISO "YYYY-MM-DD"), incluse. */
  validFrom: string;
  /** Date de fin (ISO), EXCLUE. Absent = toujours en vigueur. */
  validTo?: string;
  /** Libellé humain du jeu, ex. "Réforme chômage mars 2026". */
  label: string;
  source: SourceRef;
  values: T;
}

/** Phases proportionnelles : celles qui ont un plafond salarial propre. */
export type PhaseProportionnelle = Extract<ChomagePhase, "1A" | "1B" | "2A" | "2B">;

/** Montants réglementaires du chômage complet (€/mois sauf mention). */
export interface ChomageParams {
  /** Plafonds salariaux mensuels par phase proportionnelle. */
  plafonds: Record<PhaseProportionnelle, number>;
  /** Taux appliqués au salaire plafonné : 1A puis toutes les autres phases. */
  taux: { "1A": number; autres: number };
  /** Plancher mensuel par situation familiale (phases proportionnelles). */
  forfaitMin: Record<SituationFamiliale, number>;
  /** Plafond mensuel par situation familiale (phases proportionnelles). */
  forfaitMax: Record<SituationFamiliale, number>;
  /** Phase 2C — forfaitaire dégressif (an 2 → an 3), non re-borné. */
  forfait2C: Record<SituationFamiliale, number>;
  /** Phase 3 — forfaitaire minimal (au-delà d'an 3), non re-borné. */
  forfait3: Record<SituationFamiliale, number>;
}

/**
 * Jeux de paramètres, du plus récent au plus ancien.
 * ⚠️ Montants = ESTIMATIONS INDICATIVES documentées (voir SourceRef) ; le
 * chiffre exact relève de l'organisme de paiement. Repris À L'IDENTIQUE des
 * constantes historiques de lib/calculators/chomage.ts (extraction lot 1,
 * aucun montant modifié).
 */
export const CHOMAGE_PARAM_SETS: readonly VersionedParams<ChomageParams>[] = [
  {
    validFrom: "2026-03-01",
    label: "Réforme chômage mars 2026",
    source: {
      label:
        'ONEM — "À combien s\'élève votre allocation de chômage" (barèmes au 01/03/2026)',
      url: "https://www.onem.be/fr/documentation/baremes",
      verifiedAt: "2026-07-04",
    },
    values: {
      plafonds: {
        "1A": 4265.98, // mois 1-3 (plafond A)
        "1B": 4010.98, // mois 4-6 (plafond A bis, introduit par la réforme 2026)
        "2A": 3262.99, // mois 7-12 (plafond B)
        "2B": 3262.99, // mois 13+ (plafond C, aligné sur B après réforme 2026)
      },
      taux: { "1A": 0.65, autres: 0.6 },
      forfaitMin: { chef_menage: 1500, isole: 1260, cohabitant: 1015 },
      forfaitMax: { chef_menage: 2200, isole: 1850, cohabitant: 1500 },
      forfait2C: { chef_menage: 1700, isole: 1400, cohabitant: 800 },
      forfait3: { chef_menage: 1500, isole: 1260, cohabitant: 670 },
    },
  },
];

/** Date civile locale au format ISO "YYYY-MM-DD" (jour belge, pas UTC). */
function toIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Résout le jeu de paramètres en vigueur à une date donnée (défaut :
 * aujourd'hui). Bornes : validFrom inclus, validTo exclu.
 *
 * @throws Error explicite si aucun jeu ne couvre la date — on préfère
 * échouer bruyamment plutôt que calculer avec un barème du mauvais régime
 * (ex. simuler une situation d'avant la réforme 2026 avec les montants 2026).
 */
export function getChomageParams(
  date: Date = new Date(),
): VersionedParams<ChomageParams> {
  const iso = toIsoDay(date);
  const match = CHOMAGE_PARAM_SETS.find(
    (set) => set.validFrom <= iso && (!set.validTo || iso < set.validTo),
  );
  if (!match) {
    const known = CHOMAGE_PARAM_SETS.map(
      (s) => `${s.validFrom} → ${s.validTo ?? "en vigueur"}`,
    ).join(", ");
    throw new Error(
      `Aucun jeu de paramètres chômage ne couvre la date ${iso}. Périodes connues : ${known}.`,
    );
  }
  return match;
}
