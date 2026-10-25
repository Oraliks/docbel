CREATE TABLE "AutonomousRateDecision" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "referenceId" TEXT,
  "fingerprint" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "officialSource" TEXT,
  "regulatoryScope" TEXT,
  "effectiveDate" TIMESTAMP(3),
  "evidence" JSONB NOT NULL,
  "previousId" TEXT,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutonomousRateDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AutonomousRateDecision_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AutonomousRateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AutonomousRateDecision_review_idx" ON "AutonomousRateDecision"("candidateId", "fingerprint", "taskId", "createdAt");
