-- Migration 6 — BundleRun (suivi de progression dans un bundle)

CREATE TABLE "BundleRun" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "payloads" JSONB NOT NULL DEFAULT '{}',
    "completedTemplateIds" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BundleRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BundleRun_bundleId_idx" ON "BundleRun"("bundleId");
CREATE INDEX "BundleRun_userId_idx" ON "BundleRun"("userId");
CREATE INDEX "BundleRun_sessionId_idx" ON "BundleRun"("sessionId");
CREATE INDEX "BundleRun_status_idx" ON "BundleRun"("status");

ALTER TABLE "BundleRun" ADD CONSTRAINT "BundleRun_bundleId_fkey"
  FOREIGN KEY ("bundleId") REFERENCES "DocumentBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
