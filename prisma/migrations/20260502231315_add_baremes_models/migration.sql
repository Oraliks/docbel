-- CreateTable
CREATE TABLE "BaremeFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "fileType" TEXT NOT NULL DEFAULT 'onem-rates',
    "multiplicateur" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BaremeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "descriptionNl" TEXT,
    "amount" REAL,
    "formula" TEXT,
    "percentage" REAL,
    "unit" TEXT,
    "applicableTo" TEXT,
    "ageRange" TEXT,
    "sector" TEXT,
    "legalArticle" TEXT,
    "notes" TEXT,
    "sheetName" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BaremeEntry_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "BaremeFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BareSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BareSheet_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "BaremeFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BaremeFile_effectiveDate_idx" ON "BaremeFile"("effectiveDate");

-- CreateIndex
CREATE INDEX "BaremeFile_status_idx" ON "BaremeFile"("status");

-- CreateIndex
CREATE INDEX "BaremeFile_fileType_idx" ON "BaremeFile"("fileType");

-- CreateIndex
CREATE INDEX "BaremeEntry_fileId_idx" ON "BaremeEntry"("fileId");

-- CreateIndex
CREATE INDEX "BaremeEntry_category_idx" ON "BaremeEntry"("category");

-- CreateIndex
CREATE INDEX "BaremeEntry_code_idx" ON "BaremeEntry"("code");

-- CreateIndex
CREATE INDEX "BaremeEntry_sector_idx" ON "BaremeEntry"("sector");

-- CreateIndex
CREATE INDEX "BaremeEntry_ageRange_idx" ON "BaremeEntry"("ageRange");

-- CreateIndex
CREATE INDEX "BareSheet_fileId_idx" ON "BareSheet"("fileId");

-- CreateIndex
CREATE INDEX "BareSheet_category_idx" ON "BareSheet"("category");

-- CreateIndex
CREATE UNIQUE INDEX "BareSheet_fileId_name_key" ON "BareSheet"("fileId", "name");
