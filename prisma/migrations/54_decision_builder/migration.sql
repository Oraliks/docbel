-- Migration 54 — Decision Builder (arbres d'orientation versionnés).
-- ADDITIVE UNIQUEMENT (DB Neon partagée) : CREATE TABLE / ADD COLUMN / CREATE INDEX.
-- Aucune colonne supprimée ni renommée → rétro-compatible.

-- ── DecisionTree : racine d'un arbre d'orientation, versionné draft/published/archived
CREATE TABLE "DecisionTree" (
    "id"                  TEXT NOT NULL,
    "slug"                TEXT NOT NULL,
    "title"               TEXT NOT NULL,
    "description"         TEXT,
    -- Segment d'usage : "chomage" | "employeur" | … (filtre runtime côté public).
    "segment"             TEXT NOT NULL DEFAULT 'chomage',
    -- "draft" | "published" | "archived"
    "status"              TEXT NOT NULL DEFAULT 'draft',
    -- Contenu en cours d'édition (auto-save). Default = arbre vide valide.
    "draftContent"        JSONB NOT NULL DEFAULT '{"version":1,"rootNodeId":null,"nodes":{}}',
    -- Dernier snapshot publié (lecture publique). NULL tant qu'aucune publication.
    "publishedContent"    JSONB,
    "publishedAt"         TIMESTAMP(3),
    "publishedRevisionId" TEXT,
    "createdBy"           TEXT,
    "updatedBy"           TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DecisionTree_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DecisionTree_slug_key" ON "DecisionTree"("slug");
CREATE INDEX "DecisionTree_status_idx" ON "DecisionTree"("status");
CREATE INDEX "DecisionTree_segment_status_idx" ON "DecisionTree"("segment", "status");

-- ── DecisionTreeRevision : snapshot uniquement à la publication (calque PdfFormRevision)
CREATE TABLE "DecisionTreeRevision" (
    "id"          TEXT NOT NULL,
    "treeId"      TEXT NOT NULL,
    -- Version monotone par arbre (1, 2, 3…), incrémentée à chaque publication.
    "version"     INTEGER NOT NULL,
    "content"     JSONB NOT NULL,
    -- "minor" | "major" — sémantique laissée à l'admin (champ libre côté UI).
    "changeType"  TEXT NOT NULL DEFAULT 'minor',
    "changeNotes" TEXT,
    -- { added: [], removed: [], modified: [] } — cf. lib/decision-builder/diff.ts
    "diffSummary" JSONB,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DecisionTreeRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DecisionTreeRevision_treeId_fkey"
        FOREIGN KEY ("treeId") REFERENCES "DecisionTree"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DecisionTreeRevision_treeId_publishedAt_idx"
    ON "DecisionTreeRevision"("treeId", "publishedAt");
CREATE UNIQUE INDEX "DecisionTreeRevision_treeId_version_key"
    ON "DecisionTreeRevision"("treeId", "version");

-- ── BundleRun : sauvegarde des réponses du wizard d'orientation
--    Permet de reprendre orientation + dossier avec un seul code BELDOC.
ALTER TABLE "BundleRun" ADD COLUMN "orientationAnswers" JSONB;
