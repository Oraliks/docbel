-- Migration 19 — Chômage IA : RAG sémantique avec pgvector
--
-- Ajoute le socle DB du retrieval augmenté par embeddings (RAG) :
--   * Extension `vector` (pgvector) — supporté nativement par Neon.
--   * Table `KnowledgeChunk` : chunks de ~1000 chars d'une `KnowledgeSource`
--     avec leur embedding (vector(1536), nullable).
--     - `contentHash` (sha256) permet de skipper la ré-indexation d'un chunk
--       inchangé entre deux runs.
--     - `embedDim` et `embedModel` autorisent un mix de modèles dans la KB
--       (ex. migration progressive Voyage → OpenAI ou vice versa).
--   * Index ivfflat (cosine) sur `embedding` pour la recherche vectorielle.
--   * Colonnes de tracking sur `KnowledgeSource` :
--       - `indexedAt` (timestamp du dernier indexing réussi)
--       - `indexError` (dernier message d'erreur, null si OK)
--
-- IMPORTANT :
--   * Cette migration N'EST PAS appliquée automatiquement (workflow projet :
--     on garde les migrations en attente d'application manuelle pour éviter
--     les désynchros entre dev/staging/prod).
--   * Avant `prisma migrate resolve --applied 19_…`, vérifier que la version
--     Postgres supporte bien pgvector (Neon le fait nativement depuis ~2024,
--     mais peut être désactivé sur certains plans).
--   * La colonne `embedding` est déclarée nullable : l'indexer fail-soft peut
--     créer le chunk même si l'embed échoue, pour ne pas bloquer le pipeline.

-- Active l'extension pgvector (no-op si déjà activée).
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- KnowledgeChunk
-- ============================================================================

CREATE TABLE "KnowledgeChunk" (
    "id"          TEXT NOT NULL,
    "sourceId"    TEXT NOT NULL,
    "chunkIndex"  INTEGER NOT NULL,
    "content"     TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding"   vector(1536),
    "embedDim"    INTEGER NOT NULL,
    "embedModel"  TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeChunk_sourceId_chunkIndex_idx"
    ON "KnowledgeChunk"("sourceId", "chunkIndex");
CREATE INDEX "KnowledgeChunk_embedModel_idx"
    ON "KnowledgeChunk"("embedModel");

-- Index ivfflat (cosine) — lists=100 est un bon défaut jusqu'à ~10k chunks.
-- Pour une KB plus grande, monter à lists=sqrt(nb_chunks). Le SQL `<=>` mesure
-- la distance cosine (0 = identique, 2 = opposé), donc ORDER BY ASC = plus proche.
CREATE INDEX "KnowledgeChunk_embedding_idx"
    ON "KnowledgeChunk" USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);

-- FK cascade : si la source est supprimée, ses chunks le sont aussi.
ALTER TABLE "KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- KnowledgeSource — tracking de l'indexing
-- ============================================================================

ALTER TABLE "KnowledgeSource" ADD COLUMN "indexedAt"  TIMESTAMP(3);
ALTER TABLE "KnowledgeSource" ADD COLUMN "indexError" TEXT;
