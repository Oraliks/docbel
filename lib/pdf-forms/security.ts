import { createHmac, timingSafeEqual, createHash } from "crypto";

// --- Hash ---

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

// Même compteur partagé que les autres routes : aucun store PDF indépendant.
export { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

// --- Tokens de téléchargement signés (one-shot, courte durée) ---

function getSecret(): string {
  const s =
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("Aucun secret d'auth configuré pour signer les tokens PDF Forms");
  return s;
}

const DEFAULT_TTL = 60 * 10; // 10 minutes

/// Signe un token lié à un identifiant (ex. id de log de soumission) + TTL.
export function signToken(id: string, ttlSec = DEFAULT_TTL): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = createHmac("sha256", getSecret()).update(`${id}:${exp}`).digest("base64url");
  return `${exp}.${sig}`;
}

export function verifyToken(id: string, token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const exp = parseInt(parts[0], 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", getSecret()).update(`${id}:${exp}`).digest("base64url");
  try {
    const a = Buffer.from(parts[1]);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
