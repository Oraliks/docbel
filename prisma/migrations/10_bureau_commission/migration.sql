-- CreateTable
CREATE TABLE "BureauCommission" (
    "bureauId" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BureauCommission_pkey" PRIMARY KEY ("bureauId","commissionId")
);

-- CreateIndex
CREATE INDEX "BureauCommission_commissionId_idx" ON "BureauCommission"("commissionId");
CREATE INDEX "BureauCommission_bureauId_idx" ON "BureauCommission"("bureauId");

-- AddForeignKey
ALTER TABLE "BureauCommission" ADD CONSTRAINT "BureauCommission_bureauId_fkey" FOREIGN KEY ("bureauId") REFERENCES "Bureau"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BureauCommission" ADD CONSTRAINT "BureauCommission_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "CommissionParitaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable UserProfile
ALTER TABLE "UserProfile" ADD COLUMN "organismePaiement" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "commissionParitaireCode" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "mutuelleCode" TEXT;
