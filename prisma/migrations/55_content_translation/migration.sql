-- Migration 55 — ContentTranslation : traductions du contenu DB poussé au front.
-- ADDITIVE & idempotente (CREATE ... IF NOT EXISTS) → sûre sur la base Neon
-- partagée. Appliquée via `prisma db execute` (jamais `db push`).

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContentTranslation" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ia',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unicité : une valeur par model+record+field+locale)
CREATE UNIQUE INDEX IF NOT EXISTS "ContentTranslation_model_recordId_field_locale_key"
    ON "ContentTranslation"("model", "recordId", "field", "locale");

-- CreateIndex (lecture batch par enregistrement + locale)
CREATE INDEX IF NOT EXISTS "ContentTranslation_model_recordId_locale_idx"
    ON "ContentTranslation"("model", "recordId", "locale");
