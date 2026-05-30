-- Bridge : DocumentBundleItem peut maintenant référencer SOIT un ancien
-- DocumentTemplate, SOIT un nouveau PdfForm. Exactement un des deux IDs est défini.

-- 1. templateId devient nullable.
ALTER TABLE "DocumentBundleItem" ALTER COLUMN "templateId" DROP NOT NULL;

-- 2. Nouvelle colonne pdfFormId nullable, FK vers PdfForm (cascade).
ALTER TABLE "DocumentBundleItem" ADD COLUMN "pdfFormId" TEXT;

ALTER TABLE "DocumentBundleItem" ADD CONSTRAINT "DocumentBundleItem_pdfFormId_fkey"
    FOREIGN KEY ("pdfFormId") REFERENCES "PdfForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Unicité par (bundleId, pdfFormId) — comme déjà existant sur templateId.
CREATE UNIQUE INDEX "DocumentBundleItem_bundleId_pdfFormId_key"
    ON "DocumentBundleItem"("bundleId", "pdfFormId");

-- 4. Index sur pdfFormId pour les lookups inverses.
CREATE INDEX "DocumentBundleItem_pdfFormId_idx" ON "DocumentBundleItem"("pdfFormId");

-- 5. Contrainte CHECK : exactement un des deux IDs est défini (XOR).
ALTER TABLE "DocumentBundleItem" ADD CONSTRAINT "DocumentBundleItem_xor_source"
    CHECK (
        ("templateId" IS NOT NULL AND "pdfFormId" IS NULL)
        OR
        ("templateId" IS NULL AND "pdfFormId" IS NOT NULL)
    );
