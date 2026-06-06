// Chiffrement réversible du NRN (AES-256-GCM) pour stockage au repos.
// Le NRN est conservé chiffré et n'est déchiffré qu'à la demande, côté serveur,
// pour l'affichage aux agents autorisés (vérification du dossier). À distinguer
// de `hashNrn` (dedupe.ts) qui est un HMAC à sens unique pour le dédoublonnage.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SECRET =
  process.env.BOOKING_NRN_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  "docbel-booking-nrn-fallback";

// Clé 32 octets dérivée du secret (AES-256).
const KEY = createHash("sha256").update(SECRET).digest();
const IV_LEN = 12; // GCM standard
const TAG_LEN = 16;

/** Chiffre un NRN (chiffres) → base64(iv | tag | ciphertext). */
export function encryptNrn(nrnDigits: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(nrnDigits, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Déchiffre une valeur produite par encryptNrn ; null si invalide/absente. */
export function decryptNrn(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Met en forme un NRN belge "85051512383" → "85.05.15-123.83". */
export function formatNrn(digits: string): string {
  return digits.replace(/^(\d{2})(\d{2})(\d{2})(\d{3})(\d{2})$/, "$1.$2.$3-$4.$5");
}
