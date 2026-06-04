-- Drop legacy DocumentTemplate-based modules.
-- Tables and their dependencies are removed completely; new flow is fully on
-- PdfForm + DocumentBundle. DocumentBundleItem keeps the nullable
-- `templateId` column for historical rows but loses its FK.

ALTER TABLE "DocumentBundleItem" DROP CONSTRAINT IF EXISTS "DocumentBundleItem_templateId_fkey";
DROP INDEX IF EXISTS "DocumentBundleItem_bundleId_templateId_key";

DROP TABLE IF EXISTS "FormAnalyticsEvent" CASCADE;
DROP TABLE IF EXISTS "SignatureRecord" CASCADE;
DROP TABLE IF EXISTS "DocumentDraft" CASCADE;
DROP TABLE IF EXISTS "GeneratedDocument" CASCADE;
DROP TABLE IF EXISTS "DocumentTemplateRevision" CASCADE;
DROP TABLE IF EXISTS "DocumentTemplate" CASCADE;

-- Clean orphan bundle items that referenced the now-deleted templates.
DELETE FROM "DocumentBundleItem"
WHERE "templateId" IS NOT NULL AND "pdfFormId" IS NULL;
