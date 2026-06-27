-- Migration additive : file d'attente durable de traduction (TranslationJob).
-- À appliquer via : npx prisma db execute --file prisma/migrations/add_translation_job.sql

CREATE TABLE IF NOT EXISTS "TranslationJob" (
  "id"         TEXT         NOT NULL,
  "model"      TEXT         NOT NULL,
  "recordId"   TEXT         NOT NULL,
  "field"      TEXT         NOT NULL,
  "locale"     TEXT         NOT NULL,
  "sourceHash" TEXT         NOT NULL,
  "status"     TEXT         NOT NULL DEFAULT 'pending',
  "attempts"   INTEGER      NOT NULL DEFAULT 0,
  "lastError"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TranslationJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TranslationJob_model_recordId_field_locale_sourceHash_key"
  ON "TranslationJob"("model", "recordId", "field", "locale", "sourceHash");

CREATE INDEX IF NOT EXISTS "TranslationJob_status_createdAt_idx"
  ON "TranslationJob"("status", "createdAt");
