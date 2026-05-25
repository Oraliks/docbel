-- Migration 22 — Chômage IA : veille / mémoire / gaps / obsolescence
--
-- Ajoute :
--   * IngestionSource         : config d'une source de veille (RSS ou scrape ONEM/SPF).
--   * IngestedDocument        : file d'attente des documents détectés, à valider.
--   * ChatMemory              : faits permanents injectés dans tous les chats.
--   * KnowledgeGap            : trous de connaissance détectés (regex côté pipeline).
--   * KnowledgeSource.lastValidatedAt / validityStatus
--                             : fresh / stale / obsolete / unknown (cf. cron obsolescence).
--
-- Pas de drop/alter destructifs — les sources et chats existants gardent leur
-- comportement par défaut :
--   - validityStatus = 'unknown' jusqu'au premier passage du cron.
--   - lastValidatedAt = NULL → le cron utilise createdAt comme âge de référence.
--
-- Indexes : axés sur les filtres typiques (status, domain, detectedAt).

-- ============================================================================
-- KnowledgeSource — colonnes pour la détection d'obsolescence (Feature 3)
-- ============================================================================

ALTER TABLE "KnowledgeSource"
    ADD COLUMN "lastValidatedAt" TIMESTAMP(3);

ALTER TABLE "KnowledgeSource"
    ADD COLUMN "validityStatus" TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX "KnowledgeSource_domain_validityStatus_idx"
    ON "KnowledgeSource"("domain", "validityStatus");

-- ============================================================================
-- ChatMemory (Feature 4)
-- ============================================================================

CREATE TABLE "ChatMemory" (
    "id"          TEXT NOT NULL,
    "content"     TEXT NOT NULL,
    "importance"  TEXT NOT NULL DEFAULT 'medium',
    "domain"      TEXT NOT NULL DEFAULT 'chomage',
    "enabled"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ChatMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMemory_domain_enabled_importance_idx"
    ON "ChatMemory"("domain", "enabled", "importance");

-- ============================================================================
-- KnowledgeGap (Feature 6)
-- ============================================================================

CREATE TABLE "KnowledgeGap" (
    "id"                TEXT NOT NULL,
    "query"             TEXT NOT NULL,
    "detectedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId"         TEXT,
    "messageId"         TEXT,
    "status"            TEXT NOT NULL DEFAULT 'open',
    "resolvedBy"        TEXT,
    "knowledgeSourceId" TEXT,
    "notes"             TEXT,
    "domain"            TEXT NOT NULL DEFAULT 'chomage',
    "occurrences"       INTEGER NOT NULL DEFAULT 1,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeGap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeGap_domain_status_detectedAt_idx"
    ON "KnowledgeGap"("domain", "status", "detectedAt" DESC);
CREATE INDEX "KnowledgeGap_sessionId_idx" ON "KnowledgeGap"("sessionId");

-- ============================================================================
-- IngestionSource + IngestedDocument (Feature 1)
-- ============================================================================

CREATE TABLE "IngestionSource" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "kind"          TEXT NOT NULL,
    "url"           TEXT NOT NULL,
    "schedule"      TEXT NOT NULL DEFAULT 'daily',
    "enabled"       BOOLEAN NOT NULL DEFAULT true,
    "domain"        TEXT NOT NULL DEFAULT 'chomage',
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError"     TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IngestionSource_domain_enabled_idx"
    ON "IngestionSource"("domain", "enabled");

CREATE TABLE "IngestedDocument" (
    "id"                TEXT NOT NULL,
    "ingestionSourceId" TEXT NOT NULL,
    "externalUrl"       TEXT NOT NULL,
    "title"             TEXT NOT NULL,
    "publishedAt"       TIMESTAMP(3),
    "fetchedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"            TEXT NOT NULL DEFAULT 'pending',
    "knowledgeSourceId" TEXT,
    "notes"             TEXT,

    CONSTRAINT "IngestedDocument_pkey" PRIMARY KEY ("id")
);

-- Unique sur externalUrl pour dédupliquer côté ingestion.
CREATE UNIQUE INDEX "IngestedDocument_externalUrl_key"
    ON "IngestedDocument"("externalUrl");
CREATE INDEX "IngestedDocument_status_fetchedAt_idx"
    ON "IngestedDocument"("status", "fetchedAt" DESC);
CREATE INDEX "IngestedDocument_ingestionSourceId_idx"
    ON "IngestedDocument"("ingestionSourceId");

ALTER TABLE "IngestedDocument"
    ADD CONSTRAINT "IngestedDocument_ingestionSourceId_fkey"
    FOREIGN KEY ("ingestionSourceId") REFERENCES "IngestionSource"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
