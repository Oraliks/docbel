-- Additif uniquement. Appliquer avant RATE_LIMIT_BACKEND=postgres.
-- Aucune IP, URL, adresse email ou clé métier en clair dans cette table.
CREATE TABLE IF NOT EXISTS "RateLimitWindow" (
  "keyHash" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL CHECK ("count" > 0),
  "resetAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "RateLimitWindow_keyHash_format" CHECK ("keyHash" ~ '^[a-f0-9]{64}$')
);

-- Hors transaction : compatible avec une table déjà sollicitée.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "RateLimitWindow_resetAt_idx"
  ON "RateLimitWindow" ("resetAt");
