-- Docbel Formations — V2 (additif uniquement). Colonnes ajoutées + 5 tables.
-- Aucune table existante n'est supprimée ; aucune contrainte FK ajoutée hors module.

-- AlterTable: OrganizationTrainingPermission — capacités V3/V4 (OFF par défaut)
ALTER TABLE "OrganizationTrainingPermission"
  ADD COLUMN "canCreateLearningModules" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canCreateQuizzes" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canManageTrainingPaths" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canUseMarketplace" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canReceivePayments" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canUsePartnerApi" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Training — paiement provider + sponsoring + score qualité
ALTER TABLE "Training"
  ADD COLUMN "paymentProvider" TEXT,
  ADD COLUMN "isSponsored" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "qualityScore" DOUBLE PRECISION;

-- AlterTable: TrainingEnrollment — paiement manuel + lien certificat
ALTER TABLE "TrainingEnrollment"
  ADD COLUMN "paymentStatus" TEXT,
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "certificateId" TEXT;

-- CreateTable
CREATE TABLE "TrainingCertificate" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "sessionId" TEXT,
    "enrollmentId" TEXT,
    "userId" TEXT,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'participation',
    "status" TEXT NOT NULL DEFAULT 'issued',
    "certificateNumber" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "holderName" TEXT NOT NULL,
    "trainingTitle" TEXT NOT NULL,
    "orgName" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingNotificationLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientEmail" TEXT,
    "organizationId" TEXT,
    "trainingId" TEXT,
    "sessionId" TEXT,
    "enrollmentId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'inapp',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT,
    "sessionId" TEXT,
    "organizationId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "source" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingReview" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "sessionId" TEXT,
    "enrollmentId" TEXT,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "clarityRating" INTEGER,
    "usefulnessRating" INTEGER,
    "organizationRating" INTEGER,
    "comment" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingContextRecommendation" (
    "id" TEXT NOT NULL,
    "contextKey" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingContextRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCertificate_certificateNumber_key" ON "TrainingCertificate"("certificateNumber");
CREATE UNIQUE INDEX "TrainingCertificate_verificationCode_key" ON "TrainingCertificate"("verificationCode");
CREATE INDEX "TrainingCertificate_trainingId_idx" ON "TrainingCertificate"("trainingId");
CREATE INDEX "TrainingCertificate_userId_idx" ON "TrainingCertificate"("userId");
CREATE INDEX "TrainingCertificate_enrollmentId_idx" ON "TrainingCertificate"("enrollmentId");

CREATE INDEX "TrainingNotificationLog_recipientId_createdAt_idx" ON "TrainingNotificationLog"("recipientId","createdAt");
CREATE INDEX "TrainingNotificationLog_trainingId_idx" ON "TrainingNotificationLog"("trainingId");
CREATE INDEX "TrainingNotificationLog_type_idx" ON "TrainingNotificationLog"("type");

CREATE INDEX "TrainingAnalyticsEvent_trainingId_eventType_idx" ON "TrainingAnalyticsEvent"("trainingId","eventType");
CREATE INDEX "TrainingAnalyticsEvent_eventType_createdAt_idx" ON "TrainingAnalyticsEvent"("eventType","createdAt");

CREATE INDEX "TrainingReview_trainingId_status_idx" ON "TrainingReview"("trainingId","status");
CREATE INDEX "TrainingReview_userId_idx" ON "TrainingReview"("userId");

CREATE UNIQUE INDEX "TrainingContextRecommendation_contextKey_trainingId_key" ON "TrainingContextRecommendation"("contextKey","trainingId");
CREATE INDEX "TrainingContextRecommendation_contextKey_isActive_idx" ON "TrainingContextRecommendation"("contextKey","isActive");
