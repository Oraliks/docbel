export function isValidNISS(raw: string): boolean {
  return decodeBelgianNISS(raw).checksumValid;
}

/// Décodage complet d'un NISS belge (registre national).
///
/// Format : `YY.MM.DD-XXX.CC` (11 chiffres au total)
///   YY (1-2)   : 2 derniers chiffres de l'année de naissance
///   MM (3-4)   : mois — 01-12 normal, 21-32 ou 41-52 si "bis" (étrangers sans
///                date complète), 00 si totalement inconnue
///   DD (5-6)   : jour — 01-31 ou 00 si inconnu
///   XXX (7-9)  : numéro séquentiel — IMPAIR = homme, PAIR = femme
///   CC (10-11) : checksum modulo 97 de YYMMDDXXX (né avant 2000) OU de
///                2YYMMDDXXX (né à partir de 2000)
///
/// Retourne :
///   - `checksumValid` : true si le NISS passe la validation modulo 97
///   - `bornBefore2000` : true si la formule "avant 2000" a marché, false sinon
///   - `birthDate` : Date de naissance décodée, ou null si MM ou DD = 00
///   - `gender` : "M" si XXX impair, "F" si pair
export interface BelgianNISSDecoded {
  raw: string;
  digits: string;
  checksumValid: boolean;
  bornBefore2000: boolean | null;
  birthDate: Date | null;
  gender: "M" | "F" | null;
  /// Mois "réel" après prise en compte des variations bis (MM-20 ou MM-40)
  /// — 1..12 si décodable, null sinon
  monthOfBirth: number | null;
  dayOfBirth: number | null;
  yearOfBirth: number | null;
}

export function decodeBelgianNISS(raw: string): BelgianNISSDecoded {
  const digits = raw.replace(/[^0-9]/g, "");
  const fallback: BelgianNISSDecoded = {
    raw,
    digits,
    checksumValid: false,
    bornBefore2000: null,
    birthDate: null,
    gender: null,
    monthOfBirth: null,
    dayOfBirth: null,
    yearOfBirth: null,
  };
  if (digits.length !== 11) return fallback;

  const base = digits.slice(0, 9);
  const check = parseInt(digits.slice(9, 11), 10);

  const before = 97 - (parseInt(base, 10) % 97);
  const after = 97 - (parseInt("2" + base, 10) % 97);
  let bornBefore2000: boolean | null = null;
  if (before === check) bornBefore2000 = true;
  else if (after === check) bornBefore2000 = false;
  else return fallback; // checksum KO

  // Décodage des champs
  const yyDigits = parseInt(digits.slice(0, 2), 10);
  const mmRaw = parseInt(digits.slice(2, 4), 10);
  const ddRaw = parseInt(digits.slice(4, 6), 10);
  const xxx = parseInt(digits.slice(6, 9), 10);

  // Mois réel (gestion variations bis)
  let monthOfBirth: number | null = null;
  if (mmRaw >= 1 && mmRaw <= 12) monthOfBirth = mmRaw;
  else if (mmRaw >= 21 && mmRaw <= 32) monthOfBirth = mmRaw - 20;
  else if (mmRaw >= 41 && mmRaw <= 52) monthOfBirth = mmRaw - 40;
  // mmRaw === 0 ou hors plages → mois inconnu, monthOfBirth reste null

  const dayOfBirth = ddRaw >= 1 && ddRaw <= 31 ? ddRaw : null;
  const yearOfBirth = bornBefore2000 ? 1900 + yyDigits : 2000 + yyDigits;
  const gender: "M" | "F" = xxx % 2 === 1 ? "M" : "F";

  let birthDate: Date | null = null;
  if (monthOfBirth !== null && dayOfBirth !== null) {
    // Construit la date — valide aussi qu'elle est cohérente (pas le 31 février)
    const d = new Date(yearOfBirth, monthOfBirth - 1, dayOfBirth);
    if (
      d.getFullYear() === yearOfBirth &&
      d.getMonth() === monthOfBirth - 1 &&
      d.getDate() === dayOfBirth
    ) {
      birthDate = d;
    }
  }

  return {
    raw,
    digits,
    checksumValid: true,
    bornBefore2000,
    birthDate,
    gender,
    monthOfBirth,
    dayOfBirth,
    yearOfBirth,
  };
}

/// Vérifie qu'un NISS correspond à une personne d'au moins 18 ans à la date
/// donnée (par défaut : aujourd'hui). Retourne null si la date de naissance
/// n'est pas décodable (mois ou jour = 00) — dans ce cas on ne peut pas
/// statuer, à l'appelant de décider.
export function nissIsMajor(raw: string, today: Date = new Date()): boolean | null {
  const d = decodeBelgianNISS(raw);
  if (!d.checksumValid || !d.birthDate) return null;
  const age = computeAge(d.birthDate, today);
  return age >= 18;
}

function computeAge(birth: Date, today: Date): number {
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

/// Valide un IBAN belge spécifiquement (BE + 14 chiffres).
export function isValidBelgianIBAN(raw: string): boolean {
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^BE\d{14}$/.test(cleaned)) return false;
  return ibanChecksumValid(cleaned);
}

/// Valide un IBAN de N'IMPORTE QUEL pays selon le standard ISO 13616.
/// Accepte BE, FR, LU, NL, DE, LT (Revolut), etc. — tant que le pays a
/// une longueur connue et que le checksum modulo 97 passe.
///
/// Pour les démarches belges courantes, on tolère les IBAN étrangers car les
/// citoyens peuvent recevoir leurs allocations sur un compte tiers (Revolut LT,
/// compte familial NL, etc.).
export function isValidInternationalIBAN(raw: string): boolean {
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  // Format général : 2 lettres pays + 2 chiffres checksum + jusqu'à 30 alphanumériques
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleaned)) return false;
  // Longueurs officielles par pays (ISO 13616) — sélection des plus courants
  const lengthsByCountry: Record<string, number> = {
    AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22,
    BH: 22, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22,
    DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27,
    GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HR: 21, HU: 28,
    IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20,
    LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24,
    ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24,
    PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SC: 31,
    SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24,
    TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
  };
  const country = cleaned.slice(0, 2);
  const expectedLength = lengthsByCountry[country];
  if (!expectedLength || cleaned.length !== expectedLength) return false;
  return ibanChecksumValid(cleaned);
}

/// Vérifie le checksum modulo 97 d'un IBAN (algo ISO 13616 standard).
function ibanChecksumValid(cleanedIban: string): boolean {
  const rearranged = cleanedIban.slice(4) + cleanedIban.slice(0, 4);
  const numeric = rearranged
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      return code >= 65 && code <= 90 ? (code - 55).toString() : c;
    })
    .join("");

  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = remainder.toString() + numeric.slice(i, i + 7);
    remainder = parseInt(chunk, 10) % 97;
  }
  return remainder === 1;
}

export function isValidBelgianPostalCode(raw: string): boolean {
  const digits = raw.trim();
  if (!/^\d{4}$/.test(digits)) return false;
  const n = parseInt(digits, 10);
  return n >= 1000 && n <= 9999;
}

/**
 * Numéro de TVA belge / BCE (Banque-Carrefour des Entreprises).
 * Format : BE 0XXX.XXX.XXX (10 chiffres après BE, le premier doit être 0 ou 1).
 * Validation modulo 97.
 */
export function isValidBelgianTVA(raw: string): boolean {
  const cleaned = raw.replace(/[\s.\-]/g, "").toUpperCase();
  const match = cleaned.match(/^(BE)?([01]\d{9})$/);
  if (!match) return false;
  const digits = match[2];
  const base = parseInt(digits.slice(0, 8), 10);
  const check = parseInt(digits.slice(8, 10), 10);
  return 97 - (base % 97) === check;
}

/** Le BCE = même format que TVA (la BCE est la base, la TVA y ajoute juste le préfixe BE pour la facturation). */
export const isValidBelgianBCE = isValidBelgianTVA;

/**
 * Forme canonique d'une TVA belge : "BE" + 10 chiffres (sans espaces/points),
 * ou `null` si le numéro est invalide (mauvais format ou checksum KO).
 * À utiliser pour stocker/comparer une TVA de façon fiable (unicité).
 */
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

/**
 * Numéro de téléphone belge spécifiquement.
 * Accepte : +32 X XX XX XX, 0X XX XX XX XX, etc. (fixe ou GSM)
 */
export function isValidBelgianPhone(raw: string): boolean {
  const cleaned = raw.replace(/[\s.\-()]/g, "");
  if (/^\+32[1-9]\d{7,8}$/.test(cleaned)) return true;
  if (/^0[1-9]\d{7,8}$/.test(cleaned)) return true;
  return false;
}

/**
 * Numéro de téléphone international (toute origine).
 *
 * Accepte :
 *   - Format international `+XX...` avec 7 à 15 chiffres au total après le +
 *   - Format national belge `0X...` (rétro-compatibilité)
 *
 * Pour les démarches belges, on tolère les numéros étrangers car certains
 * citoyens n'ont pas (encore) de numéro belge ou utilisent leur numéro
 * d'origine.
 */
export function isValidInternationalPhone(raw: string): boolean {
  const cleaned = raw.replace(/[\s.\-()]/g, "");
  // Format international +<indicatif><7-15 chiffres au total>
  if (/^\+[1-9]\d{6,14}$/.test(cleaned)) return true;
  // Format national belge en fallback
  if (/^0[1-9]\d{7,8}$/.test(cleaned)) return true;
  return false;
}

export function formatBelgianDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function isValidISODate(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const d = new Date(raw);
  return !isNaN(d.getTime());
}
