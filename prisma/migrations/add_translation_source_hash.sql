-- Migration additive : suivi de fraîcheur de la source FR sur ContentTranslation.
-- À appliquer via : npx prisma db execute --file prisma/migrations/add_translation_source_hash.sql

ALTER TABLE "ContentTranslation"
  ADD COLUMN IF NOT EXISTS "sourceHash" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceUpdatedAt" TIMESTAMP(3);
