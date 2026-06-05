/**
 * Détection de doublons de rendez-vous (anti double-réservation).
 *
 * Module VOLONTAIREMENT PUR (aucune dépendance Prisma/serveur) afin d'être
 * partagé entre :
 *   • la route API (`/api/rendez-vous/history`) qui lit/écrit en base ;
 *   • le composant client qui surligne les doublons dans l'aperçu.
 *
 * Périmètre (cf. choix produit) : un doublon = MÊME NOM, quelle que soit la
 * date. On signale donc toute personne qui possède déjà un RDV enregistré (en
 * affichant le créneau précédent), ainsi que les noms répétés dans la liste
 * actuellement collée.
 */

import type { Appointment } from "@/lib/rendez-vous/ics";

/** Un rendez-vous tel que stocké/comparé : date et heures en chaînes stables. */
export type StoredRdv = {
  /** Nom affiché (graphie d'origine). */
  name: string;
  /** Date murale « YYYY-MM-DD ». */
  date: string;
  /** Heure de début « HH:MM ». */
  startTime: string;
  /** Heure de fin « HH:MM ». */
  endTime: string;
};

/** Un nom signalé comme doublon, avec ses occurrences. */
export type DuplicateEntry = {
  /** Clé de comparaison (nom normalisé). */
  normalized: string;
  /** Nom affiché (depuis la liste collée). */
  name: string;
  /** Nombre d'occurrences dans la liste actuellement collée. */
  inListCount: number;
  /** RDV déjà enregistrés pour cette personne (hors créneau identique). */
  history: StoredRdv[];
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Normalise un nom pour la comparaison : minuscules, sans diacritiques, espaces
 * compressés. Ainsi « Gölçük », « GOLCUK » et « gölçük » se rejoignent.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprime les diacritiques combinants
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Date murale « YYYY-MM-DD » à partir des champs UTC d'un `Date`. */
export function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Heure murale « HH:MM » à partir des champs UTC d'un `Date`. */
export function timeKey(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Convertit les rendez-vous parsés en enregistrements comparables/stockables. */
export function toStoredRdvs(appointments: Appointment[]): StoredRdv[] {
  return appointments.map((a) => ({
    name: a.name,
    date: dateKey(a.start),
    startTime: timeKey(a.start),
    endTime: timeKey(a.end),
  }));
}

/** « YYYY-MM-DD » → « DD/MM/YYYY » pour l'affichage. */
export function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-");
  return d && m && y ? `${d}/${m}/${y}` : key;
}

/**
 * Résout le périmètre (`scope`) de l'historique selon le compte :
 *   • partenaire → son organisation (partage au sein du service) ;
 *   • admin → l'organisation qu'il a choisie (ex. « FGTB ») ; à défaut, un
 *     espace admin isolé `admin:<id>` (rétro-compatibilité).
 */
export function resolveScope(opts: {
  isAdmin: boolean;
  partnerOrganization: string | null;
  requestedOrg?: string | null;
  userId: string;
}): string | null {
  const { isAdmin, partnerOrganization, requestedOrg, userId } = opts;
  if (isAdmin) {
    const org = (requestedOrg ?? "").trim();
    return org || `admin:${userId}`;
  }
  return partnerOrganization;
}

function slotKey(r: StoredRdv): string {
  return `${r.date}|${r.startTime}`;
}

/**
 * Calcule les doublons à partir de la liste courante et de l'historique connu.
 *
 * Un nom est signalé s'il :
 *   • apparaît plusieurs fois dans la liste courante, OU
 *   • possède au moins un RDV en historique sur un AUTRE créneau (un créneau
 *     identique = simplement « déjà enregistré », pas un conflit).
 *
 * @param current  rendez-vous de la liste collée
 * @param existing rendez-vous déjà enregistrés (même périmètre/service)
 */
export function computeDuplicates(
  current: StoredRdv[],
  existing: StoredRdv[],
): DuplicateEntry[] {
  // Occurrences et créneaux présents dans la liste courante, par nom normalisé.
  const inList = new Map<
    string,
    { name: string; count: number; slots: Set<string> }
  >();
  for (const r of current) {
    const key = normalizeName(r.name);
    const entry = inList.get(key) ?? {
      name: r.name,
      count: 0,
      slots: new Set<string>(),
    };
    entry.count += 1;
    entry.slots.add(slotKey(r));
    inList.set(key, entry);
  }

  // Historique groupé par nom normalisé.
  const history = new Map<string, StoredRdv[]>();
  for (const r of existing) {
    const key = normalizeName(r.name);
    const list = history.get(key) ?? [];
    list.push(r);
    history.set(key, list);
  }

  const duplicates: DuplicateEntry[] = [];
  for (const [normalized, entry] of inList) {
    // RDV historiques sur un créneau DIFFÉRENT de ceux de la liste courante.
    const priorOther = (history.get(normalized) ?? []).filter(
      (h) => !entry.slots.has(slotKey(h)),
    );
    if (entry.count > 1 || priorOther.length > 0) {
      // Tri chronologique pour un affichage stable.
      priorOther.sort((a, b) =>
        a.date === b.date
          ? a.startTime.localeCompare(b.startTime)
          : a.date.localeCompare(b.date),
      );
      duplicates.push({
        normalized,
        name: entry.name,
        inListCount: entry.count,
        history: priorOther,
      });
    }
  }
  return duplicates;
}
