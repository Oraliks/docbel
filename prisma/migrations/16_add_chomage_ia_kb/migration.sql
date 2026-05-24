-- Migration 16 — Chômage IA Knowledge Base
--
-- Ajoute le socle DB du module "Assistant IA Chômage" admin :
--   * KnowledgeSource  : sources alimentant la knowledge base (texte, URL,
--                        tutoriel, transcript vidéo, caption image, PDF).
--   * ChatSession      : conversations chat IA persistées (1 par fil de discussion).
--   * ChatMessage      : messages du chat (rôle user/assistant) avec sources citées.
--   * GeneratedPrompt  : prompts Claude Code générés via le prompt-builder.
--
-- Toutes ces tables sont scopées par `domain` (défaut "chomage") pour autoriser
-- d'autres domaines plus tard (sécu, fiscalité, etc.) sans casser le schéma.

-- ============================================================================
-- KnowledgeSource
-- ============================================================================

CREATE TABLE "KnowledgeSource" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "kind"        TEXT NOT NULL,
    "content"     TEXT NOT NULL,
    "summary"     TEXT,
    "sourceUrl"   TEXT,
    "fileId"      TEXT,
    "tags"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "enabled"     BOOLEAN NOT NULL DEFAULT true,
    "domain"      TEXT NOT NULL DEFAULT 'chomage',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeSource_domain_enabled_idx" ON "KnowledgeSource"("domain", "enabled");
CREATE INDEX "KnowledgeSource_createdAt_idx"      ON "KnowledgeSource"("createdAt");

-- ============================================================================
-- ChatSession
-- ============================================================================

CREATE TABLE "ChatSession" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL DEFAULT 'Nouvelle conversation',
    "domain"      TEXT NOT NULL DEFAULT 'chomage',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatSession_domain_createdAt_idx" ON "ChatSession"("domain", "createdAt");

-- ============================================================================
-- ChatMessage
-- ============================================================================

CREATE TABLE "ChatMessage" (
    "id"             TEXT NOT NULL,
    "sessionId"      TEXT NOT NULL,
    "role"           TEXT NOT NULL,
    "content"        TEXT NOT NULL,
    "citedSourceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "model"          TEXT,
    "tokensIn"       INTEGER,
    "tokensOut"      INTEGER,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- ============================================================================
-- GeneratedPrompt
-- ============================================================================

CREATE TABLE "GeneratedPrompt" (
    "id"             TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "brief"          TEXT NOT NULL,
    "output"         TEXT NOT NULL,
    "domain"         TEXT NOT NULL DEFAULT 'chomage',
    "citedSourceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById"    TEXT,

    CONSTRAINT "GeneratedPrompt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeneratedPrompt_domain_createdAt_idx" ON "GeneratedPrompt"("domain", "createdAt");
