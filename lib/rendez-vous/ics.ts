/**
 * Conversion d'une liste de rendez-vous collée (format de l'export FGTB) en
 * fichier calendrier `.ics` conforme à la RFC 5545.
 *
 * Module VOLONTAIREMENT PUR : aucune dépendance Node/serveur (pas de prisma,
 * pas d'auth, pas de `Buffer`). Il s'appuie uniquement sur des API standard
 * (`TextEncoder`, `crypto.randomUUID`) afin de pouvoir être importé aussi bien
 * côté serveur (route `/api/export-ics`) que côté client (aperçu live dans la
 * page `/rendez-vous`).
 *
 * ── Gestion du fuseau Europe/Bruxelles ──────────────────────────────────────
 * On NE convertit PAS en UTC (ce qui obligerait à connaître l'offset DST pour
 * chaque date). À la place :
 *   1. chaque `Appointment` porte l'heure MURALE bruxelloise dans les champs
 *      UTC de son `Date` (construit via `Date.UTC(...)`). C'est déterministe et
 *      indépendant du fuseau du serveur.
 *   2. le `.ics` émet `DTSTART;TZID=Europe/Brussels:YYYYMMDDTHHMMSS` accompagné
 *      d'un bloc `VTIMEZONE` complet. Le client calendrier (Outlook, Google,
 *      Apple) applique lui-même les règles d'heure d'été/hiver.
 */

export type Appointment = {
  /** Nom complet de la personne — devient le `SUMMARY` de l'événement. */
  name: string;
  /** Début (heure murale Europe/Bruxelles portée dans les champs UTC). */
  start: Date;
  /** Fin (heure murale Europe/Bruxelles portée dans les champs UTC). */
  end: Date;
};

export type ParseErrorCode = "DATE_MISSING" | "INVALID_TIME" | "NO_APPOINTMENTS";

/**
 * Erreur de parsing typée — le code permet à l'appelant (route API) de mapper
 * vers une réponse HTTP claire, et `message` est déjà rédigé en français pour
 * affichage direct à l'utilisateur.
 */
export class AppointmentParseError extends Error {
  readonly code: ParseErrorCode;
  /** Ligne fautive, le cas échéant (horaires invalides). */
  readonly line?: string;

  constructor(code: ParseErrorCode, message: string, line?: string) {
    super(message);
    this.name = "AppointmentParseError";
    this.code = code;
    if (line !== undefined) this.line = line;
    // Conserve `instanceof` au travers de la transpilation (target ES2017).
    Object.setPrototypeOf(this, AppointmentParseError.prototype);
  }
}

type YMD = { y: number; m: number; d: number };
type Slot = { startH: number; startM: number; endH: number; endM: number };

// Tirets acceptés entre les deux heures : trait d'union, tirets typographiques
// (figure/en/em/barre horizontale) et signe moins. La donnée FGTB utilise « – ».
const DASHES = "\\u002D\\u2010-\\u2015\\u2212";
const LOOSE_TIME_RANGE = new RegExp(
  `^\\d{1,2}\\s*:\\s*\\d{1,2}\\s*[${DASHES}]\\s*\\d{1,2}\\s*:\\s*\\d{1,2}$`,
);
const STRICT_TIME_RANGE = new RegExp(
  `^(\\d{1,2})\\s*:\\s*(\\d{2})\\s*[${DASHES}]\\s*(\\d{1,2})\\s*:\\s*(\\d{2})$`,
);

// Date au format belge JJ/MM/AAAA, en priorité après « for » / « pour (le) ».
const DATE_AFTER_KEYWORD =
  /(?:for|pour(?:\s+le)?)\s+(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/i;
const DATE_ANYWHERE = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/;
const STANDALONE_DATE = /^\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{4}$/;

// Lignes « bruit » à ignorer : en-tête (« Appointments for … ») et compteurs
// (« 4 Appointments: », « 4 rendez-vous : »). Un nom de personne ne contient
// jamais ces mots-clés.
const NOISE_LINE = /appointments?|rendez-?vous/i;
const HAS_LETTER = /\p{L}/u;

const MAX_LINE_OCTETS = 75;
const TZID = "Europe/Brussels";
const PRODID = "-//DocBel//Rendez-vous Export//FR";

// Définition VTIMEZONE standard d'Europe/Bruxelles (mêmes règles que celles
// émises par Google/Apple). CET (UTC+1) l'hiver, CEST (UTC+2) l'été ; bascule
// le dernier dimanche de mars / octobre.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isValidYMD(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1970 || y > 2999) return false;
  // Rejette les dates inexistantes (ex. 31/02) via aller-retour UTC.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Extrait la date du dossier (« Appointments for JJ/MM/AAAA »). */
function extractDate(input: string): YMD {
  const match = DATE_AFTER_KEYWORD.exec(input) ?? DATE_ANYWHERE.exec(input);
  if (!match) {
    throw new AppointmentParseError(
      "DATE_MISSING",
      "Date absente : ajoutez une ligne « Appointments for JJ/MM/AAAA ».",
    );
  }
  const d = Number(match[1]);
  const m = Number(match[2]);
  const y = Number(match[3]);
  if (!isValidYMD(y, m, d)) {
    throw new AppointmentParseError(
      "DATE_MISSING",
      `Date illisible ou invalide : « ${match[1]}/${match[2]}/${match[3]} ».`,
    );
  }
  return { y, m, d };
}

/** Valide et normalise une ligne de créneau « HH:MM – HH:MM ». */
function parseTimeRange(line: string): Slot {
  const match = STRICT_TIME_RANGE.exec(line);
  if (!match) {
    throw new AppointmentParseError(
      "INVALID_TIME",
      `Horaire invalide : « ${line} ». Format attendu : « HH:MM – HH:MM ».`,
      line,
    );
  }
  const startH = Number(match[1]);
  const startM = Number(match[2]);
  const endH = Number(match[3]);
  const endM = Number(match[4]);
  if (startH > 23 || endH > 23 || startM > 59 || endM > 59) {
    throw new AppointmentParseError(
      "INVALID_TIME",
      `Horaire invalide : « ${line} ». Heures attendues 00–23, minutes 00–59.`,
      line,
    );
  }
  if (endH * 60 + endM <= startH * 60 + startM) {
    throw new AppointmentParseError(
      "INVALID_TIME",
      `Horaire invalide : « ${line} » — l'heure de fin doit suivre l'heure de début.`,
      line,
    );
  }
  return { startH, startM, endH, endM };
}

/** Construit un `Date` portant l'heure murale bruxelloise dans ses champs UTC. */
function wallClock(date: YMD, h: number, m: number): Date {
  return new Date(Date.UTC(date.y, date.m - 1, date.d, h, m, 0, 0));
}

/**
 * Transforme le texte collé en liste de rendez-vous.
 *
 * @throws {AppointmentParseError} `DATE_MISSING` si aucune date exploitable,
 *   `INVALID_TIME` sur un créneau mal formé, `NO_APPOINTMENTS` si aucun nom.
 */
export function parseAppointments(input: string): Appointment[] {
  if (typeof input !== "string" || input.trim() === "") {
    throw new AppointmentParseError(
      "DATE_MISSING",
      "Date absente : ajoutez une ligne « Appointments for JJ/MM/AAAA ».",
    );
  }

  // La date est résolue d'abord : « date absente » est l'erreur la plus utile
  // à remonter en premier. (Cas mono-journée de l'export FGTB.)
  const date = extractDate(input);

  const appointments: Appointment[] = [];
  let slot: Slot | null = null;

  for (const rawLine of input.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (line === "") continue;
    // En-têtes, compteurs et lignes purement « date » → ignorés.
    if (NOISE_LINE.test(line) || STANDALONE_DATE.test(line)) continue;
    // Nouveau créneau horaire.
    if (LOOSE_TIME_RANGE.test(line)) {
      slot = parseTimeRange(line);
      continue;
    }
    // Avant tout créneau, ou ligne sans la moindre lettre → ce n'est pas un nom.
    if (!slot || !HAS_LETTER.test(line)) continue;
    appointments.push({
      name: line,
      start: wallClock(date, slot.startH, slot.startM),
      end: wallClock(date, slot.endH, slot.endM),
    });
  }

  if (appointments.length === 0) {
    throw new AppointmentParseError(
      "NO_APPOINTMENTS",
      "Aucun rendez-vous trouvé dans le texte collé.",
    );
  }
  return appointments;
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** Pliage RFC 5545 §3.1 : aucune ligne physique > 75 octets (UTF-8). */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;
  let result = "";
  let lineBytes = 0;
  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    if (lineBytes + charBytes > MAX_LINE_OCTETS) {
      result += "\r\n "; // CRLF + espace = indicateur de continuation
      lineBytes = 1; // l'espace de continuation compte dans la ligne suivante
    }
    result += char;
    lineBytes += charBytes;
  }
  return result;
}

/** Formate les champs UTC (= heure murale) en `YYYYMMDDTHHMMSS`. */
function formatLocal(date: Date): string {
  return (
    String(date.getUTCFullYear()).padStart(4, "0") +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}

/** Horodatage UTC absolu (`DTSTAMP`), suffixé `Z`. */
function formatStamp(date: Date): string {
  return formatLocal(date) + "Z";
}

let uidCounter = 0;
/** UID unique et stable par événement (RFC 5545 §3.8.4.7). */
function makeUid(): string {
  const c: Crypto | undefined = globalThis.crypto;
  const id =
    c && typeof c.randomUUID === "function"
      ? c.randomUUID()
      : `rdv-${formatStamp(new Date())}-${(uidCounter += 1)}`;
  return `${id}@docbel.be`;
}

/**
 * Génère le contenu complet d'un fichier `.ics` (RFC 5545) — un `VEVENT` par
 * rendez-vous, tous rattachés à la `VTIMEZONE` Europe/Bruxelles.
 *
 * @throws {AppointmentParseError} `NO_APPOINTMENTS` si la liste est vide.
 */
export function generateICS(appointments: Appointment[]): string {
  if (!Array.isArray(appointments) || appointments.length === 0) {
    throw new AppointmentParseError(
      "NO_APPOINTMENTS",
      "Aucun rendez-vous à exporter.",
    );
  }

  const dtstamp = formatStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE,
  ];

  for (const appointment of appointments) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${makeUid()}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=${TZID}:${formatLocal(appointment.start)}`,
      `DTEND;TZID=${TZID}:${formatLocal(appointment.end)}`,
      `SUMMARY:${escapeText(appointment.name)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  // CRLF obligatoire (RFC 5545 §3.1), terminé par un CRLF final.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Nom de fichier déduit de la date des rendez-vous : `RDV_JJ_MM_AAAA.ics`. */
export function appointmentsFilename(appointments: Appointment[]): string {
  const first = appointments[0];
  if (!first) return "rendez-vous.ics";
  const d = first.start;
  return `RDV_${pad(d.getUTCDate())}_${pad(d.getUTCMonth() + 1)}_${d.getUTCFullYear()}.ics`;
}
