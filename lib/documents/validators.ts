export function isValidNISS(raw: string): boolean {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 11) return false;

  const base = digits.slice(0, 9);
  const check = parseInt(digits.slice(9, 11), 10);

  // Avant 2000
  const before = 97 - (parseInt(base, 10) % 97);
  if (before === check) return true;

  // À partir de 2000 → préfixer par "2"
  const after = 97 - (parseInt("2" + base, 10) % 97);
  return after === check;
}

export function isValidBelgianIBAN(raw: string): boolean {
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^BE\d{14}$/.test(cleaned)) return false;

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
 * Numéro de téléphone belge.
 * Accepte : +32 X XX XX XX, 0X XX XX XX XX, etc. (fixe ou GSM)
 * Format final attendu : 9 chiffres après l'indicatif (10 avec le 0 initial).
 */
export function isValidBelgianPhone(raw: string): boolean {
  const cleaned = raw.replace(/[\s.\-()]/g, "");
  // Forme internationale +32 puis 8 ou 9 chiffres (sans le 0 initial)
  if (/^\+32[1-9]\d{7,8}$/.test(cleaned)) return true;
  // Forme nationale 0X... (10 chiffres total pour fixe/GSM)
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
