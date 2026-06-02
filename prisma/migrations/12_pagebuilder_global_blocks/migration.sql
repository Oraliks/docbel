-- Page-builder: linked reusable "global" blocks (edit-once, update-everywhere).
-- Idempotent + additive: safe to (re)apply on the shared database.

CREATE TABLE IF NOT EXISTS "GlobalBlock" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "block" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GlobalBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GlobalBlock_createdAt_idx" ON "GlobalBlock"("createdAt");
