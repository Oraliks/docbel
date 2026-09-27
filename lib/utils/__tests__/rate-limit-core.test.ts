import { describe, expect, it, vi } from "vitest";
import { createMemoryRateLimiter, createPostgresRateLimiter, type RateLimitDatabase } from "../rate-limit-core";

const secret = "rate-limit-fixture-secret-not-production";

describe("rate limiting local explicite et borné", () => {
  it("accepte exactement le plafond, même sous appels concurrents", async () => {
    const limiter = createMemoryRateLimiter(secret);
    const results = await Promise.all(Array.from({ length: 100 }, () => limiter.check("198.51.100.7", { windowMs: 1_000, max: 12 })));
    expect(results.filter((result) => result.ok)).toHaveLength(12);
    expect(results.every((result) => result.remaining >= 0)).toBe(true);
  });

  it("expire à la borne exacte sans prolonger une fenêtre refusée", async () => {
    let now = 1_000;
    const limiter = createMemoryRateLimiter(secret, 10, () => now);
    const options = { windowMs: 100, max: 1 };
    expect(await limiter.check("key", options)).toMatchObject({ ok: true, resetAt: 1_100 });
    now = 1_099;
    expect(await limiter.check("key", options)).toMatchObject({ ok: false, resetAt: 1_100 });
    now = 1_100;
    expect(await limiter.check("key", options)).toMatchObject({ ok: true, resetAt: 1_200 });
  });

  it("borne la mémoire sans évincer les fenêtres actives", async () => {
    let now = 1_000;
    const limiter = createMemoryRateLimiter(secret, 32, () => now);
    const options = { windowMs: 100, max: 1 };
    for (let i = 0; i < 2_000; i++) {
      const result = await limiter.check(`ip-${i}`, options);
      expect(result.ok).toBe(i < 32);
    }
    expect(limiter.size).toBe(32);
    expect((await limiter.check("ip-0", options)).ok).toBe(false);
    now += 100;
    expect((await limiter.check("new-ip", options)).ok).toBe(true);
    expect(limiter.size).toBe(1);
  });

  it("sépare les fenêtres/plafonds et refuse les paramètres invalides", async () => {
    const limiter = createMemoryRateLimiter(secret);
    expect((await limiter.check("key", { windowMs: 100, max: 1 })).ok).toBe(true);
    expect((await limiter.check("key", { windowMs: 200, max: 1 })).ok).toBe(true);
    expect(await limiter.check("key", { windowMs: 0, max: 1 })).toMatchObject({ ok: false, unavailable: true });
    expect(await createMemoryRateLimiter("").check("key")).toMatchObject({ ok: false, unavailable: true });
  });
});

describe("rate limiting PostgreSQL — confidentialité et erreurs", () => {
  it("n'envoie au SQL que le HMAC, jamais la clé contenant l'IP", async () => {
    const query = vi.fn().mockResolvedValue([{ count: 1, resetAtMs: BigInt(12_345) }]);
    const execute = vi.fn().mockResolvedValue(0);
    const db = { $queryRaw: query, $executeRaw: execute } as unknown as RateLimitDatabase;
    const result = await createPostgresRateLimiter(db, secret)("contact:198.51.100.7");
    expect(result).toEqual({ ok: true, remaining: 9, resetAt: 12_345 });
    expect(query.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(query.mock.calls)).not.toContain("198.51.100.7");
  });

  it("refuse une panne DB sans basculer en mémoire", async () => {
    const db = {
      $executeRaw: vi.fn().mockRejectedValue(new Error("Database unavailable")),
      $queryRaw: vi.fn().mockRejectedValue(new Error("Database unavailable")),
    } as unknown as RateLimitDatabase;
    const limiter = createPostgresRateLimiter(db, secret);
    for (let i = 0; i < 3; i++) expect(await limiter("key")).toMatchObject({ ok: false, remaining: 0, unavailable: true });
  });
});
