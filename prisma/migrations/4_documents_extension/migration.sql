-- =====================================================================
-- Migration 4 — Extension du système de documents
-- - Organisme (ONEM, CPAS, etc.)
-- - FieldValidationPreset (presets riches réutilisables)
-- - SignatureRecord (audit trail signature électronique)
-- - DocumentBundle / DocumentBundleItem (génération en cascade)
-- - UserProfile (pré-remplissage enrichi)
-- - Extensions DocumentTemplate / DocumentTemplateRevision / GeneratedDocument
-- =====================================================================

-- CreateEnum
CREATE TYPE "OrganismeType" AS ENUM ('federal', 'regional', 'local', 'social', 'professional', 'other');

-- CreateTable Organisme
CREATE TABLE "Organisme" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "type" "OrganismeType" NOT NULL DEFAULT 'other',
    "color" TEXT NOT NULL DEFAULT '#7C3AED',
    "logoUrl" TEXT,
    "website" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisme_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organisme_code_key" ON "Organisme"("code");
CREATE INDEX "Organisme_type_idx" ON "Organisme"("type");
CREATE INDEX "Organisme_active_idx" ON "Organisme"("active");
CREATE INDEX "Organisme_order_idx" ON "Organisme"("order");

-- CreateTable FieldValidationPreset
CREATE TABLE "FieldValidationPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "fieldType" TEXT NOT NULL,
    "regex" TEXT,
    "regexFlags" TEXT,
    "minLength" INTEGER,
    "maxLength" INTEGER,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "minDate" TEXT,
    "maxDate" TEXT,
    "belgianType" TEXT,
    "crossFieldRule" JSONB,
    "errorMsg" TEXT NOT NULL,
    "errorMsgNl" TEXT,
    "helpText" TEXT,
    "helpTextNl" TEXT,
    "placeholder" TEXT,
    "placeholderNl" TEXT,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT,
    "color" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldValidationPreset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FieldValidationPreset_name_key" ON "FieldValidationPreset"("name");
CREATE INDEX "FieldValidationPreset_category_idx" ON "FieldValidationPreset"("category");
CREATE INDEX "FieldValidationPreset_fieldType_idx" ON "FieldValidationPreset"("fieldType");
CREATE INDEX "FieldValidationPreset_builtin_idx" ON "FieldValidationPreset"("builtin");

-- CreateTable SignatureRecord
CREATE TABLE "SignatureRecord" (
    "id" TEXT NOT NULL,
    "generatedDocumentId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT,
    "signerUserId" TEXT,
    "signatureImageData" TEXT,
    "signatureMethod" TEXT NOT NULL DEFAULT 'drawn',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "pdfHashBefore" TEXT NOT NULL,
    "pdfHashAfter" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "certThumbprint" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SignatureRecord_generatedDocumentId_key" ON "SignatureRecord"("generatedDocumentId");
CREATE INDEX "SignatureRecord_signerUserId_idx" ON "SignatureRecord"("signerUserId");
CREATE INDEX "SignatureRecord_signedAt_idx" ON "SignatureRecord"("signedAt");

-- CreateTable DocumentBundle
CREATE TABLE "DocumentBundle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#7C3AED',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentBundle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentBundle_slug_key" ON "DocumentBundle"("slug");
CREATE INDEX "DocumentBundle_active_idx" ON "DocumentBundle"("active");

-- CreateTable DocumentBundleItem
CREATE TABLE "DocumentBundleItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "condition" JSONB,

    CONSTRAINT "DocumentBundleItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentBundleItem_bundleId_templateId_key" ON "DocumentBundleItem"("bundleId", "templateId");
CREATE INDEX "DocumentBundleItem_bundleId_idx" ON "DocumentBundleItem"("bundleId");

-- CreateTable UserProfile
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "niss" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthPlace" TEXT,
    "nationality" TEXT,
    "gender" TEXT,
    "street" TEXT,
    "streetNum" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BE',
    "phone" TEXT,
    "mobilePhone" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "maritalStatus" TEXT,
    "employer" TEXT,
    "employerBce" TEXT,
    "jobTitle" TEXT,
    "contractType" TEXT,
    "contractStart" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- AlterTable DocumentTemplate
ALTER TABLE "DocumentTemplate" ADD COLUMN "organismeId" TEXT;
ALTER TABLE "DocumentTemplate" ADD COLUMN "effectiveDate" TIMESTAMP(3);
ALTER TABLE "DocumentTemplate" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "DocumentTemplate" ADD COLUMN "officialRef" TEXT;
ALTER TABLE "DocumentTemplate" ADD COLUMN "requiresSignature" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DocumentTemplate" ADD COLUMN "signaturePosition" JSONB;

CREATE INDEX "DocumentTemplate_organismeId_idx" ON "DocumentTemplate"("organismeId");
CREATE INDEX "DocumentTemplate_effectiveDate_idx" ON "DocumentTemplate"("effectiveDate");
CREATE INDEX "DocumentTemplate_expiresAt_idx" ON "DocumentTemplate"("expiresAt");

-- AlterTable DocumentTemplateRevision
ALTER TABLE "DocumentTemplateRevision" ADD COLUMN "changeNotes" TEXT;
ALTER TABLE "DocumentTemplateRevision" ADD COLUMN "changeType" TEXT NOT NULL DEFAULT 'minor';
ALTER TABLE "DocumentTemplateRevision" ADD COLUMN "diffSummary" JSONB;

CREATE INDEX "DocumentTemplateRevision_changeType_idx" ON "DocumentTemplateRevision"("changeType");

-- AlterTable GeneratedDocument
ALTER TABLE "GeneratedDocument" ADD COLUMN "bundleRunId" TEXT;

CREATE INDEX "GeneratedDocument_bundleRunId_idx" ON "GeneratedDocument"("bundleRunId");

-- Foreign Keys
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_organismeId_fkey"
  FOREIGN KEY ("organismeId") REFERENCES "Organisme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SignatureRecord" ADD CONSTRAINT "SignatureRecord_generatedDocumentId_fkey"
  FOREIGN KEY ("generatedDocumentId") REFERENCES "GeneratedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentBundleItem" ADD CONSTRAINT "DocumentBundleItem_bundleId_fkey"
  FOREIGN KEY ("bundleId") REFERENCES "DocumentBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentBundleItem" ADD CONSTRAINT "DocumentBundleItem_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
