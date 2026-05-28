import { createHmac, timingSafeEqual, createHash } from "crypto";

// --- Hash ---

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

// --- Rate limit (en mémoire, par instance) ---
// ⚠️ Sur un déploiement multi-instance / serverless (Vercel), remplacer par
// un store partagé (Upstash/Redis). Voir RATE_LIMIT_REDIS_URL.

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  opts: { windowMs: number; max: number } = { windowMs: 60_000, max: 10 }
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: opts.max - 1, resetAt };
  }
  b.count++;
  if (b.count > opts.max) return { ok: false, remaining: 0, resetAt: b.resetAt };
  return { ok: true, remaining: opts.max - b.count, resetAt: b.resetAt };
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

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
