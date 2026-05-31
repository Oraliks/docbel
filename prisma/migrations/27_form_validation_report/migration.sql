-- Signalements de validation de champ : un utilisateur signale qu'il pense
-- qu'un message d'erreur est un faux positif (ex. NISS rejeté à tort).

CREATE TABLE "FormValidationReport" (
    "id" TEXT NOT NULL,
    "formId" TEXT,
    "formSlug" TEXT,
    "fieldId" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "rejectedValue" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "locale" TEXT,
    "userMessage" TEXT,
    "reporterEmail" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormValidationReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FormValidationReport_formId_idx" ON "FormValidationReport"("formId");
CREATE INDEX "FormValidationReport_status_idx" ON "FormValidationReport"("status");
CREATE INDEX "FormValidationReport_fieldType_idx" ON "FormValidationReport"("fieldType");
CREATE INDEX "FormValidationReport_createdAt_idx" ON "FormValidationReport"("createdAt" DESC);

ALTER TABLE "FormValidationReport" ADD CONSTRAINT "FormValidationReport_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "PdfForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
