-- CreateTable
CREATE TABLE "RendezVousHistory" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RendezVousHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RendezVousHistory_scope_nameNormalized_date_startTime_key" ON "RendezVousHistory"("scope", "nameNormalized", "date", "startTime");

-- CreateIndex
CREATE INDEX "RendezVousHistory_scope_nameNormalized_idx" ON "RendezVousHistory"("scope", "nameNormalized");

-- CreateIndex
CREATE INDEX "RendezVousHistory_scope_date_idx" ON "RendezVousHistory"("scope", "date");
