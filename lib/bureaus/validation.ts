import type { BureauHours, BureauTypeCode } from "./types";

export type BureauInput = {
  organismeId: string;
  type: BureauTypeCode;
  name: string;
  street: string;
  streetNum: string | null;
  postalCode: string;
  city: string;
  lat: number | null;
  lng: number | null;
  communeId: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  appointmentUrl: string | null;
  hours: BureauHours;
  hoursNotes: string | null;
  services: string[];
  active: boolean;
  notes: string | null;
  nameNl: string | null;
  nameDe: string | null;
};

export type ValidationError = { field: string; message: string };

const URL_RE = /^https?:\/\/[^\s]+$/i;
const POSTAL_RE = /^\d{4}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_TYPES: BureauTypeCode[] = ["CPAS", "COMMUNE", "ONEM", "SYNDICAT", "PERMANENCE", "AUTRE"];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOrNull(value: unknown): string | null {
  const s = clean(value);
  return s.length > 0 ? s : null;
}

function toNumOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toBool(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function parseHoursInput(value: unknown): BureauHours {
  if (!Array.isArray(value)) return [];
  const out: BureauHours = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const day = toNumOrNull(e.day);
    if (day === null || day < 0 || day > 6) continue;
    const slots = Array.isArray(e.slots) ? e.slots : [];
    const validSlots = [];
    for (const s of slots) {
      if (!s || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      const open = clean(so.open);
      const close = clean(so.close);
      if (TIME_RE.test(open) && TIME_RE.test(close) && open < close) {
        validSlots.push({ open, close });
      }
    }
    out.push({ day, slots: validSlots });
  }
  return out;
}

export function validateBureauInput(
  body: unknown
): { ok: true; data: BureauInput } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const raw = (body ?? {}) as Record<string, unknown>;

  const organismeId = clean(raw.organismeId);
  const typeRaw = clean(raw.type).toUpperCase() as BureauTypeCode;
  const name = clean(raw.name);
  const street = clean(raw.street);
  const postalCode = clean(raw.postalCode);
  const city = clean(raw.city);
  const website = clean(raw.website);
  const appointmentUrl = clean(raw.appointmentUrl);

  if (organismeId.length < 1) errors.push({ field: "organismeId", message: "Organisme requis" });
  if (!VALID_TYPES.includes(typeRaw))
    errors.push({ field: "type", message: "Type invalide (CPAS|COMMUNE|ONEM|SYNDICAT|PERMANENCE|AUTRE)" });
  if (name.length < 2) errors.push({ field: "name", message: "Nom requis (2 car. min.)" });
  if (street.length < 2) errors.push({ field: "street", message: "Rue requise" });
  if (!POSTAL_RE.test(postalCode))
    errors.push({ field: "postalCode", message: "Code postal: 4 chiffres" });
  if (city.length < 2) errors.push({ field: "city", message: "Ville requise" });
  if (website.length > 0 && !URL_RE.test(website))
    errors.push({ field: "website", message: "URL invalide (http/https)" });
  if (appointmentUrl.length > 0 && !URL_RE.test(appointmentUrl))
    errors.push({ field: "appointmentUrl", message: "URL invalide (http/https)" });

  // CPAS / COMMUNE doivent avoir une commune attitrée.
  const communeId = cleanOrNull(raw.communeId);
  if ((typeRaw === "CPAS" || typeRaw === "COMMUNE") && !communeId) {
    errors.push({ field: "communeId", message: "Commune attitrée requise pour CPAS/COMMUNE" });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      organismeId,
      type: typeRaw,
      name,
      street,
      streetNum: cleanOrNull(raw.streetNum),
      postalCode,
      city,
      lat: toNumOrNull(raw.lat),
      lng: toNumOrNull(raw.lng),
      communeId,
      phone: cleanOrNull(raw.phone),
      email: cleanOrNull(raw.email),
      website: website || null,
      appointmentUrl: appointmentUrl || null,
      hours: parseHoursInput(raw.hours),
      hoursNotes: cleanOrNull(raw.hoursNotes),
      services: toStringArray(raw.services),
      active: toBool(raw.active, true),
      notes: cleanOrNull(raw.notes),
      nameNl: cleanOrNull(raw.nameNl),
      nameDe: cleanOrNull(raw.nameDe),
    },
  };
}
