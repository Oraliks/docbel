-- Additive independent domain; no reads/writes/references to historical rates.
CREATE TABLE "AutonomousRateVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "original" BYTEA NOT NULL,
  "reading" JSONB NOT NULL,
  "effectiveFrom" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3)
);
CREATE INDEX "AutonomousRateVersion_createdAt_idx" ON "AutonomousRateVersion"("createdAt");
CREATE TABLE "AutonomousRateRegistry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "versionId" TEXT,
  "generation" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE "AutonomousRatePublication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "versionId" TEXT NOT NULL UNIQUE REFERENCES "AutonomousRateVersion"("id") ON DELETE RESTRICT,
  "previousId" TEXT,
  "actorId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "AutonomousRateRegistry" ("id") VALUES ('autonomous-rates');
