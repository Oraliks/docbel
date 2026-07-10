-- Historique de santé /api/health (monitoring Part D).
-- ADDITIF et idempotent — appliqué via `prisma db execute` (JAMAIS db push).
CREATE TABLE IF NOT EXISTS "ApiHealthSnapshot" (
  "id"          TEXT PRIMARY KEY,
  "status"      TEXT NOT NULL,
  "dbUp"        BOOLEAN NOT NULL,
  "dbLatencyMs" INTEGER,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ApiHealthSnapshot_createdAt_idx"
  ON "ApiHealthSnapshot" ("createdAt" DESC);
