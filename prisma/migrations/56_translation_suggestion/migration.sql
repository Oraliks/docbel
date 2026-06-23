-- Migration 56 — TranslationSuggestion : corrections de traduction proposées
-- par les visiteurs (ou relues en interne), modérées par l'admin.
-- ADDITIVE & idempotente → sûre sur la base Neon partagée. Via `prisma db execute`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "TranslationSuggestion" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "model" TEXT,
    "recordId" TEXT,
    "field" TEXT,
    "uiKey" TEXT,
    "sourceText" TEXT NOT NULL,
    "currentText" TEXT,
    "suggestedText" TEXT NOT NULL,
    "comment" TEXT,
    "submittedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranslationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TranslationSuggestion_status_createdAt_idx"
    ON "TranslationSuggestion"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "TranslationSuggestion_model_recordId_field_locale_idx"
    ON "TranslationSuggestion"("model", "recordId", "field", "locale");
CREATE INDEX IF NOT EXISTS "TranslationSuggestion_uiKey_locale_idx"
    ON "TranslationSuggestion"("uiKey", "locale");
