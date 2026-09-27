import { createHmac } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export interface RateLimitOptions { windowMs: number; max: number }
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  unavailable?: true;
}
export type RateLimitDatabase = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;
const DEFAULT_OPTIONS = { windowMs: 60_000, max: 10 };

export function unavailableRateLimit(now = Date.now()): RateLimitResult {
  return { ok: false, remaining: 0, resetAt: now + 5_000, unavailable: true };
}

function hashKey(key: string, options: RateLimitOptions, secret: string): string {
  if (!secret) throw new Error("Rate-limit key secret required");
  if (!Number.isSafeInteger(options.max) || options.max < 1 || options.max > 1_000_000 ||
      !Number.isSafeInteger(options.windowMs) || options.windowMs < 1 || options.windowMs > 2_147_483_647) {
    throw new Error("Invalid rate-limit options");
  }
  return createHmac("sha256", secret).update(JSON.stringify([1, key, options.windowMs, options.max])).digest("hex");
}

/** Fixed window, atomic across PostgreSQL clients and serverless instances. */
export function createPostgresRateLimiter(db: RateLimitDatabase, secret: string) {
  let callsUntilCleanup = 0;
  return async (key: string, options = DEFAULT_OPTIONS): Promise<RateLimitResult> => {
    try {
      const keyHash = hashKey(key, options, secret);
      // At most 64 expired rows per 32 requests, including the first request of
      // a cold instance. No timer, cron, raw identifiers or unbounded JS map.
      // Recheck resetAt in DELETE: a concurrent request may have renewed a row.
      if (callsUntilCleanup-- <= 0) {
        callsUntilCleanup = 31;
        await db.$executeRaw`
          WITH expired AS MATERIALIZED (
            SELECT "keyHash" FROM "RateLimitWindow"
            WHERE "resetAt" <= clock_timestamp()
            ORDER BY "resetAt" LIMIT 64 FOR UPDATE SKIP LOCKED
          )
          DELETE FROM "RateLimitWindow" AS target USING expired
          WHERE target."keyHash" = expired."keyHash"
            AND target."resetAt" <= clock_timestamp()
        `;
      }
      const rows = await db.$queryRaw<Array<{ count: number; resetAtMs: bigint }>>`
        WITH tick AS (SELECT clock_timestamp() AS now)
        INSERT INTO "RateLimitWindow" ("keyHash", "count", "resetAt")
        SELECT ${keyHash}, 1, tick.now + (${options.windowMs} * interval '1 millisecond') FROM tick
        ON CONFLICT ("keyHash") DO UPDATE SET
          "count" = CASE WHEN "RateLimitWindow"."resetAt" <= (SELECT now FROM tick)
            THEN 1 ELSE LEAST("RateLimitWindow"."count" + 1, ${options.max + 1}) END,
          "resetAt" = CASE WHEN "RateLimitWindow"."resetAt" <= (SELECT now FROM tick)
            THEN (SELECT now FROM tick) + (${options.windowMs} * interval '1 millisecond')
            ELSE "RateLimitWindow"."resetAt" END
        RETURNING "count", (EXTRACT(EPOCH FROM "resetAt") * 1000)::bigint AS "resetAtMs"
      `;
      if (rows.length !== 1) return unavailableRateLimit();
      const { count, resetAtMs } = rows[0];
      return { ok: count <= options.max, remaining: Math.max(0, options.max - count), resetAt: Number(resetAtMs) };
    } catch {
      // Never silently fall back to per-instance memory on a backend failure.
      // Existing callers turn this into their established controlled 429.
      return unavailableRateLimit();
    }
  };
}

/** Explicit local/test backend. Full capacity refuses new keys instead of
 * evicting active buckets (eviction would let an attacker reset their quota). */
export function createMemoryRateLimiter(secret: string, capacity = 10_000, now = Date.now) {
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error("Invalid rate-limit capacity");
  const buckets = new Map<string, { count: number; resetAt: number }>();
  let nextExpiry = Infinity;
  return {
    get size() { return buckets.size; },
    async check(key: string, options = DEFAULT_OPTIONS): Promise<RateLimitResult> {
      const timestamp = now();
      try {
        const keyHash = hashKey(key, options, secret);
        if (timestamp >= nextExpiry) {
          nextExpiry = Infinity;
          for (const [hash, bucket] of buckets) {
            if (bucket.resetAt <= timestamp) buckets.delete(hash);
            else nextExpiry = Math.min(nextExpiry, bucket.resetAt);
          }
        }
        let bucket = buckets.get(keyHash);
        if (!bucket) {
          if (buckets.size >= capacity) return { ok: false, remaining: 0, resetAt: nextExpiry, unavailable: true };
          bucket = { count: 0, resetAt: timestamp + options.windowMs };
          buckets.set(keyHash, bucket);
          nextExpiry = Math.min(nextExpiry, bucket.resetAt);
        }
        bucket.count = Math.min(bucket.count + 1, options.max + 1);
        return { ok: bucket.count <= options.max, remaining: Math.max(0, options.max - bucket.count), resetAt: bucket.resetAt };
      } catch {
        return unavailableRateLimit(timestamp);
      }
    },
  };
}
