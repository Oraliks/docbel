-- KBO/BCE — Banque-Carrefour des Entreprises (registre belge ouvert)
-- Tables ingérées mensuellement depuis les CSV publics.

-- KboEnterprise
CREATE TABLE "KboEnterprise" (
    "enterpriseNumber" TEXT NOT NULL,
    "status" TEXT,
    "juridicalSituation" TEXT,
    "typeOfEnterprise" TEXT,
    "juridicalForm" TEXT,
    "startDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KboEnterprise_pkey" PRIMARY KEY ("enterpriseNumber")
);

-- KboDenomination
CREATE TABLE "KboDenomination" (
    "id" TEXT NOT NULL,
    "enterpriseNumber" TEXT NOT NULL,
    "language" TEXT,
    "typeOfDenomination" TEXT,
    "denomination" TEXT NOT NULL,

    CONSTRAINT "KboDenomination_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KboDenomination_enterpriseNumber_idx" ON "KboDenomination"("enterpriseNumber");
CREATE INDEX "KboDenomination_denomination_idx" ON "KboDenomination"("denomination");

ALTER TABLE "KboDenomination" ADD CONSTRAINT "KboDenomination_enterpriseNumber_fkey"
    FOREIGN KEY ("enterpriseNumber") REFERENCES "KboEnterprise"("enterpriseNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- KboAddress
CREATE TABLE "KboAddress" (
    "id" TEXT NOT NULL,
    "enterpriseNumber" TEXT NOT NULL,
    "typeOfAddress" TEXT,
    "countryFR" TEXT,
    "countryNL" TEXT,
    "zipcode" TEXT,
    "municipalityFR" TEXT,
    "municipalityNL" TEXT,
    "streetFR" TEXT,
    "streetNL" TEXT,
    "houseNumber" TEXT,
    "box" TEXT,
    "extraAddressInfo" TEXT,
    "dateStrikingOff" TIMESTAMP(3),

    CONSTRAINT "KboAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KboAddress_enterpriseNumber_idx" ON "KboAddress"("enterpriseNumber");
CREATE INDEX "KboAddress_zipcode_idx" ON "KboAddress"("zipcode");

ALTER TABLE "KboAddress" ADD CONSTRAINT "KboAddress_enterpriseNumber_fkey"
    FOREIGN KEY ("enterpriseNumber") REFERENCES "KboEnterprise"("enterpriseNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- KboActivity
CREATE TABLE "KboActivity" (
    "id" TEXT NOT NULL,
    "enterpriseNumber" TEXT NOT NULL,
    "activityGroup" TEXT,
    "naceVersion" TEXT,
    "naceCode" TEXT,
    "classification" TEXT,

    CONSTRAINT "KboActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KboActivity_enterpriseNumber_idx" ON "KboActivity"("enterpriseNumber");
CREATE INDEX "KboActivity_naceCode_idx" ON "KboActivity"("naceCode");

ALTER TABLE "KboActivity" ADD CONSTRAINT "KboActivity_enterpriseNumber_fkey"
    FOREIGN KEY ("enterpriseNumber") REFERENCES "KboEnterprise"("enterpriseNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- KboEtlRun
CREATE TABLE "KboEtlRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "fileName" TEXT,
    "enterprisesUpserted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "KboEtlRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KboEtlRun_startedAt_idx" ON "KboEtlRun"("startedAt");
