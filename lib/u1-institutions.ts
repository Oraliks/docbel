import type { U1Institution } from "@prisma/client";

// Maps the French country names (as used in the dataset) to ISO 3166-1 alpha-2
// codes so we can compute flag emojis. Keys must match the `country` field
// stored in DB exactly.
export const COUNTRY_CODE_MAP: Record<string, string> = {
  Allemagne: "DE",
  Autriche: "AT",
  Bulgarie: "BG",
  Croatie: "HR",
  Chypre: "CY",
  Danemark: "DK",
  Espagne: "ES",
  Estonie: "EE",
  Finlande: "FI",
  France: "FR",
  Grèce: "GR",
  "Grande-Bretagne": "GB",
  Gibraltar: "GI",
  Hongrie: "HU",
  Irlande: "IE",
  "Irlande du nord": "GB",
  Islande: "IS",
  Italie: "IT",
  Lettonie: "LV",
  Liechtenstein: "LI",
  Lithuanie: "LT",
  Luxemburg: "LU",
  Malte: "MT",
  Norvège: "NO",
  "Pays-Bas": "NL",
  Pologne: "PL",
  Portugal: "PT",
  Roumanie: "RO",
  Slovénie: "SI",
  Slovaquie: "SK",
  "République Tchèque": "CZ",
  Suède: "SE",
  Suisse: "CH",
};

export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🏳️";
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🏳️";
  // Each letter A-Z → regional indicator symbol (U+1F1E6..U+1F1FF)
  const codePoints = [0, 1].map((i) => 0x1f1e6 + (upper.charCodeAt(i) - 65));
  return String.fromCodePoint(...codePoints);
}

export type AdditionalService = {
  name?: string;
  organization?: string;
  department?: string;
  address?: string[];
  email?: string;
  phone?: string;
  website?: string;
};

export type AdditionalInfo = Record<string, unknown>;

export type U1Extra = {
  contacts?: Record<string, unknown>;
  visitorAddress?: string[];
  regionalServicesU1?: string;
  additionalServices?: AdditionalService[];
  additionalInfo?: AdditionalInfo;
} | null;

export interface U1InstitutionInput {
  country: string;
  countryCode: string | null;
  organization: string;
  department: string | null;
  alternateName: string | null;
  addressLines: string[];
  postalAddress: string | null;
  phone: string | null;
  fax: string | null;
  website: string | null;
  emails: string[];
  extra: U1Extra;
}

export type ValidationError = { field: string; message: string };

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOrNull(value: unknown): string | null {
  const s = clean(value);
  return s.length > 0 ? s : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

const URL_RE = /^https?:\/\/[^\s]+$/i;
const COUNTRY_CODE_RE = /^[A-Z]{2}$/;

export function validateU1Input(
  body: unknown
): { ok: true; data: U1InstitutionInput } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const raw = (body ?? {}) as Record<string, unknown>;

  const country = clean(raw.country);
  const organization = clean(raw.organization);
  const countryCodeRaw = clean(raw.countryCode).toUpperCase();
  const website = clean(raw.website);

  if (country.length < 2) errors.push({ field: "country", message: "Pays requis" });
  if (organization.length < 2)
    errors.push({ field: "organization", message: "Organisme requis" });
  if (countryCodeRaw.length > 0 && !COUNTRY_CODE_RE.test(countryCodeRaw))
    errors.push({ field: "countryCode", message: "Code pays: 2 lettres (ex: IT)" });
  if (website.length > 0 && !URL_RE.test(website))
    errors.push({ field: "website", message: "URL invalide (http/https)" });

  if (errors.length > 0) return { ok: false, errors };

  const fallbackCode = COUNTRY_CODE_MAP[country] ?? null;

  return {
    ok: true,
    data: {
      country,
      countryCode: countryCodeRaw || fallbackCode,
      organization,
      department: cleanOrNull(raw.department),
      alternateName: cleanOrNull(raw.alternateName),
      addressLines: toStringArray(raw.addressLines),
      postalAddress: cleanOrNull(raw.postalAddress),
      phone: cleanOrNull(raw.phone),
      fax: cleanOrNull(raw.fax),
      website: website || null,
      emails: toStringArray(raw.emails),
      extra: parseExtra(raw.extra),
    },
  };
}

function parseExtra(value: unknown): U1Extra {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const out: NonNullable<U1Extra> = {};
  if (v.contacts && typeof v.contacts === "object")
    out.contacts = v.contacts as Record<string, unknown>;
  if (Array.isArray(v.visitorAddress)) out.visitorAddress = toStringArray(v.visitorAddress);
  if (typeof v.regionalServicesU1 === "string")
    out.regionalServicesU1 = v.regionalServicesU1.trim();
  if (Array.isArray(v.additionalServices))
    out.additionalServices = v.additionalServices.filter(
      (x): x is AdditionalService => !!x && typeof x === "object"
    );
  if (v.additionalInfo && typeof v.additionalInfo === "object")
    out.additionalInfo = v.additionalInfo as AdditionalInfo;
  return Object.keys(out).length > 0 ? out : null;
}

export type SerializedU1Institution = {
  id: string;
  country: string;
  countryCode: string | null;
  flag: string;
  organization: string;
  department: string | null;
  alternateName: string | null;
  addressLines: string[];
  postalAddress: string | null;
  phone: string | null;
  fax: string | null;
  website: string | null;
  emails: string[];
  extra: U1Extra;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeU1(inst: U1Institution): SerializedU1Institution {
  const code = inst.countryCode ?? COUNTRY_CODE_MAP[inst.country] ?? null;
  return {
    id: inst.id,
    country: inst.country,
    countryCode: code,
    flag: flagEmoji(code),
    organization: inst.organization,
    department: inst.department,
    alternateName: inst.alternateName,
    addressLines: Array.isArray(inst.addressLines) ? (inst.addressLines as string[]) : [],
    postalAddress: inst.postalAddress,
    phone: inst.phone,
    fax: inst.fax,
    website: inst.website,
    emails: Array.isArray(inst.emails) ? (inst.emails as string[]) : [],
    extra: (inst.extra as U1Extra) ?? null,
    updatedBy: inst.updatedBy,
    createdAt: inst.createdAt.toISOString(),
    updatedAt: inst.updatedAt.toISOString(),
  };
}
