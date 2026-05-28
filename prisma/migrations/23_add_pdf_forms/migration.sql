-- CreateEnum
CREATE TYPE "PdfFormStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "PdfForm" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "issuer" TEXT,
    "status" "PdfFormStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "defaultLocale" TEXT NOT NULL DEFAULT 'fr',
    "locales" JSONB NOT NULL DEFAULT '["fr"]',
    "sourceStoragePath" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceByteSize" INTEGER NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "technicalSchema" JSONB NOT NULL DEFAULT '[]',
    "fields" JSONB NOT NULL DEFAULT '[]',
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "allowDoccle" BOOLEAN NOT NULL DEFAULT false,
    "allowItsme" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfFormRevision" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fields" JSONB NOT NULL,
    "technicalSchema" JSONB NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "changeType" TEXT NOT NULL DEFAULT 'minor',
    "changeNotes" TEXT,
    "diffSummary" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfFormRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfFieldPreset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "regex" TEXT,
    "errorMsg" JSONB,
    "helpText" JSONB,
    "maxLength" INTEGER,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfFieldPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfFormSubmissionLog" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formVersion" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "delivery" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "ipHash" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfFormSubmissionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfFormDraft" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfFormDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PdfForm_slug_key" ON "PdfForm"("slug");
CREATE INDEX "PdfForm_status_idx" ON "PdfForm"("status");
CREATE INDEX "PdfForm_updatedAt_idx" ON "PdfForm"("updatedAt");
CREATE INDEX "PdfFormRevision_formId_idx" ON "PdfFormRevision"("formId");
CREATE INDEX "PdfFormRevision_createdAt_idx" ON "PdfFormRevision"("createdAt");
CREATE UNIQUE INDEX "PdfFieldPreset_key_key" ON "PdfFieldPreset"("key");
CREATE INDEX "PdfFormSubmissionLog_formId_idx" ON "PdfFormSubmissionLog"("formId");
CREATE INDEX "PdfFormSubmissionLog_createdAt_idx" ON "PdfFormSubmissionLog"("createdAt");
CREATE INDEX "PdfFormDraft_expiresAt_idx" ON "PdfFormDraft"("expiresAt");
CREATE UNIQUE INDEX "PdfFormDraft_formId_userId_key" ON "PdfFormDraft"("formId", "userId");

-- AddForeignKey
ALTER TABLE "PdfFormRevision" ADD CONSTRAINT "PdfFormRevision_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PdfForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PdfFormSubmissionLog" ADD CONSTRAINT "PdfFormSubmissionLog_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PdfForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PdfFormDraft" ADD CONSTRAINT "PdfFormDraft_formId_fkey" FOREIGN KEY ("formId") REFERENCES "PdfForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
