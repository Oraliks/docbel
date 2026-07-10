/// Helpers PURS du dashboard admin (aucun import Prisma) — testés en vitest.

export type Period = "7d" | "30d" | "90d";

export const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

const DAY_MS = 24 * 60 * 60 * 1000;

export function parsePeriod(raw: string | undefined | null): Period {
  return raw === "7d" || raw === "90d" ? raw : "30d";
}

export interface PeriodBounds {
  start: Date;
  prevStart: Date;
  end: Date;
  days: number;
}

export function periodBounds(period: Period, now: Date = new Date()): PeriodBounds {
  const days = PERIOD_DAYS[period];
  return {
    start: new Date(now.getTime() - days * DAY_MS),
    prevStart: new Date(now.getTime() - 2 * days * DAY_MS),
    end: now,
    days,
  };
}

/** Delta % arrondi vs période précédente. null = non significatif (précédent nul). */
export function computeDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Taux % arrondi (ex. complétion). 0 si dénominateur nul. */
export function computeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

/** Jour courant côté Belgique au format YYYY-MM-DD (fr-CA = ISO). */
export function belgianDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export interface DayCount {
  day: string;
  count: number;
}

/** Complète les jours sans données (count 0) sur `days` jours, aujourd'hui inclus. */
export function zeroFillDays(rows: DayCount[], days: number, now: Date = new Date()): DayCount[] {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = belgianDay(new Date(now.getTime() - i * DAY_MS));
    out.push({ day, count: byDay.get(day) ?? 0 });
  }
  return out;
}

/** Conversions étape par étape d'un funnel : out[i] = stages[i+1] / stages[i] en %. */
export function stepConversions(stages: number[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    out.push(stages[i] === 0 ? null : Math.round((stages[i + 1] / stages[i]) * 100));
  }
  return out;
}
