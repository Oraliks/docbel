-- Docbel Employeur — MVP Phase 1 (additif uniquement).
-- Tables: EmployerProfile, WorkerScenario, EmployerChecklist, ChecklistItem,
-- EmployerLegalSource, EmployerRule. Aucune modification de table existante.

-- CreateTable
CREATE TABLE "EmployerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationName" TEXT,
    "legalForm" TEXT,
    "enterpriseNumber" TEXT,
    "hasEmployees" BOOLEAN,
    "hasOnssNumber" BOOLEAN,
    "onssNumber" TEXT,
    "region" TEXT,
    "sector" TEXT,
    "naceCode" TEXT,
    "jointCommitteeKnown" BOOLEAN NOT NULL DEFAULT false,
    "jointCommitteeNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerScenario" (
    "id" TEXT NOT NULL,
    "employerProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "workerType" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "functionTitle" TEXT,
    "workplace" TEXT,
    "weeklyHours" DOUBLE PRECISION,
    "fullTimeReferenceHours" DOUBLE PRECISION,
    "scheduleType" TEXT,
    "grossMonthlySalary" DOUBLE PRECISION,
    "benefits" JSONB,
    "region" TEXT,
    "jointCommitteeNumber" TEXT,
    "nightWork" BOOLEAN,
    "sundayWork" BOOLEAN,
    "saturdayWork" BOOLEAN,
    "telework" BOOLEAN,
    "reliabilityScore" TEXT,
    "alerts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerChecklist" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sourceVersion" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployerChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "legalBasisRef" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'recommande',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "dueDate" TIMESTAMP(3),
    "tooltip" TEXT,
    "adminExplanation" TEXT,
    "sourceCode" TEXT,
    "ruleCode" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerLegalSource" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentSummary" TEXT,
    "reliability" TEXT,
    "appliesToModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastCheckedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployerLegalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "conditionJson" JSONB NOT NULL,
    "outputJson" JSONB NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "sourceCode" TEXT,
    "internalNote" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployerRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployerProfile_userId_idx" ON "EmployerProfile"("userId");

-- CreateIndex
CREATE INDEX "WorkerScenario_employerProfileId_idx" ON "WorkerScenario"("employerProfileId");

-- CreateIndex
CREATE INDEX "EmployerChecklist_scenarioId_idx" ON "EmployerChecklist"("scenarioId");

-- CreateIndex
CREATE INDEX "ChecklistItem_checklistId_idx" ON "ChecklistItem"("checklistId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerLegalSource_code_key" ON "EmployerLegalSource"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerRule_code_key" ON "EmployerRule"("code");

-- AddForeignKey
ALTER TABLE "EmployerProfile" ADD CONSTRAINT "EmployerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerScenario" ADD CONSTRAINT "WorkerScenario_employerProfileId_fkey" FOREIGN KEY ("employerProfileId") REFERENCES "EmployerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerChecklist" ADD CONSTRAINT "EmployerChecklist_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "WorkerScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "EmployerChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
