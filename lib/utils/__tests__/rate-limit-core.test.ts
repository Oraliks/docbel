import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRateLimiter, createPostgresRateLimiter, type RateLimitDatabase } from "../rate-limit-core";
import { rateLimitHeaders } from "../../api/rate-limit-response";

const secret = "rate-limit-fixture-secret-not-production";
afterEach(() => vi.restoreAllMocks());

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
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const query = vi.fn().mockResolvedValue([{ count: 1, remainingMs: BigInt(12_345) }]);
    const execute = vi.fn().mockResolvedValue(0);
    const db = { $queryRaw: query, $executeRaw: execute } as unknown as RateLimitDatabase;
    const result = await createPostgresRateLimiter(db, secret)("contact:198.51.100.7");
    expect(result).toEqual({ ok: true, remaining: 9, resetAt: 1_012_345 });
    expect(query.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(query.mock.calls)).not.toContain("198.51.100.7");
  });

  it.each([-385_000, 385_000])("traduit la durée DB malgré un décalage d'horloge app de %i ms", async (clockSkew) => {
    const databaseNow = 1_790_546_000_000;
    const appNow = databaseNow + clockSkew;
    vi.spyOn(Date, "now").mockReturnValue(appNow);
    const db = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockResolvedValue([{ count: 4, remainingMs: BigInt(9_750) }]),
    } as unknown as RateLimitDatabase;
    const result = await createPostgresRateLimiter(db, secret)("auth:fixture", { max: 3, windowMs: 10_000 });
    expect(result).toEqual({ ok: false, remaining: 0, resetAt: appNow + 9_750 });
    const headers = rateLimitHeaders({ limit: 3, remaining: result.remaining, resetAt: result.resetAt });
    expect(headers["Retry-After"]).toBe("10");
    expect(headers["X-RateLimit-Reset"]).toBe(String(Math.floor((appNow + 9_750) / 1_000)));
  });

  it("prend l'heure app après réception SQL, sans raccourcir le délai à cause de la latence", async () => {
    let appNow = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => appNow);
    const db = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockImplementation(async () => {
        appNow += 400; // Transport/réception après le calcul de durée SQL.
        return [{ count: 4, remainingMs: BigInt(500) }];
      }),
    } as unknown as RateLimitDatabase;
    const result = await createPostgresRateLimiter(db, secret)("fixture", { max: 3, windowMs: 10_000 });
    expect(result).toEqual({ ok: false, remaining: 0, resetAt: 1_900 });
  });

  it("laisse PostgreSQL décider du refus puis du renouvellement à expiration", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const db = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ count: 4, remainingMs: BigInt(0) }])
        .mockResolvedValueOnce([{ count: 1, remainingMs: BigInt(10_000) }]),
    } as unknown as RateLimitDatabase;
    const limiter = createPostgresRateLimiter(db, secret);
    const options = { max: 3, windowMs: 10_000 };
    expect(await limiter("fixture", options)).toEqual({ ok: false, remaining: 0, resetAt: 1_000 });
    now.mockReturnValue(500); // Une correction de l'horloge app ne décide pas du quota.
    expect(await limiter("fixture", options)).toEqual({ ok: true, remaining: 2, resetAt: 10_500 });
  });

  it.each([
    { count: 1, remainingMs: BigInt(-1) },
    { count: 1, remainingMs: BigInt(10_001) },
    { count: 1, remainingMs: BigInt(Number.MAX_SAFE_INTEGER) },
    { count: 1, remainingMs: "1000" },
    { count: 1, remainingMs: NaN },
    { count: 1 },
    { count: 0, remainingMs: BigInt(1_000) },
    { count: 5, remainingMs: BigInt(1_000) },
    { count: 1.5, remainingMs: BigInt(1_000) },
    { count: NaN, remainingMs: BigInt(1_000) },
  ])("refuse une réponse SQL invalide sans réinterpréter ses valeurs (%#)", async (row) => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    const db = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockResolvedValue([row]),
    } as unknown as RateLimitDatabase;
    expect(await createPostgresRateLimiter(db, secret)("fixture", { max: 3, windowMs: 10_000 }))
      .toEqual({ ok: false, remaining: 0, resetAt: 6_000, unavailable: true });
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
