-- CreateEnum
CREATE TYPE "BureauType" AS ENUM ('CPAS', 'COMMUNE', 'ONEM', 'SYNDICAT', 'PERMANENCE', 'AUTRE');

-- CreateEnum
CREATE TYPE "BelgianRegion" AS ENUM ('wallonia', 'flanders', 'brussels', 'germanophone');

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "insCode" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameNl" TEXT,
    "nameDe" TEXT,
    "region" "BelgianRegion" NOT NULL,
    "province" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostalCode" (
    "code" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,

    CONSTRAINT "PostalCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Bureau" (
    "id" TEXT NOT NULL,
    "organismeId" TEXT NOT NULL,
    "type" "BureauType" NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "streetNum" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "communeId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "appointmentUrl" TEXT,
    "hours" JSONB NOT NULL DEFAULT '[]',
    "hoursNotes" TEXT,
    "services" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "nameNl" TEXT,
    "nameDe" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bureau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BureauAssignment" (
    "bureauId" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'chomage',

    CONSTRAINT "BureauAssignment_pkey" PRIMARY KEY ("bureauId","communeId","serviceType")
);

-- CreateIndex
CREATE UNIQUE INDEX "Commune_insCode_key" ON "Commune"("insCode");

-- CreateIndex
CREATE INDEX "Commune_region_idx" ON "Commune"("region");

-- CreateIndex
CREATE INDEX "Commune_nameFr_idx" ON "Commune"("nameFr");

-- CreateIndex
CREATE INDEX "PostalCode_communeId_idx" ON "PostalCode"("communeId");

-- CreateIndex
CREATE INDEX "Bureau_organismeId_type_idx" ON "Bureau"("organismeId", "type");

-- CreateIndex
CREATE INDEX "Bureau_type_idx" ON "Bureau"("type");

-- CreateIndex
CREATE INDEX "Bureau_communeId_idx" ON "Bureau"("communeId");

-- CreateIndex
CREATE INDEX "Bureau_postalCode_idx" ON "Bureau"("postalCode");

-- CreateIndex
CREATE INDEX "Bureau_active_idx" ON "Bureau"("active");

-- CreateIndex
CREATE INDEX "BureauAssignment_communeId_serviceType_idx" ON "BureauAssignment"("communeId", "serviceType");

-- CreateIndex
CREATE INDEX "BureauAssignment_bureauId_idx" ON "BureauAssignment"("bureauId");

-- AddForeignKey
ALTER TABLE "Commune" ADD CONSTRAINT "Commune_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostalCode" ADD CONSTRAINT "PostalCode_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bureau" ADD CONSTRAINT "Bureau_organismeId_fkey" FOREIGN KEY ("organismeId") REFERENCES "Organisme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bureau" ADD CONSTRAINT "Bureau_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BureauAssignment" ADD CONSTRAINT "BureauAssignment_bureauId_fkey" FOREIGN KEY ("bureauId") REFERENCES "Bureau"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BureauAssignment" ADD CONSTRAINT "BureauAssignment_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE CASCADE ON UPDATE CASCADE;
