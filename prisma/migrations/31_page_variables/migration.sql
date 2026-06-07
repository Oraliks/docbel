-- Page-builder: reusable page-level variables (define once, reference via {{key}}).
-- Idempotent + additive: safe to (re)apply on the shared database.

ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "variables" JSONB;
