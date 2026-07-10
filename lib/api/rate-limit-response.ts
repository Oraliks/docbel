/// Standardise les en-têtes de rate-limiting. Le limiter existant
/// (lib/utils/rate-limit.ts) renvoie { ok, remaining, resetAt } mais aucune
/// route n'émet Retry-After ni X-RateLimit-* : ces helpers comblent ça.

import { apiError } from "./response";

export function rateLimitHeaders(input: {
  limit: number;
  remaining: number;
  resetAt: number;
}): Record<string, string> {
  const retryAfterSec = Math.max(0, Math.ceil((input.resetAt - Date.now()) / 1000));
  return {
    "X-RateLimit-Limit": String(input.limit),
    "X-RateLimit-Remaining": String(Math.max(0, input.remaining)),
    "X-RateLimit-Reset": String(Math.floor(input.resetAt / 1000)),
    "Retry-After": String(retryAfterSec),
  };
}

export function tooManyRequests(input: {
  limit: number;
  resetAt: number;
  message?: string;
}) {
  return apiError(429, input.message ?? "Trop de requêtes, réessayez plus tard.", {
    code: "rate_limited",
    headers: rateLimitHeaders({ limit: input.limit, remaining: 0, resetAt: input.resetAt }),
  });
}
