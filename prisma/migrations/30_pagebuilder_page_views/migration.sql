-- Page-builder: lightweight page-view analytics events.
-- Idempotent + additive: safe to (re)apply on the shared database.

CREATE TABLE IF NOT EXISTS "PageView" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "referrer" TEXT,
    "device" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PageView_slug_createdAt_idx" ON "PageView"("slug", "createdAt");
CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView"("createdAt");
