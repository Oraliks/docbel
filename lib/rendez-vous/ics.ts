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
// (« 4 Appointments: », « 4 rendez-vous : », « 0 guichet disponible »). Un nom
// de personne ne contient jamais ces mots-clés.
const NOISE_LINE = /appointments?|rendez-?vous|guichets?/i;
const HAS_LETTER = /\p{L}/u;

// Boutons de l'interface source (FGTB) parfois copiés avec la liste : « Approuver »,
// « Refuser »… Ce ne sont pas des noms. On les ignore quand ils sont SEULS sur
// leur ligne, et on les retire quand ils sont accolés en fin de nom.
const ACTION_WORDS =
  "approuver|approuvé|approuvée|approve|approved|refuser|refusé|refusée|rejeter|reject|rejected|annuler|annulé|annulée|cancel|cancelled|modifier|supprimer|détails?|details?|confirmer|valider|voir";
const ACTION_BUTTON_LINE = new RegExp(`^(?:${ACTION_WORDS})$`, "i");
// En fin de ligne, on ne retire que les boutons d'action « forts » (approuver/
// refuser) pour ne jamais amputer un patronyme se terminant par un mot courant.
const TRAILING_ACTION = new RegExp(
  `\\s+(?:approuver|approuvé|approuvée|approve|approved|refuser|refusé|refusée|rejeter|reject|rejected)$`,
  "i",
);

// Préfixe de boutons collés en début de nom dans le format « Liste d'attente »
// (« approuverAnnulerGabriel Niesen »). On strippe UNE OU PLUSIEURS occurrences
// de boutons d'action en début de ligne (avec espaces facultatifs entre eux).
const ACTION_PREFIX = new RegExp(
  `^(?:(?:approuver|approuvé|approuvée|approve|approved|refuser|refusé|refusée|rejeter|reject|rejected|annuler|annulé|annulée|cancel|cancelled)\\s*)+`,
  "i",
);

// Cluster de boutons d'action en masse (« Approve AllAnnuler tout », « Annuler
// tout », « Tout approuver », etc.) — ligne entière à ignorer.
const BULK_ACTIONS_LINE =
  /^(?:approve\s*all(?:\s*annuler\s*tout)?|annuler\s*tout(?:\s*approve\s*all)?|approuver\s*(?:tous|toutes?)|tout\s*(?:approuver|annuler))$/i;

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
 * Transforme le texte collé en liste de rendez-vous. Deux formats acceptés :
 *
 *  • **FGTB historique** (ordre DATE → HEURE → NOMS) — multi-journées : chaque
 *    en-tête « Appointments for JJ/MM/AAAA » (ou date seule) ouvre un jour ;
 *    les créneaux et noms qui suivent s'y rattachent.
 *
 *  • **Liste d'attente FGTB** (ordre NOM → DATE → HEURE, un bloc par RDV) :
 *    chaque ligne nom est préfixée des boutons « approuverAnnuler… » à retirer,
 *    la date est en ligne dans une adresse, l'heure suit. Le nom est mémorisé
 *    jusqu'à la lecture du créneau horaire.
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

  const appointments: Appointment[] = [];
  const pendingNames: string[] = []; // noms en attente d'un date+slot (Liste d'attente)
  let currentDate: YMD | null = null;
  let slot: Slot | null = null;
  let sawDate = false;

  /** Émet les noms en attente dès qu'on a date + créneau. */
  const flush = () => {
    if (!currentDate || !slot || pendingNames.length === 0) return;
    for (const name of pendingNames) {
      appointments.push({
        name,
        start: wallClock(currentDate, slot.startH, slot.startM),
        end: wallClock(currentDate, slot.endH, slot.endM),
      });
    }
    pendingNames.length = 0;
  };

  for (const rawLine of input.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (line === "") continue;

    // 0) Clusters de boutons en masse (« Approve AllAnnuler tout »…).
    if (BULK_ACTIONS_LINE.test(line)) continue;

    // 1) Ligne porteuse d'une date → ouvre un nouveau jour. Testée AVANT le
    //    filtre « bruit » car l'en-tête « Appointments for … » contient le
    //    mot-clé bruit tout en portant la date. Trois sources possibles :
    //    après « for »/« pour », date seule, ou date inline (adresse + date).
    const dateMatch =
      DATE_AFTER_KEYWORD.exec(line) ??
      (STANDALONE_DATE.test(line) ? DATE_ANYWHERE.exec(line) : null) ??
      // Date intégrée à une ligne plus longue (adresse + date dans la liste
      // d'attente). Exige `:` pour ne pas confondre avec un nom qui contiendrait
      // une date entre parenthèses ; exclut les lignes qui sont un créneau.
      (!LOOSE_TIME_RANGE.test(line) && line.includes(":")
        ? DATE_ANYWHERE.exec(line)
        : null);
    if (dateMatch) {
      const d = Number(dateMatch[1]);
      const m = Number(dateMatch[2]);
      const y = Number(dateMatch[3]);
      if (!isValidYMD(y, m, d)) {
        throw new AppointmentParseError(
          "DATE_MISSING",
          `Date illisible ou invalide : « ${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]} ».`,
        );
      }
      currentDate = { y, m, d };
      slot = null; // un nouveau jour/bloc repart sans créneau actif
      sawDate = true;
      continue;
    }

    // 2) Bruit : compteurs (« 4 Appointments: », « guichet »…) et boutons de
    //    l'interface source copiés par mégarde (« Approuver », « Refuser »…).
    if (NOISE_LINE.test(line) || ACTION_BUTTON_LINE.test(line)) continue;

    // 3) Nouveau créneau horaire — déclenche le flush des noms en attente.
    if (LOOSE_TIME_RANGE.test(line)) {
      slot = parseTimeRange(line);
      flush();
      continue;
    }

    // 4) Sinon, un nom. Retire les boutons collés (préfixe « approuverAnnuler »
    //    pour la liste d'attente, ou bouton en fin de ligne).
    const hasPrefix = ACTION_PREFIX.test(line);
    const name = line
      .replace(ACTION_PREFIX, "")
      .replace(TRAILING_ACTION, "")
      .trim();
    if (!HAS_LETTER.test(name)) continue;

    if (hasPrefix) {
      // Format liste d'attente : la date et l'heure suivent → bufferiser.
      pendingNames.push(name);
    } else if (currentDate && slot) {
      // Format FGTB classique : date+slot déjà connus → émettre tout de suite.
      appointments.push({
        name,
        start: wallClock(currentDate, slot.startH, slot.startM),
        end: wallClock(currentDate, slot.endH, slot.endM),
      });
    }
    // Sinon (pas de préfixe ET pas de contexte) → ignorer (bruit non détecté).
  }

  if (!sawDate) {
    throw new AppointmentParseError(
      "DATE_MISSING",
      "Date absente : ajoutez une ligne « Appointments for JJ/MM/AAAA ».",
    );
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

/**
 * Nom de fichier déduit des dates : `RDV_JJ_MM_AAAA.ics`, ou une plage
 * `RDV_JJ_MM_AAAA-JJ_MM_AAAA.ics` quand le collage couvre plusieurs jours.
 */
export function appointmentsFilename(appointments: Appointment[]): string {
  if (appointments.length === 0) return "rendez-vous.ics";
  const stamp = (d: Date) =>
    `${pad(d.getUTCDate())}_${pad(d.getUTCMonth() + 1)}_${d.getUTCFullYear()}`;
  let min = appointments[0].start;
  let max = appointments[0].start;
  for (const a of appointments) {
    if (a.start.getTime() < min.getTime()) min = a.start;
    if (a.start.getTime() > max.getTime()) max = a.start;
  }
  const a = stamp(min);
  const b = stamp(max);
  return a === b ? `RDV_${a}.ics` : `RDV_${a}-${b}.ics`;
}
