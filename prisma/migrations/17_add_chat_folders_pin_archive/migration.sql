-- Migration 17 — Chômage IA : sessions power features
--
-- Ajoute :
--   * Trois colonnes sur ChatSession : `pinned`, `archived`, `folderId`
--     → permet d'épingler une conv (top du rail), de l'archiver (sortie de
--       la liste principale) et de la classer dans un dossier coloré.
--   * Nouvelle table ChatFolder : dossiers de groupement (nom + couleur + ordre)
--     scopés par `domain` (chomage / sécu / fiscalité plus tard).
--   * Indexes optimisés pour les tris rail (pinned DESC, archived false, updatedAt DESC)
--     et pour les filtres par folder.
--
-- Aucune donnée existante n'est altérée : les valeurs par défaut sont
-- compatibles (pinned=false, archived=false, folderId=null).

-- ============================================================================
-- ChatFolder
-- ============================================================================

CREATE TABLE "ChatFolder" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "color"       TEXT,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "domain"      TEXT NOT NULL DEFAULT 'chomage',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ChatFolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatFolder_domain_order_idx" ON "ChatFolder"("domain", "order");

-- ============================================================================
-- ChatSession — extensions
-- ============================================================================

ALTER TABLE "ChatSession" ADD COLUMN "pinned"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatSession" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatSession" ADD COLUMN "folderId" TEXT;

CREATE INDEX "ChatSession_domain_pinned_archived_idx"
    ON "ChatSession"("domain", "pinned", "archived");
CREATE INDEX "ChatSession_folderId_idx"
    ON "ChatSession"("folderId");

ALTER TABLE "ChatSession"
    ADD CONSTRAINT "ChatSession_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "ChatFolder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
