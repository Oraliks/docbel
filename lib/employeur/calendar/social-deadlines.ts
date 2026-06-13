/**
 * Échéances sociales & fiscales récurrentes belges — moteur PUR de calcul de dates.
 *
 * Ce module ne fait AUCUNE I/O : pas de fetch, pas de Prisma, pas de `server-only`.
 * Il calcule, à partir d'une date de référence, les prochaines échéances récurrentes
 * d'un employeur belge (cotisations ONSS, précompte professionnel, TVA) en utilisant
 * uniquement l'objet `Date` standard de JavaScript.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  DATES INDICATIVES — régime TRIMESTRIEL par défaut, à confirmer.
 * ─────────────────────────────────────────────────────────────────────────────
 * Les 3 obligations actives en MVP sont toutes modélisées en régime TRIMESTRIEL
 * (cas le plus courant pour une PME). Les régimes mensuels, les tolérances
 * administratives et les autres obligations (relevé intracommunautaire, paiement
 * TVA séparé, fiches 281.xx, pécule de vacances, assurance accidents du travail…)
 * sont prévus dans l'énumération interne mais NON émis en MVP. Voir
 * {@link SOCIAL_CALENDAR_WARNING} pour l'avertissement utilisateur exact.
 *
 * RÈGLES VALIDÉES (expert métier, juin 2026) :
 *
 *  1. ONSS — Déclaration trimestrielle DmfA  (category "ONSS")
 *     → Dernier jour du mois qui suit le trimestre.
 *       T1 → 30/04, T2 → 31/07, T3 → 31/10, T4 → 31/01 (année suivante).
 *     Source : ONSS
 *       https://www.socialsecurity.be/site_fr/employer/applics/dmfa/web/intro/home.htm
 *
 *  2. Précompte professionnel — régime trimestriel par défaut  (category "Précompte")
 *     → Le 15 du mois qui suit le trimestre.
 *       T1 → 15/04, T2 → 15/07, T3 → 15/10, T4 → 15/01 (année suivante).
 *       (Le régime mensuel n'est pas émis en MVP.)
 *     Source : SPF Finances
 *       https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calendrier
 *
 *  3. TVA — déclaration périodique trimestrielle  (category "TVA")
 *     → Date issue de la TABLE OFFICIELLE SPF (les reports week-end/jour férié y
 *       sont déjà intégrés ; on NE calcule PAS « toujours le 25 »).
 *
 *       TABLE OFFICIELLE TVA (par année & trimestre du trimestre concerné) :
 *         ┌───────────┬──────────────┬────────────────────────────────────────┐
 *         │ Trimestre │ Échéance     │ Remarque                               │
 *         ├───────────┼──────────────┼────────────────────────────────────────┤
 *         │ T4 2025   │ 2026-01-26   │                                        │
 *         │ T1 2026   │ 2026-04-27   │ 25/04/2026 = samedi → reporté au 27    │
 *         │ T2 2026   │ 2026-07-25   │                                        │
 *         │ T3 2026   │ 2026-10-25   │                                        │
 *         │ T4 2026   │ 2027-01-25   │                                        │
 *         └───────────┴──────────────┴────────────────────────────────────────┘
 *
 *       Pour un (année, trimestre) ABSENT de la table → fallback = le 25 du mois
 *       qui suit le trimestre, avec une `note` signalant que la date est calculée
 *       et que le report officiel n'est pas garanti (à confirmer sur le calendrier
 *       SPF). Le relevé intracommunautaire, le paiement TVA séparé et le régime
 *       mensuel ne sont PAS inclus en MVP.
 *     Source : SPF Finances
 *       https://finances.belgium.be/fr/entreprises/tva/calendrier-tva
 *
 * Toutes les dates émises sont INDICATIVES et calculées selon un régime trimestriel
 * par défaut. Conserver la prudence : seules les sources officielles SPF Finances et
 * Sécurité sociale font foi.
 */

export type SocialDeadlineCategory = "ONSS" | "Précompte" | "TVA" | "Autre";

export interface SocialDeadline {
  /** Identifiant stable et unique, ex. "onss-dmfa-2026T2". */
  id: string;
  /** Date d'échéance, au format ISO "YYYY-MM-DD". */
  date: string;
  /** Libellé lisible, ex. "Déclaration ONSS – DmfA · T2 2026". */
  title: string;
  category: SocialDeadlineCategory;
  periodicity: "mensuelle" | "trimestrielle" | "annuelle";
  /** Note de contexte (hypothèse de régime, fallback, tolérances, etc.). */
  note?: string;
  /** Libellé de la source officielle, ex. "ONSS". */
  sourceLabel?: string;
  /** URL officielle. */
  sourceUrl?: string;
}

/**
 * Avertissement utilisateur — texte EXACT validé par le métier.
 * À afficher partout où les échéances sont présentées.
 */
export const SOCIAL_CALENDAR_WARNING =
  "Dates indicatives calculées selon un régime trimestriel par défaut. Les échéances peuvent varier selon votre régime TVA, votre situation employeur, les reports au jour ouvrable suivant, les jours fériés, les tolérances administratives ou les communications officielles. Vérifiez toujours les sources officielles SPF Finances et Sécurité sociale.";

/* ──────────────────────────────────────────────────────────────────────────
 * Structure interne extensible (recommandée par le métier).
 * Les obligations sont décrites comme des DONNÉES typées, puis `SocialDeadline[]`
 * en est dérivé. L'énumération couvre l'extension future ; seules 3 obligations
 * sont ACTIVES en MVP (toutes `regime: "quarterly"`).
 * ────────────────────────────────────────────────────────────────────────── */

/** Trimestre civil belge : T1=jan-mar, T2=avr-juin, T3=juil-sep, T4=oct-déc. */
type Quarter = 1 | 2 | 3 | 4;

type DueDateRule =
  | { type: "last_day_of_month_after_quarter" }
  | { type: "fixed_day_after_quarter"; day: number }
  | { type: "official_calendar_table" }
  | { type: "custom" };

type SocialCalendarObligation = {
  obligationType:
    | "ONSS_DMFA"
    | "PROFESSIONAL_WITHHOLDING_TAX"
    | "VAT_PERIODIC_RETURN"
    | "VAT_PAYMENT"
    | "VAT_INTRA_COMMUNITY_STATEMENT"
    | "FISCAL_FORMS_281"
    | "HOLIDAY_PAY"
    | "WORK_ACCIDENT_INSURANCE";
  regime: "monthly" | "quarterly" | "yearly" | "custom";
  category: SocialDeadlineCategory;
  label: string;
  sourceLabel: string;
  sourceUrl: string;
  dueDateRule: DueDateRule;
  note?: string;
};

/** Préfixe d'`id` stable par type d'obligation (pour la dérivation + tri). */
const OBLIGATION_ID_PREFIX: Record<
  SocialCalendarObligation["obligationType"],
  string
> = {
  ONSS_DMFA: "onss-dmfa",
  PROFESSIONAL_WITHHOLDING_TAX: "precompte",
  VAT_PERIODIC_RETURN: "tva",
  VAT_PAYMENT: "tva-paiement",
  VAT_INTRA_COMMUNITY_STATEMENT: "tva-icp",
  FISCAL_FORMS_281: "fiches-281",
  HOLIDAY_PAY: "pecule-vacances",
  WORK_ACCIDENT_INSURANCE: "accidents-travail",
};

/**
 * Obligations ACTIVES en MVP — uniquement les 3 trimestrielles validées.
 * (L'énumération `obligationType` ci-dessus prévoit l'extension future, mais on
 * n'émet QUE ces trois entrées.)
 */
const ACTIVE_OBLIGATIONS: readonly SocialCalendarObligation[] = [
  {
    obligationType: "ONSS_DMFA",
    regime: "quarterly",
    category: "ONSS",
    label: "Déclaration ONSS – DmfA",
    sourceLabel: "ONSS",
    sourceUrl:
      "https://www.socialsecurity.be/site_fr/employer/applics/dmfa/web/intro/home.htm",
    dueDateRule: { type: "last_day_of_month_after_quarter" },
    note: "Régime trimestriel (par défaut). Échéance = dernier jour du mois qui suit le trimestre.",
  },
  {
    obligationType: "PROFESSIONAL_WITHHOLDING_TAX",
    regime: "quarterly",
    category: "Précompte",
    label: "Versement précompte professionnel",
    sourceLabel: "SPF Finances",
    sourceUrl:
      "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calendrier",
    dueDateRule: { type: "fixed_day_after_quarter", day: 15 },
    note: "Régime trimestriel par défaut (le régime mensuel n'est pas modélisé en MVP). Échéance = le 15 du mois qui suit le trimestre.",
  },
  {
    obligationType: "VAT_PERIODIC_RETURN",
    regime: "quarterly",
    category: "TVA",
    label: "Déclaration TVA (trimestrielle)",
    sourceLabel: "SPF Finances",
    sourceUrl: "https://finances.belgium.be/fr/entreprises/tva/calendrier-tva",
    dueDateRule: { type: "official_calendar_table" },
    note: "Régime trimestriel (par défaut). Date issue du calendrier officiel SPF (reports week-end/jour férié déjà intégrés).",
  },
];

/**
 * Table officielle SPF des échéances TVA trimestrielles, indexée par
 * "<année du trimestre>T<numéro de trimestre>". Les reports au jour ouvrable
 * (week-end / jour férié) sont DÉJÀ intégrés dans ces dates.
 */
const VAT_OFFICIAL_CALENDAR: Readonly<Record<string, string>> = {
  "2025T4": "2026-01-26",
  "2026T1": "2026-04-27", // 25/04/2026 = samedi → reporté au 27
  "2026T2": "2026-07-25",
  "2026T3": "2026-10-25",
  "2026T4": "2027-01-25",
};

/* ──────────────────────────────────────────────────────────────────────────
 * Utilitaires Date (calcul local « au jour près », sans glissement ISO).
 * ────────────────────────────────────────────────────────────────────────── */

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
 * Mois (index 0-11) et année du « mois qui suit le trimestre » `q` de l'année
 * `year`. T1 → avril (year), T2 → juillet (year), T3 → octobre (year),
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

/* ──────────────────────────────────────────────────────────────────────────
 * Dérivation des `SocialDeadline` à partir des obligations + règles de date.
 * ────────────────────────────────────────────────────────────────────────── */

type ResolvedDue = { date: string; extraNote?: string };

/**
 * Résout la date d'échéance (et une éventuelle note additionnelle) pour une
 * obligation, un trimestre `q` et l'année de trimestre `year`.
 */
function resolveDueDate(
  obligation: SocialCalendarObligation,
  year: number,
  q: Quarter,
): ResolvedDue {
  const { year: dueYear, monthIndex } = monthAfterQuarter(year, q);
  const rule = obligation.dueDateRule;

  switch (rule.type) {
    case "last_day_of_month_after_quarter": {
      const day = lastDayOfMonth(dueYear, monthIndex);
      return { date: toISODate(makeDay(dueYear, monthIndex, day)) };
    }
    case "fixed_day_after_quarter": {
      return { date: toISODate(makeDay(dueYear, monthIndex, rule.day)) };
    }
    case "official_calendar_table": {
      const key = `${year}T${q}`;
      const official = VAT_OFFICIAL_CALENDAR[key];
      if (official) {
        return { date: official };
      }
      // Fallback hors table : le 25 du mois qui suit le trimestre, signalé.
      return {
        date: toISODate(makeDay(dueYear, monthIndex, 25)),
        extraNote:
          "Date calculée (le 25 du mois suivant le trimestre) car ce trimestre est absent du calendrier officiel SPF : le report éventuel au jour ouvrable suivant n'est pas garanti, à confirmer sur le calendrier TVA du SPF Finances.",
      };
    }
    case "custom": {
      // Aucune obligation MVP n'utilise ce cas ; fallback prudent.
      const day = lastDayOfMonth(dueYear, monthIndex);
      return { date: toISODate(makeDay(dueYear, monthIndex, day)) };
    }
  }
}

/**
 * Génère toutes les échéances (3 obligations actives × 4 trimestres) pour une
 * année civile de trimestres `year`. Les dates calculées peuvent retomber sur
 * `year + 1` (cas du T4).
 */
function buildDeadlinesForYear(year: number): SocialDeadline[] {
  const out: SocialDeadline[] = [];

  for (const obligation of ACTIVE_OBLIGATIONS) {
    const prefix = OBLIGATION_ID_PREFIX[obligation.obligationType];

    for (const q of QUARTERS) {
      const { date, extraNote } = resolveDueDate(obligation, year, q);
      const note =
        extraNote && obligation.note
          ? `${obligation.note} ${extraNote}`
          : (extraNote ?? obligation.note);

      out.push({
        id: `${prefix}-${year}T${q}`,
        date,
        title: `${obligation.label} · T${q} ${year}`,
        category: obligation.category,
        periodicity: "trimestrielle",
        note,
        sourceLabel: obligation.sourceLabel,
        sourceUrl: obligation.sourceUrl,
      });
    }
  }

  return out;
}

/**
 * Renvoie les `limit` prochaines échéances (date >= from), triées par date
 * croissante puis par `id` (stabilité). `from` est la date de référence.
 *
 * La comparaison se fait au jour près (l'heure de `from` est ignorée). Les
 * occurrences sont générées sur un horizon glissant > 12 mois autour de `from`
 * (trimestres de l'année précédente, courante et suivante) afin de couvrir le
 * report du T4 sur janvier+1 et la table TVA jusqu'à 2027-01.
 */
export function getUpcomingSocialDeadlines(
  from: Date,
  limit = 6,
): SocialDeadline[] {
  if (limit <= 0) {
    return [];
  }

  const fromYear = from.getFullYear();

  const candidates: SocialDeadline[] = [
    ...buildDeadlinesForYear(fromYear - 1),
    ...buildDeadlinesForYear(fromYear),
    ...buildDeadlinesForYear(fromYear + 1),
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
