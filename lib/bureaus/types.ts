import type { Bureau, Commune, Organisme } from "@prisma/client";
import { getBelgianHolidayName } from "./holidays";

export type BureauTypeCode = "CPAS" | "COMMUNE" | "ONEM" | "SYNDICAT" | "PERMANENCE" | "AUTRE";

export type RegionCode = "wallonia" | "flanders" | "brussels" | "germanophone";

/**
 * Plage horaire d'un bureau pour un jour donné.
 * day: 0=dimanche, 1=lundi, 2=mardi, 3=mercredi, 4=jeudi, 5=vendredi, 6=samedi
 */
export type HourSlot = {
  open: string; // "09:00"
  close: string; // "12:00"
};

export type DayHours = {
  day: number; // 0-6
  slots: HourSlot[]; // [] = fermé
};

export type BureauHours = DayHours[];

/** Liste libre des codes de service. Affichés en chips dans l'UI. */
export const SERVICE_CODES = [
  "RIS", // Revenu d'intégration sociale
  "aide_juridique",
  "aide_alimentaire",
  "domiciliation", // pour SDF
  "energie", // primes énergie
  "logement",
  "etat_civil",
  "population",
  "urbanisme",
  "chomage", // ONEM
  "controle", // contrôle ONEM
  "permanence_sociale",
  "rdv_obligatoire",
] as const;

export type ServiceCode = (typeof SERVICE_CODES)[number];

export type SerializedBureau = {
  id: string;
  organismeId: string;
  organismeCode: string | null;
  organismeName: string | null;
  organismeColor: string | null;
  type: BureauTypeCode;
  name: string;
  nameNl: string | null;
  nameDe: string | null;
  street: string;
  streetNum: string | null;
  postalCode: string;
  city: string;
  fullAddress: string;
  lat: number | null;
  lng: number | null;
  communeId: string | null;
  communeName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  appointmentUrl: string | null;
  hours: BureauHours;
  hoursNotes: string | null;
  services: string[];
  active: boolean;
  notes: string | null;
  verified: boolean;
  lastVerifiedAt: string | null;
  verifiedBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BureauWithRelations = Bureau & {
  organisme: Organisme | null;
  commune: Commune | null;
};

export function serializeBureau(bureau: BureauWithRelations): SerializedBureau {
  const hours = parseHours(bureau.hours);
  const services = parseServices(bureau.services);
  const fullAddress = [
    [bureau.street, bureau.streetNum].filter(Boolean).join(" "),
    `${bureau.postalCode} ${bureau.city}`,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    id: bureau.id,
    organismeId: bureau.organismeId,
    organismeCode: bureau.organisme?.code ?? null,
    organismeName: bureau.organisme?.shortName ?? bureau.organisme?.name ?? null,
    organismeColor: bureau.organisme?.color ?? null,
    type: bureau.type as BureauTypeCode,
    name: bureau.name,
    nameNl: bureau.nameNl,
    nameDe: bureau.nameDe,
    street: bureau.street,
    streetNum: bureau.streetNum,
    postalCode: bureau.postalCode,
    city: bureau.city,
    fullAddress,
    lat: bureau.lat,
    lng: bureau.lng,
    communeId: bureau.communeId,
    communeName: bureau.commune?.nameFr ?? null,
    phone: bureau.phone,
    email: bureau.email,
    website: bureau.website,
    appointmentUrl: bureau.appointmentUrl,
    hours,
    hoursNotes: bureau.hoursNotes,
    services,
    active: bureau.active,
    notes: bureau.notes,
    verified: bureau.verified,
    lastVerifiedAt: bureau.lastVerifiedAt?.toISOString() ?? null,
    verifiedBy: bureau.verifiedBy,
    updatedBy: bureau.updatedBy,
    createdAt: bureau.createdAt.toISOString(),
    updatedAt: bureau.updatedAt.toISOString(),
  };
}

export function parseHours(value: unknown): BureauHours {
  if (!Array.isArray(value)) return [];
  const out: BureauHours = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const day = typeof e.day === "number" ? e.day : -1;
    if (day < 0 || day > 6) continue;
    const slotsRaw = Array.isArray(e.slots) ? e.slots : [];
    const slots: HourSlot[] = [];
    for (const s of slotsRaw) {
      if (!s || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      const open = typeof so.open === "string" ? so.open : "";
      const close = typeof so.close === "string" ? so.close : "";
      if (/^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close)) {
        slots.push({ open, close });
      }
    }
    out.push({ day, slots });
  }
  return out;
}

export function parseServices(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

const DAY_LABELS_FR = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

export function dayLabelFr(day: number): string {
  return DAY_LABELS_FR[day] ?? "?";
}

/**
 * Renvoie l'état d'ouverture d'un bureau à un instant donné.
 * Côté serveur ou client (utilisez la même date pour la cohérence).
 */
export type OpenStatus =
  | { state: "open"; closesAt: string; minutesLeft: number }
  | { state: "closed_today" }
  | { state: "closed"; nextOpen?: { day: number; time: string } }
  | { state: "holiday"; holidayName: string; nextOpen?: { day: number; time: string } }
  | { state: "no_data" };

export function computeOpenStatus(hours: BureauHours, at: Date = new Date()): OpenStatus {
  if (!hours || hours.length === 0) return { state: "no_data" };

  // Jour férié belge → fermé, on cherche la prochaine ouverture
  const holidayName = getBelgianHolidayName(at);
  if (holidayName) {
    const day = at.getDay();
    const minutesNow = at.getHours() * 60 + at.getMinutes();
    const next = nextOpening(hours, day, minutesNow, at);
    return { state: "holiday", holidayName, nextOpen: next ?? undefined };
  }

  const day = at.getDay();
  const minutesNow = at.getHours() * 60 + at.getMinutes();
  const today = hours.find((h) => h.day === day);
  if (today) {
    for (const slot of today.slots) {
      const oMin = toMinutes(slot.open);
      const cMin = toMinutes(slot.close);
      if (minutesNow >= oMin && minutesNow < cMin) {
        return {
          state: "open",
          closesAt: slot.close,
          minutesLeft: cMin - minutesNow,
        };
      }
    }
    const stillOpensToday = today.slots.some((s) => toMinutes(s.open) > minutesNow);
    if (!stillOpensToday) {
      const next = nextOpening(hours, day, minutesNow, at);
      return next ? { state: "closed", nextOpen: next } : { state: "closed_today" };
    }
    const nextSlot = today.slots
      .filter((s) => toMinutes(s.open) > minutesNow)
      .sort((a, b) => toMinutes(a.open) - toMinutes(b.open))[0];
    if (nextSlot) {
      return { state: "closed", nextOpen: { day, time: nextSlot.open } };
    }
  }
  const next = nextOpening(hours, day, minutesNow, at);
  return next ? { state: "closed", nextOpen: next } : { state: "closed" };
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function nextOpening(
  hours: BureauHours,
  fromDay: number,
  fromMinutes: number,
  fromDate?: Date
) {
  // Saute les jours fériés en cherchant la prochaine ouverture
  for (let offset = 1; offset <= 14; offset++) {
    const d = (fromDay + offset) % 7;
    if (fromDate) {
      const candidate = new Date(fromDate);
      candidate.setDate(candidate.getDate() + offset);
      if (getBelgianHolidayName(candidate)) continue;
    }
    const dh = hours.find((h) => h.day === d);
    if (!dh || dh.slots.length === 0) continue;
    const earliest = [...dh.slots].sort((a, b) => toMinutes(a.open) - toMinutes(b.open))[0];
    if (earliest) return { day: d, time: earliest.open };
  }
  // Same day but later (already handled above) — fallback
  if (fromMinutes !== undefined) {
    const dh = hours.find((h) => h.day === fromDay);
    if (dh) {
      const later = dh.slots
        .filter((s) => toMinutes(s.open) > fromMinutes)
        .sort((a, b) => toMinutes(a.open) - toMinutes(b.open))[0];
      if (later) return { day: fromDay, time: later.open };
    }
  }
  return null;
}

/**
 * Distance Haversine (km) entre deux points lat/lng.
 * Utilisée pour trier les bureaux à proximité.
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
