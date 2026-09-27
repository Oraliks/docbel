import {
  createMemoryRateLimiter,
  createPostgresRateLimiter,
  unavailableRateLimit,
  type RateLimitOptions,
  type RateLimitResult,
} from "./rate-limit-core";

export type { RateLimitOptions, RateLimitResult } from "./rate-limit-core";

let postgres: Promise<ReturnType<typeof createPostgresRateLimiter>> | undefined;
let memory: ReturnType<typeof createMemoryRateLimiter> | undefined;

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions = { windowMs: 60_000, max: 10 }
): Promise<RateLimitResult> {
  try {
    const backend = process.env.RATE_LIMIT_BACKEND ?? (process.env.NODE_ENV === "test" ? "memory" : undefined);
    const secret = process.env.RATE_LIMIT_KEY_SECRET || process.env.BETTER_AUTH_SECRET;
    if (!secret) return unavailableRateLimit();
    if (backend === "postgres") {
      // Lazy loading keeps pure PDF signing/hashing consumers independent of DB.
      postgres ??= import("@/lib/prisma").then(({ prisma }) => createPostgresRateLimiter(prisma, secret));
      return await (await postgres)(key, options);
    }
    if (backend === "memory" && !process.env.VERCEL &&
        (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
      memory ??= createMemoryRateLimiter(secret);
      return await memory.check(key, options);
    }
    // Missing/invalid configuration, production memory and Vercel memory all
    // fail closed. Deployment must install the SQL table before setting flag.
    return unavailableRateLimit();
  } catch {
    postgres = undefined;
    return unavailableRateLimit();
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
