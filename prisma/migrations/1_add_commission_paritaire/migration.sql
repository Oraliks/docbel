-- CreateTable
CREATE TABLE "CommissionParitaire" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "numeroOfficiel" TEXT NOT NULL,
    "codeOfficiel5" TEXT NOT NULL,
    "suffixeInterne" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionParitaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionParitaire_code_key" ON "CommissionParitaire"("code");

-- CreateIndex
CREATE INDEX "CommissionParitaire_type_idx" ON "CommissionParitaire"("type");

-- CreateIndex
CREATE INDEX "CommissionParitaire_numeroOfficiel_idx" ON "CommissionParitaire"("numeroOfficiel");

-- CreateIndex
CREATE INDEX "CommissionParitaire_code_idx" ON "CommissionParitaire"("code");
