-- Page-builder: scheduled publishing + DB-backed reusable snippets.
-- Idempotent + additive: safe to (re)apply on the shared database.

ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "Snippet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "block" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Snippet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Snippet_createdAt_idx" ON "Snippet"("createdAt");
