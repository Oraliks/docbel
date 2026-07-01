-- Migration additive (RioLex — recherche plein texte) — via `prisma db execute`,
-- JAMAIS `prisma db push`. Idempotente.
--
-- Colonne tsvector GÉNÉRÉE (français) sur title+content, maintenue automatiquement
-- par Postgres (STORED). Gardée hors schema.prisma (comme la colonne `embedding
-- vector(1536)`), exploitée en raw SQL par l'app de recherche partenaire.
ALTER TABLE "KnowledgeSource"
  ADD COLUMN IF NOT EXISTS "contentTsv" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('french', coalesce("title", '') || ' ' || coalesce("content", ''))
  ) STORED;

-- Index GIN pour la recherche plein texte performante.
CREATE INDEX IF NOT EXISTS "KnowledgeSource_contentTsv_idx"
  ON "KnowledgeSource" USING GIN ("contentTsv");
