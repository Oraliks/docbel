-- CreateTable
CREATE TABLE "U1Institution" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT,
    "organization" TEXT NOT NULL,
    "department" TEXT,
    "alternateName" TEXT,
    "addressLines" JSONB NOT NULL DEFAULT '[]',
    "postalAddress" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "website" TEXT,
    "emails" JSONB NOT NULL DEFAULT '[]',
    "extra" JSONB,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "U1Institution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "U1Institution_country_key" ON "U1Institution"("country");

-- CreateIndex
CREATE INDEX "U1Institution_country_idx" ON "U1Institution"("country");
