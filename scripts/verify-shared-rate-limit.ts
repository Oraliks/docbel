/** Real PostgreSQL integration. Dedicated marked DB only; no dotenv loading. */
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { PrismaClient, Prisma } from "@prisma/client";
import { createPostgresRateLimiter, createMemoryRateLimiter } from "../lib/utils/rate-limit-core";

async function main() {
  const url = process.env.DOCBEL_ACCESS_TEST_DATABASE_URL;
  const name = process.env.DOCBEL_ACCESS_TEST_DATABASE_NAME;
  assert(url && name && /^docbel_audit_access_[a-z0-9_]+$/.test(name), "Dedicated access database required");
  assert.equal(decodeURIComponent(new URL(url).pathname.slice(1)), name);
  const dbA = new PrismaClient({ datasources: { db: { url } } });
  const dbB = new PrismaClient({ datasources: { db: { url } } });
  const secret = `fixture-${randomUUID()}`;
  const keys: string[] = [];
  const keyHash = (key: string, options: { windowMs: number; max: number }) => {
    const value = createHmac("sha256", secret).update(JSON.stringify([1, key, options.windowMs, options.max])).digest("hex");
    keys.push(value);
    return value;
  };
  let isolated = false;
  try {
    const actual = await dbA.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(actual[0]?.name, name);
    const markers = await dbA.$queryRaw<Array<{ purpose: string }>>`SELECT "purpose" FROM "_DocbelAuditIsolation" WHERE "purpose" = ${"access-http-20260927"} LIMIT 1`;
    assert.equal(markers[0]?.purpose, "access-http-20260927");
    isolated = true;
    const limiterA = createPostgresRateLimiter(dbA, secret);
    const limiterB = createPostgresRateLimiter(dbB, secret);
    const options = { windowMs: 60_000, max: 12 };
    const key = `fixture-${randomUUID()}:198.51.100.7`;
    const hashed = keyHash(key, options);
    const results = await Promise.all(Array.from({ length: 100 }, (_, i) => (i % 2 ? limiterA : limiterB)(key, options)));
    assert.equal(results.filter((result) => result.ok).length, 12, "Shared ceiling must admit exactly 12 of 100 requests");
    assert(results.every((result) => !result.unavailable), "Unexpected backend error during concurrency test");
    const rows = await dbA.$queryRaw<Array<{ keyHash: string; count: number; resetAt: Date }>>`SELECT * FROM "RateLimitWindow" WHERE "keyHash" = ${hashed}`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].count, 13, "Denied counts saturate at max+1");
    assert.match(rows[0].keyHash, /^[a-f0-9]{64}$/);
    assert(!JSON.stringify(rows).includes("198.51.100.7"));
    assert.equal(new Set(results.map((result) => result.resetAt)).size, 1);
    console.log("PASS 2 independent Prisma clients: exactly 12 allowed / 100 concurrent requests, one shared row, counter saturated");
    console.log("PASS Only opaque HMAC key, count and expiration persisted; no clear IP");

    const shortOptions = { windowMs: 300, max: 1 };
    const shortKey = `expiry-${randomUUID()}`;
    keyHash(shortKey, shortOptions);
    const first = await limiterA(shortKey, shortOptions);
    assert(first.ok);
    await setTimeout(500);
    const after = await limiterB(shortKey, shortOptions);
    assert(after.ok && after.resetAt > first.resetAt, "Expired window must restart across clients");
    console.log("PASS Real elapsed expiration restarts the window through the other client");

    const expired = Array.from({ length: 70 }, (_, i) => keyHash(`expired-${randomUUID()}-${i}`, options));
    const sweepKey = `sweep-${randomUUID()}`;
    keyHash(sweepKey, options);
    // Keep these fixtures invisible to concurrent application cleanup until
    // the assertion completes, while exercising the same real SQL helper.
    await dbA.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`INSERT INTO "RateLimitWindow" ("keyHash", "count", "resetAt") VALUES ${Prisma.join(expired.map((value) => Prisma.sql`(${value}, 1, clock_timestamp() - interval '1 day')`))}`);
      assert((await createPostgresRateLimiter(tx, secret)(sweepKey, options)).ok);
      const remaining = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) AS count FROM "RateLimitWindow" WHERE "keyHash" IN (${Prisma.join(expired)})`);
      assert.equal(Number(remaining[0].count), 6, "Cleanup must remove exactly its 64-row bound");
    });
    console.log("PASS Expired-row cleanup is bounded: 64 removed out of 70 fixtures");

    const failureKey = `failure-${randomUUID()}`;
    keyHash(failureKey, { windowMs: 60_000, max: 10 });
    await dbB.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const failed = await createPostgresRateLimiter(tx, secret)(failureKey);
      assert(!failed.ok && failed.unavailable && failed.remaining === 0);
    });
    console.log("PASS Real SQL rejection in a read-only transaction causes controlled refusal, without memory fallback");

    let timestamp = 0;
    const local = createMemoryRateLimiter(secret, 32, () => timestamp);
    for (let i = 0; i < 2_000; i++) {
      const result = await local.check(`local-${i}`, { windowMs: 100, max: 1 });
      assert.equal(result.ok, i < 32);
    }
    assert.equal(local.size, 32);
    assert(!(await local.check("local-0", { windowMs: 100, max: 1 })).ok);
    timestamp = 100;
    assert((await local.check("new", { windowMs: 100, max: 1 })).ok);
    assert.equal(local.size, 1);
    console.log("PASS Explicit local memory stays at 32 entries under 2000 keys, no active-bucket eviction, expiry frees capacity");
  } finally {
    if (isolated && keys.length) await dbA.$executeRaw(Prisma.sql`DELETE FROM "RateLimitWindow" WHERE "keyHash" IN (${Prisma.join(keys)})`);
    await Promise.all([dbA.$disconnect(), dbB.$disconnect()]);
    console.log("Fixture cleanup completed");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Rate-limit integration failed");
  process.exitCode = 1;
});
