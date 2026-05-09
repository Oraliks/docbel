-- File: add mimeType, sha256 columns
ALTER TABLE "File" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "File" ADD COLUMN "sha256" TEXT;

-- File: indexes
CREATE INDEX "File_parentId_idx" ON "File"("parentId");
CREATE INDEX "File_parentId_type_idx" ON "File"("parentId", "type");
CREATE INDEX "File_type_idx" ON "File"("type");
CREATE INDEX "File_isPrivate_idx" ON "File"("isPrivate");
CREATE INDEX "File_createdBy_idx" ON "File"("createdBy");
CREATE INDEX "File_sha256_idx" ON "File"("sha256");

-- FileUsage: add pageId column for stable referencing
ALTER TABLE "FileUsage" ADD COLUMN "pageId" TEXT;

-- FileUsage: switch FK to ON DELETE CASCADE so removing a file cleans usage rows
ALTER TABLE "FileUsage" DROP CONSTRAINT IF EXISTS "FileUsage_fileId_fkey";
ALTER TABLE "FileUsage"
  ADD CONSTRAINT "FileUsage_fileId_fkey"
  FOREIGN KEY ("fileId") REFERENCES "File"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- FileUsage: indexes
CREATE INDEX "FileUsage_fileId_idx" ON "FileUsage"("fileId");
CREATE INDEX "FileUsage_pageId_idx" ON "FileUsage"("pageId");
CREATE INDEX "FileUsage_pageSlug_idx" ON "FileUsage"("pageSlug");
