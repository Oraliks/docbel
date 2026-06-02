// Validateurs belges (NISS, BCE/TVA, téléphone) utilisés par le module pdf-forms.

/// Raison d'invalidité d'un NISS — sert à produire un message d'erreur
/// pédagogique (longueur vs. erreur de frappe).
export type NissInvalidReason = "length" | "checksum";

export interface NissDiagnosis {
  ok: boolean;
  /// Nombre de chiffres effectivement saisis (espaces/séparateurs ignorés).
  digitCount: number;
  reason?: NissInvalidReason;
}

/// Diagnostique un NISS : longueur (11 chiffres) puis checksum modulo 97.
export function diagnoseNISS(raw: string): NissDiagnosis {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 11) {
    return { ok: false, digitCount: digits.length, reason: "length" };
  }
  const base = digits.slice(0, 9);
  const check = parseInt(digits.slice(9, 11), 10);
  const before = 97 - (parseInt(base, 10) % 97);
  const after = 97 - (parseInt("2" + base, 10) % 97);
  const ok = before === check || after === check;
  return { ok, digitCount: 11, reason: ok ? undefined : "checksum" };
}

/// NISS (numéro de registre national) — validation checksum modulo 97.
export function isValidNISS(raw: string): boolean {
  return diagnoseNISS(raw).ok;
}

function ibanChecksumValid(cleaned: string): boolean {
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numeric = rearranged
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      return code >= 65 && code <= 90 ? (code - 55).toString() : c;
    })
    .join("");
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = parseInt(remainder.toString() + numeric.slice(i, i + 7), 10) % 97;
  }
  return remainder === 1;
}

/// IBAN belge strict (BE + 14 chiffres).
export function isValidBelgianIBAN(raw: string): boolean {
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^BE\d{14}$/.test(cleaned)) return false;
  return ibanChecksumValid(cleaned);
}

/// IBAN international (ISO 13616) — tolère les comptes étrangers.
export function isValidInternationalIBAN(raw: string): boolean {
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleaned)) return false;
  const lengths: Record<string, number> = {
    AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20,
    ES: 24, FI: 18, FR: 27, GB: 22, GR: 27, HR: 21, HU: 28, IE: 22, IT: 27,
    LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28, PT: 25,
    RO: 24, SE: 24, SI: 19, SK: 24,
  };
  const expected = lengths[cleaned.slice(0, 2)];
  if (!expected || cleaned.length !== expected) return false;
  return ibanChecksumValid(cleaned);
}

export function isValidBelgianPostalCode(raw: string): boolean {
  if (!/^\d{4}$/.test(raw.trim())) return false;
  const n = parseInt(raw.trim(), 10);
  return n >= 1000 && n <= 9999;
}

/// TVA / BCE belge (10 chiffres, premier 0 ou 1, checksum modulo 97).
export function isValidBelgianTVA(raw: string): boolean {
  const cleaned = raw.replace(/[\s.\-]/g, "").toUpperCase();
  const match = cleaned.match(/^(BE)?([01]\d{9})$/);
  if (!match) return false;
  const digits = match[2];
  const base = parseInt(digits.slice(0, 8), 10);
  const check = parseInt(digits.slice(8, 10), 10);
  return 97 - (base % 97) === check;
}

export const isValidBelgianBCE = isValidBelgianTVA;

/// Normalise un numéro BCE/TVA en `BE + 10 chiffres`, retourne null si invalide.
export function normalizeBelgianTVA(raw: string): string | null {
  const cleaned = raw.replace(/[\s.\-]/g, "").toUpperCase();
  const match = cleaned.match(/^(BE)?([01]\d{9})$/);
  if (!match) return null;
  const digits = match[2];
  const base = parseInt(digits.slice(0, 8), 10);
  const check = parseInt(digits.slice(8, 10), 10);
  if (97 - (base % 97) !== check) return null;
  return `BE${digits}`;
}

export function isValidBelgianPhone(raw: string): boolean {
  const cleaned = raw.replace(/[\s.\-()]/g, "");
  return /^\+32[1-9]\d{7,8}$/.test(cleaned) || /^0[1-9]\d{7,8}$/.test(cleaned);
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

export function isValidISODate(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  return !isNaN(new Date(raw).getTime());
}
