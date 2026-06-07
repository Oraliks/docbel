-- Page-builder: store form-block submissions in the DB (+ admin dashboard).
-- Idempotent + additive: safe to (re)apply on the shared database.

CREATE TABLE IF NOT EXISTS "FormSubmission" (
  "id" TEXT NOT NULL,
  "source" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FormSubmission_createdAt_idx" ON "FormSubmission" ("createdAt");
