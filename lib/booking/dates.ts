// Helpers de dates "heure murale" (Europe/Bruxelles). Les dates sont stockées
// "YYYY-MM-DD" et les heures "HH:MM", sans fuseau. Les calculs passent par
// Date.UTC pour rester déterministes côté serveur (Vercel tourne en UTC), à
// l'identique de lib/rendez-vous/ics.ts qui loge l'heure murale dans les
// champs UTC.

const DAYS_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
const DAYS_FR_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isHm(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function parts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

export function ymdToUtc(ymd: string): Date {
  const { y, m, d } = parts(ymd);
  return new Date(Date.UTC(y, m - 1, d));
}

export function weekdayOf(ymd: string): number {
  return ymdToUtc(ymd).getUTCDay();
}

export function addDaysYmd(ymd: string, n: number): string {
  const dt = ymdToUtc(ymd);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Date "ICS" : heure murale bruxelloise logée dans les champs UTC. */
export function combineToUtc(ymd: string, hm: string): Date {
  const { y, m, d } = parts(ymd);
  const [hh, mm] = hm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
}

export function weekdayLabel(weekday: number, short = false): string {
  return (short ? DAYS_FR_SHORT : DAYS_FR)[weekday] ?? "?";
}

export function frenchDate(ymd: string): string {
  const { y, m, d } = parts(ymd);
  return `${DAYS_FR[weekdayOf(ymd)]} ${d} ${MONTHS_FR[m - 1]} ${y}`;
}

export function frenchDateShort(ymd: string): string {
  const { y, m, d } = parts(ymd);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** Date + heure murales actuelles à Bruxelles (pour exclure les créneaux passés). */
export function brusselsNowParts(now: Date = new Date()): {
  ymd: string;
  hm: string;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) map[p.type] = p.value;
  const hour = map.hour === "24" ? "00" : map.hour;
  return { ymd: `${map.year}-${map.month}-${map.day}`, hm: `${hour}:${map.minute}` };
}

export function isSlotPast(
  ymd: string,
  hm: string,
  now: { ymd: string; hm: string },
): boolean {
  return ymd < now.ymd || (ymd === now.ymd && hm <= now.hm);
}
