-- Docbel Employeur — Modules 2 & 5 (additif uniquement).
-- Tables: CostSimulation (simulateur de coût), DocumentDraft (documents
-- préparatoires). Aucune modification de table existante.

-- CreateTable
CREATE TABLE "CostSimulation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "title" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "grossMonthlySalary" DOUBLE PRECISION NOT NULL,
    "estimatedEmployerContributions" DOUBLE PRECISION NOT NULL,
    "estimatedMonthlyEmployerCost" DOUBLE PRECISION NOT NULL,
    "estimatedAnnualEmployerCost" DOUBLE PRECISION NOT NULL,
    "estimatedNetSalary" DOUBLE PRECISION,
    "assumptions" JSONB,
    "missingData" JSONB,
    "reliability" TEXT NOT NULL DEFAULT 'low',
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostSimulation_userId_idx" ON "CostSimulation"("userId");

-- CreateIndex
CREATE INDEX "CostSimulation_scenarioId_idx" ON "CostSimulation"("scenarioId");

-- CreateIndex
CREATE INDEX "DocumentDraft_userId_idx" ON "DocumentDraft"("userId");

-- CreateIndex
CREATE INDEX "DocumentDraft_scenarioId_idx" ON "DocumentDraft"("scenarioId");

-- AddForeignKey
ALTER TABLE "CostSimulation" ADD CONSTRAINT "CostSimulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDraft" ADD CONSTRAINT "DocumentDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
