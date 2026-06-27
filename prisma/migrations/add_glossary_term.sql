-- Migration additive : table GlossaryTerm (glossaire de traduction éditable).
-- À appliquer via : npx prisma db execute --file prisma/migrations/add_glossary_term.sql

CREATE TABLE IF NOT EXISTS "GlossaryTerm" (
  "id"        TEXT        NOT NULL,
  "term"      TEXT        NOT NULL,
  "strategy"  TEXT        NOT NULL DEFAULT 'translate_gloss',
  "glossFr"   TEXT        NOT NULL,
  "note"      TEXT,
  "category"  TEXT        NOT NULL DEFAULT '',
  "order"     INTEGER     NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GlossaryTerm_order_idx" ON "GlossaryTerm"("order");
