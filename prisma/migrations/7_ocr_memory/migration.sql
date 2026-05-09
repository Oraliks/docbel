-- Migration 7 — Mémoire OCR (corrections + snapshots par hash PDF)

CREATE TABLE "OcrCorrectionMemory" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "rawLabel" TEXT NOT NULL,
    "cleanLabel" TEXT NOT NULL,
    "fieldType" TEXT,
    "presetId" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrCorrectionMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OcrCorrectionMemory_templateId_rawLabel_idx" ON "OcrCorrectionMemory"("templateId", "rawLabel");
CREATE INDEX "OcrCorrectionMemory_rawLabel_idx" ON "OcrCorrectionMemory"("rawLabel");

CREATE TABLE "OcrSnapshot" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileId" TEXT,
    "detectedFields" JSONB NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OcrSnapshot_sha256_key" ON "OcrSnapshot"("sha256");
CREATE INDEX "OcrSnapshot_sha256_idx" ON "OcrSnapshot"("sha256");
CREATE INDEX "OcrSnapshot_fileId_idx" ON "OcrSnapshot"("fileId");
