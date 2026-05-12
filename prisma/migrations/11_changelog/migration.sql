-- CreateTable
CREATE TABLE "Changelog" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'feature',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "changes" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Changelog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Changelog_version_key" ON "Changelog"("version");

-- CreateIndex
CREATE INDEX "Changelog_publishedAt_idx" ON "Changelog"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Changelog_type_idx" ON "Changelog"("type");
