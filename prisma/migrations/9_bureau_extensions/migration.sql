-- AlterTable
ALTER TABLE "Bureau" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bureau" ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Bureau" ADD COLUMN "verifiedBy" TEXT;

-- CreateIndex
CREATE INDEX "Bureau_verified_idx" ON "Bureau"("verified");
CREATE INDEX "Bureau_lastVerifiedAt_idx" ON "Bureau"("lastVerifiedAt");

-- CreateTable
CREATE TABLE "BureauRevision" (
    "id" TEXT NOT NULL,
    "bureauId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "diff" JSONB,
    "changeNotes" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BureauRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BureauRevision_bureauId_createdAt_idx" ON "BureauRevision"("bureauId", "createdAt" DESC);
CREATE INDEX "BureauRevision_changedBy_idx" ON "BureauRevision"("changedBy");

-- AddForeignKey
ALTER TABLE "BureauRevision" ADD CONSTRAINT "BureauRevision_bureauId_fkey" FOREIGN KEY ("bureauId") REFERENCES "Bureau"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BureauReport" (
    "id" TEXT NOT NULL,
    "bureauId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reporterEmail" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BureauReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BureauReport_bureauId_idx" ON "BureauReport"("bureauId");
CREATE INDEX "BureauReport_status_idx" ON "BureauReport"("status");
CREATE INDEX "BureauReport_createdAt_idx" ON "BureauReport"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "BureauReport" ADD CONSTRAINT "BureauReport_bureauId_fkey" FOREIGN KEY ("bureauId") REFERENCES "Bureau"("id") ON DELETE CASCADE ON UPDATE CASCADE;
