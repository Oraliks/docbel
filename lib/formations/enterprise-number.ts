/**
 * Numéro d'entreprise belge (BCE / KBO) — pont entre les deux formes
 * canoniques déjà utilisées dans le projet :
 *   - TVA   : "BE0123456789"  (`User.vatNumber`, cf. lib/pdf-forms/validators)
 *   - BCE   : "0123456789"    (`KboEnterprise.enterpriseNumber`,
 *                              `FormationOrganization.enterpriseNumber`)
 *
 * Le checksum mod-97 N'EST PAS réimplémenté ici : on délègue à
 * `normalizeBelgianTVA()` (lib/pdf-forms/validators), source de vérité du
 * projet. Ce module ajoute la conversion vers 10 chiffres + l'affichage,
 * qui n'existaient nulle part en une seule fonction.
 *
 * Module PUR (client + serveur, aucune I/O), testable seul.
 */
import { normalizeBelgianTVA, isValidBelgianTVA } from "@/lib/pdf-forms/validators";

/**
 * Retire tout sauf les chiffres (préfixe BE ignoré) et complète l'ancien
 * format à 9 chiffres. NE valide PAS le checksum — cf. `parseEnterpriseNumber`.
 */
export function normalizeEnterpriseNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/^\s*BE/i, "").replace(/\D/g, "");
  if (digits.length === 0) return null;
  // Ancien format à 9 chiffres → 0 en tête.
  const padded = digits.length === 9 ? `0${digits}` : digits;
  if (padded.length !== 10) return null;
  return padded;
}

/** Valide le checksum mod-97 (délègue au validateur canonique du projet). */
export function isValidEnterpriseChecksum(normalized: string): boolean {
  if (!/^\d{10}$/.test(normalized)) return false;
  return isValidBelgianTVA(normalized);
}

export interface EnterpriseNumberResult {
  ok: boolean;
  /** Forme canonique 10 chiffres, ou null si non normalisable. */
  normalized: string | null;
  /** Forme d'affichage "0123.456.789", ou null. */
  formatted: string | null;
  /** Forme TVA "BE0123456789", ou null. */
  vat: string | null;
  reason?: "empty" | "length" | "checksum";
}

/**
 * Normalise + valide un numéro d'entreprise saisi librement.
 * La validation du checksum passe par `normalizeBelgianTVA()` (canonique) ;
 * on en dérive les 3 formes utiles (10 chiffres, affichage, TVA).
 */
export function parseEnterpriseNumber(input: string | null | undefined): EnterpriseNumberResult {
  const normalized = normalizeEnterpriseNumber(input);
  if (!normalized) {
    const empty = !input || input.replace(/\D/g, "").length === 0;
    return {
      ok: false,
      normalized: null,
      formatted: null,
      vat: null,
      reason: empty ? "empty" : "length",
    };
  }
  const vat = normalizeBelgianTVA(normalized);
  if (!vat) {
    return {
      ok: false,
      normalized,
      formatted: formatEnterpriseNumber(normalized),
      vat: null,
      reason: "checksum",
    };
  }
  return {
    ok: true,
    normalized,
    formatted: formatEnterpriseNumber(normalized),
    vat,
  };
}

/** "0123456789" → "0123.456.789". */
export function formatEnterpriseNumber(normalized: string): string {
  if (!/^\d{10}$/.test(normalized)) return normalized;
  return `${normalized.slice(0, 4)}.${normalized.slice(4, 7)}.${normalized.slice(7, 10)}`;
}
