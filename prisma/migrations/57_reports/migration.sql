-- Migration 57 — Report : signalement unifié qui remplace BureauReport,
-- FormValidationReport, TrainingReport, TranslationSuggestion (backfill,
-- Task 17) + RioLex (mailto, Task 16). ADDITIVE & idempotente → sûre sur
-- la base Neon partagée. Via `prisma db execute`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "targetUrl" TEXT,
    "payload" JSONB NOT NULL,
    "reporterEmail" TEXT,
    "reporterId" TEXT,
    "reporterOrg" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "adminNote" TEXT,
    "actionTaken" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Report_type_status_idx" ON "Report"("type", "status");
CREATE INDEX IF NOT EXISTS "Report_targetId_idx" ON "Report"("targetId");
CREATE INDEX IF NOT EXISTS "Report_createdAt_idx" ON "Report"("createdAt" DESC);
