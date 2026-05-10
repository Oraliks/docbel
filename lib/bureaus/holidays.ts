/**
 * Jours fériés légaux belges + computus pour Pâques (et fêtes mobiles).
 * Tous les CPAS, Communes, ONEM et syndicats sont fermés ces jours.
 */

export type Holiday = {
  date: string; // YYYY-MM-DD
  name: string;
};

const FIXED: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: "Jour de l'an" },
  { month: 5, day: 1, name: "Fête du Travail" },
  { month: 7, day: 21, name: "Fête nationale" },
  { month: 8, day: 15, name: "Assomption" },
  { month: 11, day: 1, name: "Toussaint" },
  { month: 11, day: 11, name: "Armistice" },
  { month: 12, day: 25, name: "Noël" },
];

/**
 * Calcule la date de Pâques (dimanche) selon l'algorithme de Meeus/Jones/Butcher.
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const cache = new Map<number, Set<string>>();

function getYearHolidaySet(year: number): Set<string> {
  const cached = cache.get(year);
  if (cached) return cached;
  const set = new Set<string>();
  for (const f of FIXED) {
    set.add(`${year}-${String(f.month).padStart(2, "0")}-${String(f.day).padStart(2, "0")}`);
  }
  const easter = easterSunday(year);
  set.add(fmt(addDays(easter, 1))); // Lundi de Pâques
  set.add(fmt(addDays(easter, 39))); // Ascension
  set.add(fmt(addDays(easter, 50))); // Lundi de Pentecôte
  cache.set(year, set);
  return set;
}

/**
 * Vrai si la date donnée est un jour férié belge légal.
 */
export function isBelgianHoliday(date: Date): boolean {
  const set = getYearHolidaySet(date.getFullYear());
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return set.has(key);
}

/**
 * Renvoie le nom du jour férié si la date en est un, sinon null.
 */
export function getBelgianHolidayName(date: Date): string | null {
  if (!isBelgianHoliday(date)) return null;
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const fixed = FIXED.find((f) => f.month === m && f.day === d);
  if (fixed) return fixed.name;
  const easter = easterSunday(date.getFullYear());
  const days = Math.round((date.getTime() - easter.getTime()) / 86400_000);
  if (days === 1) return "Lundi de Pâques";
  if (days === 39) return "Ascension";
  if (days === 50) return "Lundi de Pentecôte";
  return null;
}
