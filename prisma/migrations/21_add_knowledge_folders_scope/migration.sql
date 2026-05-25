-- Migration 21 — Chômage IA : dossiers KB nested + scope multi-folder
--
-- Ajoute :
--   * Nouvelle table KnowledgeFolder : dossiers de classement HIÉRARCHIQUES
--     (parentId auto-référence) pour organiser les KnowledgeSource en une
--     arborescence (max 3 niveaux — la profondeur est validée côté API, pas DB).
--     Différent du modèle ChatFolder existant (qui range les ChatSession) — ici
--     on range les *sources* de la knowledge base.
--   * Colonne `folderId` sur KnowledgeSource pointant vers KnowledgeFolder
--     (null = source à la racine = "Sans dossier"). ON DELETE SET NULL.
--   * Colonne `scopeFolderIds TEXT[]` sur ChatSession : liste de folder IDs
--     pour limiter le retrieval RAG à un sous-ensemble (multi-folder OR).
--     Tableau vide `{}` = toute la KB (comportement par défaut, rétrocompatible).
--
-- Indexes :
--   * (domain, parentId, order) : tri rapide pour rendre l'arbre niveau par niveau
--   * (parentId) : retrouver les enfants d'un folder pour les actions cascade UI
--   * KnowledgeSource (domain, folderId) : filtre la table sidebar gauche
--
-- Aucune donnée existante n'est altérée. Les KnowledgeSource existantes
-- gardent `folderId = NULL` (= "Sans dossier" / racine).

-- ============================================================================
-- KnowledgeFolder (nouvelle table)
-- ============================================================================

CREATE TABLE "KnowledgeFolder" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "color"       TEXT,
    "icon"        TEXT,
    "parentId"    TEXT,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "domain"      TEXT NOT NULL DEFAULT 'chomage',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "KnowledgeFolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeFolder_domain_parentId_order_idx"
    ON "KnowledgeFolder"("domain", "parentId", "order");
CREATE INDEX "KnowledgeFolder_parentId_idx"
    ON "KnowledgeFolder"("parentId");

-- Auto-référence pour la hiérarchie. SetNull = si le parent est supprimé,
-- les enfants remontent en racine plutôt que d'être supprimés en cascade.
ALTER TABLE "KnowledgeFolder"
    ADD CONSTRAINT "KnowledgeFolder_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "KnowledgeFolder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- KnowledgeSource — ajout colonne folderId + FK + index
-- ============================================================================

ALTER TABLE "KnowledgeSource" ADD COLUMN "folderId" TEXT;

CREATE INDEX "KnowledgeSource_domain_folderId_idx"
    ON "KnowledgeSource"("domain", "folderId");

ALTER TABLE "KnowledgeSource"
    ADD CONSTRAINT "KnowledgeSource_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "KnowledgeFolder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- ChatSession — ajout colonne scopeFolderIds (multi-folder scope)
-- ============================================================================
--
-- TEXT[] avec default = tableau vide. Le retrieval RAG (lib/chomage-ia/context)
-- interprète `length === 0` comme "pas de scope = toute la KB".

ALTER TABLE "ChatSession"
    ADD COLUMN "scopeFolderIds" TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
