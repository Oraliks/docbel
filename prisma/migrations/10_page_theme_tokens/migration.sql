-- Per-page theme tokens (palette/typography overrides) for the page builder.
-- Idempotent + additive: safe to (re)apply on the shared database.
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "themeTokens" JSONB;
