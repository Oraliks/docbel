/**
 * Échéances sociales & fiscales récurrentes belges — moteur PUR de calcul de dates.
 *
 * Ce module ne fait AUCUNE I/O : pas de fetch, pas de Prisma, pas de `server-only`.
 * Il calcule, à partir d'une date de référence, les prochaines échéances récurrentes
 * d'un employeur belge (cotisations ONSS, précompte professionnel, TVA) en utilisant
 * uniquement l'objet `Date` standard de JavaScript.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  DATES INDICATIVES — à confirmer selon le régime réel de l'employeur.
 * ─────────────────────────────────────────────────────────────────────────────
 * Les règles ci-dessous dépendent du régime de déclaration (mensuel vs trimestriel),
 * lui-même fonction de la taille / du chiffre d'affaires de l'entreprise. Par défaut,
 * ce moteur retient le **régime TRIMESTRIEL** (cas le plus courant pour une PME) et
 * le signale dans le champ `note`. Les tolérances administratives (report au 1er jour
 * ouvrable, régime estival / « vacances TVA », tolérance de paiement) ne sont PAS
 * modélisées : seule la date limite légale générale est calculée.
 *
 * RÈGLES RETENUES (échéances 2026, vérifiées en juin 2026) :
 *
 *  1. ONSS — Déclaration trimestrielle DmfA
 *     → Dernier jour du mois qui suit le trimestre.
 *       T1 → 30/04, T2 → 31/07, T3 → 31/10, T4 → 31/01 (année suivante).
 *     Source : ONSS / socialsecurity.be (DmfA).
 *
 *  2. Précompte professionnel — régime trimestriel (par défaut)
 *     → Le 15 du mois qui suit le trimestre.
 *       T1 → 15/04, T2 → 15/07, T3 → 15/10, T4 → 15/01 (année suivante).
 *     (Régime mensuel = le 15 du mois qui suit le mois concerné — non modélisé ici.)
 *     Seuil régime trimestriel 2026 : ≤ 51 480 € de précompte annuel.
 *     Source : SPF Finances — calendrier du précompte professionnel.
 *
 *  3. TVA — déclaration + paiement, régime trimestriel (par défaut)
 *     → Le 25 du mois qui suit le trimestre.
 *       Depuis la « nouvelle chaîne TVA » (entrée en vigueur 2025), l'échéance des
 *       déclarants TRIMESTRIELS est passée du 20 au **25** du mois suivant.
 *       Les déclarants MENSUELS restent au 20 du mois suivant (non modélisé ici).
 *       Le régime estival / « vacances TVA » (tolérances) n'est pas modélisé.
 *     Source : SPF Finances — déclaration périodique TVA / nouvelle chaîne TVA.
 *
 * SOURCES OFFICIELLES & DE RÉFÉRENCE CONSULTÉES :
 *  - ONSS / Sécurité sociale (DmfA) :
 *      https://www.socialsecurity.be/site_fr/employer/applics/dmfa/index.htm
 *  - SPF Finances — déclaration périodique TVA :
 *      https://finances.belgium.be/fr/entreprises/tva/declaration/declaration-periodique
 *  - SPF Finances — calendrier du précompte professionnel :
 *      https://finances.belgium.be/fr/experts_partenaires/secretariats-sociaux-autres-societes-service/precompte_professionnel/calendrier
 *  - Nouvelle chaîne TVA (échéance trimestrielle 20 → 25), RSM Belgium :
 *      https://www.rsm.global/belgium/fr/insights/changements-en-matiere-de-tva-belge-partir-du-1er-janvier-2025-la-chaine-tva
 *
 * Aucune autre échéance (pécule de vacances, bilan social, fiches 281.xx, etc.) n'est
 * incluse faute de règle datée suffisamment fiable au moment de la rédaction.
 */

export type SocialDeadlineCategory = "ONSS" | "Précompte" | "TVA" | "Autre";

export interface SocialDeadline {
  /** Identifiant stable et unique, ex. "onss-dmfa-2026T2". */
  id: string;
  /** Date d'échéance calculée, au format ISO "YYYY-MM-DD". */
  date: string;
  /** Libellé lisible, ex. "Déclaration ONSS – DMFA · T2 2026". */
  title: string;
  category: SocialDeadlineCategory;
  periodicity: "mensuelle" | "trimestrielle" | "annuelle";
  /** Note de contexte (hypothèse de régime, tolérances, etc.). */
  note?: string;
  /** Libellé de la source officielle, ex. "ONSS". */
  sourceLabel?: string;
  /** URL officielle vérifiée. */
  sourceUrl?: string;
}

/** Trimestre civil belge : T1=jan-mar, T2=avr-juin, T3=juil-sep, T4=oct-déc. */
type Quarter = 1 | 2 | 3 | 4;

const SOURCE_ONSS_DMFA =
  "https://www.socialsecurity.be/site_fr/employer/applics/dmfa/index.htm";
const SOURCE_PRECOMPTE =
  "https://finances.belgium.be/fr/experts_partenaires/secretariats-sociaux-autres-societes-service/precompte_professionnel/calendrier";
const SOURCE_TVA =
  "https://finances.belgium.be/fr/entreprises/tva/declaration/declaration-periodique";

/**
 * Construit une date locale « au jour près » (heure fixée à midi pour éviter tout
 * basculement de jour lié au fuseau horaire lors de la sérialisation ISO).
 */
function makeDay(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

/** Dernier jour du mois `monthIndex` (0-11) de l'année `year`. */
function lastDayOfMonth(year: number, monthIndex: number): number {
  // Le jour 0 du mois suivant = dernier jour du mois courant.
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Formate une `Date` en "YYYY-MM-DD" (composantes locales). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Normalise une date à minuit local pour comparer au jour près. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Mois (index 0-11) et année du « mois qui suit le trimestre » `q` de l'année `year`.
 * T1 → avril (year), T2 → juillet (year), T3 → octobre (year),
 * T4 → janvier (year + 1).
 */
function monthAfterQuarter(
  year: number,
  q: Quarter,
): { year: number; monthIndex: number } {
  switch (q) {
    case 1:
      return { year, monthIndex: 3 }; // avril
    case 2:
      return { year, monthIndex: 6 }; // juillet
    case 3:
      return { year, monthIndex: 9 }; // octobre
    case 4:
      return { year: year + 1, monthIndex: 0 }; // janvier (année suivante)
  }
}

const QUARTERS: readonly Quarter[] = [1, 2, 3, 4];

/**
 * Génère toutes les échéances trimestrielles pour une année civile de trimestres
 * `year` donnée (les 4 trimestres T1..T4 de cette année). Les dates calculées
 * peuvent retomber sur `year + 1` (cas du T4).
 */
function buildQuarterlyDeadlinesForYear(year: number): SocialDeadline[] {
  const out: SocialDeadline[] = [];

  for (const q of QUARTERS) {
    const { year: dueYear, monthIndex } = monthAfterQuarter(year, q);

    // 1) ONSS — DmfA : dernier jour du mois qui suit le trimestre.
    const onssDay = lastDayOfMonth(dueYear, monthIndex);
    out.push({
      id: `onss-dmfa-${year}T${q}`,
      date: toISODate(makeDay(dueYear, monthIndex, onssDay)),
      title: `Déclaration ONSS – DMFA · T${q} ${year}`,
      category: "ONSS",
      periodicity: "trimestrielle",
      note: "Régime trimestriel (par défaut). Échéance = dernier jour du mois qui suit le trimestre. Date indicative, à confirmer selon votre régime.",
      sourceLabel: "ONSS",
      sourceUrl: SOURCE_ONSS_DMFA,
    });

    // 2) Précompte professionnel : le 15 du mois qui suit le trimestre.
    out.push({
      id: `precompte-${year}T${q}`,
      date: toISODate(makeDay(dueYear, monthIndex, 15)),
      title: `Versement précompte professionnel · T${q} ${year}`,
      category: "Précompte",
      periodicity: "trimestrielle",
      note: "Régime trimestriel (par défaut, précompte annuel ≤ 51 480 € pour 2026). Échéance = le 15 du mois qui suit le trimestre. Le régime mensuel est dû le 15 du mois suivant.",
      sourceLabel: "SPF Finances",
      sourceUrl: SOURCE_PRECOMPTE,
    });

    // 3) TVA : le 25 du mois qui suit le trimestre (nouvelle chaîne TVA).
    out.push({
      id: `tva-${year}T${q}`,
      date: toISODate(makeDay(dueYear, monthIndex, 25)),
      title: `Déclaration & paiement TVA · T${q} ${year}`,
      category: "TVA",
      periodicity: "trimestrielle",
      note: "Régime trimestriel (par défaut). Depuis la nouvelle chaîne TVA (2025), l'échéance trimestrielle est le 25 du mois qui suit le trimestre (les déclarants mensuels restent au 20). Tolérances/régime estival non pris en compte.",
      sourceLabel: "SPF Finances",
      sourceUrl: SOURCE_TVA,
    });
  }

  return out;
}

/**
 * Renvoie les `limit` prochaines échéances (date >= from), triées par date
 * croissante. `from` est la date de référence (ex. aujourd'hui).
 *
 * La comparaison se fait au jour près (l'heure de `from` est ignorée). Les
 * occurrences sont générées sur un horizon glissant d'environ 12 mois afin de
 * couvrir suffisamment d'échéances après `from`.
 */
export function getUpcomingSocialDeadlines(
  from: Date,
  limit = 6,
): SocialDeadline[] {
  if (limit <= 0) {
    return [];
  }

  const fromYear = from.getFullYear();

  // On génère les trimestres de l'année précédente, courante et suivante :
  // cela garantit une couverture > 12 mois autour de `from`, quel que soit le
  // mois de référence (les échéances du T4 retombent sur l'année suivante).
  const candidates: SocialDeadline[] = [
    ...buildQuarterlyDeadlinesForYear(fromYear - 1),
    ...buildQuarterlyDeadlinesForYear(fromYear),
    ...buildQuarterlyDeadlinesForYear(fromYear + 1),
  ];

  const fromDay = startOfDay(from);

  return candidates
    .filter((d) => startOfDay(new Date(`${d.date}T12:00:00`)) >= fromDay)
    .sort((a, b) => {
      // Tri par date croissante, puis par id pour un ordre stable et déterministe
      // lorsque plusieurs échéances tombent le même jour.
      if (a.date !== b.date) {
        return a.date < b.date ? -1 : 1;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, limit);
}
