-- =====================================================================
-- Migration 5 — Analytics d'événements formulaire (Phase 14)
-- =====================================================================

CREATE TABLE "FormAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "contextKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FormAnalyticsEvent_templateId_createdAt_idx" ON "FormAnalyticsEvent"("templateId", "createdAt");
CREATE INDEX "FormAnalyticsEvent_sessionId_idx" ON "FormAnalyticsEvent"("sessionId");
CREATE INDEX "FormAnalyticsEvent_eventType_idx" ON "FormAnalyticsEvent"("eventType");
CREATE INDEX "FormAnalyticsEvent_templateId_eventType_createdAt_idx" ON "FormAnalyticsEvent"("templateId", "eventType", "createdAt");

ALTER TABLE "FormAnalyticsEvent" ADD CONSTRAINT "FormAnalyticsEvent_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
