-- Migration 31 — Numéro de TVA sur le compte (employeurs).
--
-- ⚠️ Appliquée via `prisma db execute` (base Neon partagée) — additif &
-- idempotent. Colonne nullable + index unique (les NULL multiples sont
-- autorisés par Postgres, donc partenaires/citoyens/admins non affectés).
--
-- Cf. normalizeBelgianTVA() dans lib/documents/validators.ts.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vatNumber" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_vatNumber_key" ON "User"("vatNumber");
