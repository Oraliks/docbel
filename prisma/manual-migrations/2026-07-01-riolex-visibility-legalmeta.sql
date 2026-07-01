-- Migration additive (RioLex corpus légal) — appliquée via `prisma db execute`,
-- JAMAIS via `prisma db push` (destructif pour pgvector + tables PDF sur Neon partagée).
-- Idempotente : réexécutable sans effet de bord.
--
-- 1) Colonne de visibilité pour le gating d'accès (défaut 'public' => aucune source
--    existante ne change de comportement).
ALTER TABLE "KnowledgeSource"
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'public';

-- 2) Métadonnées juridiques (n° article, loi, nature, dates EV/MB, statut, riolexId,
--    version, refs, isOnemCommentary). Nullable => pas d'impact sur l'existant.
ALTER TABLE "KnowledgeSource"
  ADD COLUMN IF NOT EXISTS "legalMeta" JSONB;

-- 3) Index pour filtrer efficacement par (domaine, visibilité) au retrieval et
--    dans l'app de recherche partenaire.
CREATE INDEX IF NOT EXISTS "KnowledgeSource_domain_visibility_idx"
  ON "KnowledgeSource" ("domain", "visibility");
