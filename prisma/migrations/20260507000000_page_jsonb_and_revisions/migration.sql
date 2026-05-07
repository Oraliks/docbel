-- Convert Page.content (TEXT) -> JSONB, default '[]'
ALTER TABLE "Page"
  ALTER COLUMN "content" DROP DEFAULT,
  ALTER COLUMN "content" TYPE JSONB USING (
    CASE
      WHEN "content" IS NULL OR "content" = '' THEN '[]'::jsonb
      ELSE "content"::jsonb
    END
  ),
  ALTER COLUMN "content" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "content" SET NOT NULL;

-- Soft delete column
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Indexes for hot paths
CREATE INDEX IF NOT EXISTS "Page_status_idx" ON "Page" ("status");
CREATE INDEX IF NOT EXISTS "Page_deletedAt_idx" ON "Page" ("deletedAt");
CREATE INDEX IF NOT EXISTS "Page_status_slug_idx" ON "Page" ("status", "slug");

-- Revisions table
CREATE TABLE IF NOT EXISTS "PageRevision" (
  "id"        TEXT PRIMARY KEY,
  "pageId"    TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "content"   JSONB NOT NULL DEFAULT '[]'::jsonb,
  "metaTitle" TEXT,
  "metaDesc"  TEXT,
  "ogImage"   TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PageRevision_pageId_fkey" FOREIGN KEY ("pageId")
    REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PageRevision_pageId_idx" ON "PageRevision" ("pageId");
CREATE INDEX IF NOT EXISTS "PageRevision_createdAt_idx" ON "PageRevision" ("createdAt");
