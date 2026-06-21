-- Migration 53 — /mon-dossier "porte d'entrée intelligente".
-- ADDITIVE UNIQUEMENT (DB Neon partagée) : ADD COLUMN / CREATE TABLE / CREATE INDEX.
-- Aucune colonne supprimée ni renommée → rétro-compatible.

-- ── DocumentBundle : contenu enrichi ──────────────────────────────────────────
ALTER TABLE "DocumentBundle" ADD COLUMN "organism"          TEXT;
ALTER TABLE "DocumentBundle" ADD COLUMN "officialSources"   JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "DocumentBundle" ADD COLUMN "lastVerifiedAt"    TIMESTAMP(3);
ALTER TABLE "DocumentBundle" ADD COLUMN "keywords"          JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "DocumentBundle" ADD COLUMN "synonyms"          JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "DocumentBundle" ADD COLUMN "relatedBundles"    JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "DocumentBundle" ADD COLUMN "estimatedTime"     INTEGER;
ALTER TABLE "DocumentBundle" ADD COLUMN "requiredDocuments" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "DocumentBundle" ADD COLUMN "warningLevel"      TEXT;

-- ── BundleRun : sécurité (hash code) + rétention RGPD ─────────────────────────
ALTER TABLE "BundleRun" ADD COLUMN "resumeCodeHash" TEXT;
ALTER TABLE "BundleRun" ADD COLUMN "anonymizedAt"   TIMESTAMP(3);

CREATE UNIQUE INDEX "BundleRun_resumeCodeHash_key" ON "BundleRun"("resumeCodeHash");
CREATE INDEX "BundleRun_status_updatedAt_idx" ON "BundleRun"("status", "updatedAt");

-- ── BundleAnalyticsEvent : événements internes /mon-dossier ────────────────────
CREATE TABLE "BundleAnalyticsEvent" (
    "id"           TEXT NOT NULL,
    "eventType"    TEXT NOT NULL,
    "bundleId"     TEXT,
    "sessionId"    TEXT,
    "userId"       TEXT,
    "source"       TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BundleAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BundleAnalyticsEvent_eventType_createdAt_idx" ON "BundleAnalyticsEvent"("eventType", "createdAt");
CREATE INDEX "BundleAnalyticsEvent_bundleId_eventType_idx" ON "BundleAnalyticsEvent"("bundleId", "eventType");
