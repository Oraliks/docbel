import { describe, expect, it } from "vitest";
import { rateLimitHeaders, tooManyRequests } from "../rate-limit-response";

describe("rateLimitHeaders", () => {
  it("émet X-RateLimit-* et Retry-After (secondes, arrondi haut)", () => {
    const resetAt = Date.now() + 4200; // ~4.2 s
    const h = rateLimitHeaders({ limit: 10, remaining: 3, resetAt });
    expect(h["X-RateLimit-Limit"]).toBe("10");
    expect(h["X-RateLimit-Remaining"]).toBe("3");
    expect(Number(h["Retry-After"])).toBeGreaterThanOrEqual(4);
    expect(Number(h["Retry-After"])).toBeLessThanOrEqual(5);
  });
  it("Retry-After jamais négatif si resetAt est passé", () => {
    const h = rateLimitHeaders({ limit: 5, remaining: 0, resetAt: Date.now() - 1000 });
    expect(Number(h["Retry-After"])).toBe(0);
  });
});

describe("tooManyRequests", () => {
  it("renvoie 429 avec Retry-After et un body {error}", async () => {
    const res = tooManyRequests({ limit: 5, resetAt: Date.now() + 2000 });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    const b = JSON.parse(await res.text());
    expect(typeof b.error).toBe("string");
  });
});
