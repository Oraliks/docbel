-- Additive Lookup publication workflow; intentionally not applied here.
ALTER TABLE "LookupTable"
ADD COLUMN "publishedRevision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "LookupImportProposal" (
  "id" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "sourceFileName" TEXT NOT NULL,
  "sourceContent" TEXT NOT NULL,
  "sourceSha256" TEXT NOT NULL,
  "payloadHash" TEXT,
  "baseRevision" INTEGER NOT NULL,
  "baseHash" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "transformation" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "normalizedPayload" JSONB,
  "diff" JSONB,
  "validationErrors" JSONB,
  "state" TEXT NOT NULL DEFAULT 'prepared',
  "errorMessage" TEXT,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),

  CONSTRAINT "LookupImportProposal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LookupImportProposal_tableId_fkey"
    FOREIGN KEY ("tableId") REFERENCES "LookupTable"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LookupImportProposal_tableId_state_createdAt_idx"
ON "LookupImportProposal"("tableId", "state", "createdAt");

CREATE INDEX "LookupImportProposal_sourceSha256_idx"
ON "LookupImportProposal"("sourceSha256");

CREATE UNIQUE INDEX "LookupImportProposal_tableId_sourceSha256_baseHash_parserVersion_key"
ON "LookupImportProposal"("tableId", "sourceSha256", "baseHash", "parserVersion");

CREATE TABLE "LookupImportApproval" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "approverEmail" TEXT NOT NULL,
  "approverName" TEXT,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LookupImportApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LookupImportApproval_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "LookupImportProposal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LookupImportApproval_proposalId_approverEmail_key"
ON "LookupImportApproval"("proposalId", "approverEmail");

CREATE INDEX "LookupImportApproval_proposalId_idx"
ON "LookupImportApproval"("proposalId");
