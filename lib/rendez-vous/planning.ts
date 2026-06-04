/**
 * Modèle de « Planification des shifts » dérivé d'une liste de rendez-vous.
 *
 * Module VOLONTAIREMENT PUR (aucune dépendance Node/serveur ni jsPDF) afin de
 * rester testable et importable côté client comme côté serveur. Le rendu PDF
 * proprement dit vit dans `planning-pdf.ts` (qui importe jsPDF dynamiquement).
 *
 * À partir des rendez-vous (déjà parsés par `ics.ts`), on reconstruit la grille
 * de l'export Excel « PLANIFICATION DES SHIFTS » :
 *   • le JOUR de la semaine est déduit de la date des rendez-vous ;
 *   • chaque créneau horaire devient une COLONNE ;
 *   • les noms sont empilés dans la colonne de leur créneau ;
 *   • une ligne « Total » compte les personnes par créneau.
 */

import type { Appointment } from "@/lib/rendez-vous/ics";

/** Couleur d'un thème, en composantes RVB 0–255 (format attendu par jsPDF). */
export type RGB = readonly [number, number, number];

export type DayTheme = {
  /** Nom français du jour (capitalisé) — titre du PDF. */
  name: string;
  /** Couleur forte : titre, en-tête de tableau, bordures. */
  accent: RGB;
  /** Teinte claire : fond des lignes alternées et de la ligne Total. */
  tint: RGB;
};

// getUTCDay() : 0 = dimanche … 6 = samedi. Chaque jour a sa couleur distincte,
// dans l'esprit des onglets colorés du classeur Excel d'origine.
const DAY_THEMES: readonly DayTheme[] = [
  { name: "Dimanche", accent: [192, 57, 43], tint: [250, 235, 233] }, // rouge
  { name: "Lundi", accent: [91, 42, 134], tint: [238, 232, 244] }, // violet
  { name: "Mardi", accent: [31, 111, 178], tint: [231, 240, 248] }, // bleu
  { name: "Mercredi", accent: [46, 139, 87], tint: [232, 244, 238] }, // vert
  { name: "Jeudi", accent: [199, 125, 2], tint: [251, 242, 227] }, // ambre
  { name: "Vendredi", accent: [14, 138, 138], tint: [226, 243, 243] }, // sarcelle
  { name: "Samedi", accent: [176, 48, 110], tint: [249, 231, 240] }, // magenta
];

/** Thème (nom + couleurs) du jour porté par une date. */
export function dayTheme(date: Date): DayTheme {
  return DAY_THEMES[date.getUTCDay()];
}

export type PlanningColumn = {
  /** Heure de début du créneau, format Excel « 8:20 ». */
  time: string;
  /** Plage complète « 08:20 – 08:40 » (sous-titre de colonne). */
  range: string;
  /** Noms des personnes attendues sur ce créneau. */
  names: string[];
};

export type Planning = {
  theme: DayTheme;
  /** Date des rendez-vous, format belge « JJ/MM/AAAA ». */
  dateLabel: string;
  columns: PlanningColumn[];
  /** Nombre de lignes nécessaires (plus grand créneau). */
  rowCount: number;
  /** Total de rendez-vous, toutes colonnes confondues. */
  total: number;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** « 8:20 » — heure de début sans zéro initial, comme dans le modèle Excel. */
function shortTime(d: Date): string {
  return `${d.getUTCHours()}:${pad(d.getUTCMinutes())}`;
}

/** « 08:20 – 08:40 » — plage complète. */
function rangeLabel(start: Date, end: Date): string {
  return `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())} – ${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`;
}

function dateLabel(d: Date): string {
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/**
 * Construit le modèle de planning à partir des rendez-vous.
 *
 * Les rendez-vous consécutifs partageant le même créneau sont regroupés dans
 * une même colonne (ils arrivent déjà triés par `parseAppointments`).
 */
export function buildPlanning(appointments: Appointment[]): Planning {
  if (!Array.isArray(appointments) || appointments.length === 0) {
    throw new Error("Aucun rendez-vous : impossible de construire le planning.");
  }

  const columns: PlanningColumn[] = [];
  let key = "";
  for (const appt of appointments) {
    const colKey = `${shortTime(appt.start)}-${shortTime(appt.end)}`;
    if (colKey !== key) {
      columns.push({
        time: shortTime(appt.start),
        range: rangeLabel(appt.start, appt.end),
        names: [],
      });
      key = colKey;
    }
    columns[columns.length - 1].names.push(appt.name);
  }

  const rowCount = columns.reduce((max, c) => Math.max(max, c.names.length), 0);

  return {
    theme: dayTheme(appointments[0].start),
    dateLabel: dateLabel(appointments[0].start),
    columns,
    rowCount,
    total: appointments.length,
  };
}

/** Nom de fichier : `Planning_Mercredi_10_06_2026.pdf`. */
export function planningFilename(planning: Planning): string {
  return `Planning_${planning.theme.name}_${planning.dateLabel.replace(/\//g, "_")}.pdf`;
}
