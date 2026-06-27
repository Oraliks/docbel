-- Migration additive : origin sur ContentTranslation + table d'historique
-- À appliquer via : npx prisma db execute --file prisma/migrations/add_translation_origin_history.sql

ALTER TABLE "ContentTranslation"
  ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'ia';

CREATE TABLE IF NOT EXISTS "ContentTranslationHistory" (
  "id"            TEXT        NOT NULL,
  "translationId" TEXT        NOT NULL,
  "oldValue"      TEXT        NOT NULL DEFAULT '',
  "newValue"      TEXT        NOT NULL,
  "oldStatus"     TEXT        NOT NULL,
  "newStatus"     TEXT        NOT NULL,
  "origin"        TEXT        NOT NULL DEFAULT 'human',
  "editedBy"      TEXT        NOT NULL,
  "editedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentTranslationHistory_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ContentTranslationHistory_translationId_fkey'
  ) THEN
    ALTER TABLE "ContentTranslationHistory"
      ADD CONSTRAINT "ContentTranslationHistory_translationId_fkey"
      FOREIGN KEY ("translationId")
      REFERENCES "ContentTranslation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ContentTranslationHistory_translationId_idx"
  ON "ContentTranslationHistory"("translationId");

CREATE INDEX IF NOT EXISTS "ContentTranslationHistory_editedAt_idx"
  ON "ContentTranslationHistory"("editedAt");
