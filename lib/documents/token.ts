import { createHmac, timingSafeEqual, createHash } from "crypto";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

function getSecret(): string {
  const s =
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!s) {
    throw new Error(
      "Aucun secret d'auth configuré (BETTER_AUTH_SECRET / AUTH_SECRET) pour signer les tokens"
    );
  }
  return s;
}

export function signDownloadToken(
  generatedId: string,
  expiresInSec = DEFAULT_TTL_SECONDS
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const payload = `${generatedId}:${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${exp}.${sig}`;
}

export function verifyDownloadToken(generatedId: string, token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${generatedId}:${exp}`;
  const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
