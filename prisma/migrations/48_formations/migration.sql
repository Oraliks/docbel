-- Docbel Formations — Module V1 (additif uniquement, aucune modification de table existante).
-- Tables : FormationOrganization, FormationOrgMember, OrganizationTrainingPermission,
-- TrainingCategory, TrainingTag, TrainingTagOnTraining, TrainingBadge, TrainingBadgeOnTraining,
-- Training, TrainingSession, TrainingEnrollment, TrainingSaved, TrainingAccessRule, TrainingReport,
-- OrientationBranch, OrientationQuestion, OrientationAnswerOption, OrientationAnswerScore, OrientationResult.
-- Réfs vers User/Organisme = String brut sans FK (isolation). FK + Cascade uniquement intra-module.

-- CreateTable
CREATE TABLE "FormationOrganization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'partenaire',
    "organismeId" TEXT,
    "partnerOrganization" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "website" TEXT,
    "contactEmail" TEXT,
    "notifyEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormationOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationOrgMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormationOrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationTrainingPermission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "canCreateTraining" BOOLEAN NOT NULL DEFAULT true,
    "canSubmitTraining" BOOLEAN NOT NULL DEFAULT true,
    "canPublishDirectly" BOOLEAN NOT NULL DEFAULT false,
    "canCreatePublicTraining" BOOLEAN NOT NULL DEFAULT true,
    "canCreatePaidTraining" BOOLEAN NOT NULL DEFAULT true,
    "canCreatePrivateTraining" BOOLEAN NOT NULL DEFAULT false,
    "canCreateInternalTraining" BOOLEAN NOT NULL DEFAULT false,
    "canManageSessions" BOOLEAN NOT NULL DEFAULT true,
    "canManageEnrollments" BOOLEAN NOT NULL DEFAULT true,
    "canViewParticipantData" BOOLEAN NOT NULL DEFAULT true,
    "canExportParticipants" BOOLEAN NOT NULL DEFAULT false,
    "canIssueCertificate" BOOLEAN NOT NULL DEFAULT false,
    "canUseDocbelBadge" BOOLEAN NOT NULL DEFAULT false,
    "canRequestFeaturedPlacement" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationTrainingPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#7C3AED',
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "isOrientationTag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTagOnTraining" (
    "trainingId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TrainingTagOnTraining_pkey" PRIMARY KEY ("trainingId","tagId")
);

-- CreateTable
CREATE TABLE "TrainingBadge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "controlledByAdmin" BOOLEAN NOT NULL DEFAULT true,
    "icon" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingBadgeOnTraining" (
    "trainingId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingBadgeOnTraining_pkey" PRIMARY KEY ("trainingId","badgeId")
);

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organismeId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetAudience" TEXT,
    "prerequisites" TEXT,
    "level" TEXT NOT NULL DEFAULT 'debutant',
    "language" TEXT NOT NULL DEFAULT 'fr',
    "categoryId" TEXT,
    "secondaryCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "format" TEXT NOT NULL DEFAULT 'online',
    "durationHours" DOUBLE PRECISION,
    "durationDays" DOUBLE PRECISION,
    "totalDurationLabel" TEXT,
    "rhythm" TEXT,
    "hasSessions" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "visibility" TEXT NOT NULL DEFAULT 'draft',
    "priceType" TEXT NOT NULL DEFAULT 'free',
    "priceAmount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "priceVatIncluded" BOOLEAN,
    "externalPaymentUrl" TEXT,
    "paymentInfo" TEXT,
    "cancellationPolicy" TEXT,
    "refundPolicy" TEXT,
    "certificateType" TEXT NOT NULL DEFAULT 'none',
    "certificateDescription" TEXT,
    "coverImageUrl" TEXT,
    "logoUrl" TEXT,
    "programPdfUrl" TEXT,
    "attachmentUrl" TEXT,
    "externalUrl" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactWebsite" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isDocbelRecommended" BOOLEAN NOT NULL DEFAULT false,
    "isVerifiedByDocbel" BOOLEAN NOT NULL DEFAULT false,
    "adminReviewNote" TEXT,
    "rejectedReason" TEXT,
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "instructorId" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "mode" TEXT NOT NULL DEFAULT 'online',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Brussels',
    "locationName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "onlineUrl" TEXT,
    "capacity" INTEGER,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "registrationDeadline" TIMESTAMP(3),
    "requiresManualApproval" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEnrollment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "citizenName" TEXT,
    "citizenEmail" TEXT,
    "citizenEmailNormalized" TEXT,
    "citizenPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "message" TEXT,
    "motivation" TEXT,
    "adminNote" TEXT,
    "organizationNote" TEXT,
    "confirmationToken" TEXT NOT NULL,
    "locale" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "refusedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attendanceMarkedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "certificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSaved" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSaved_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAccessRule" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "email" TEXT,
    "role" TEXT,
    "group" TEXT,
    "segment" TEXT,
    "partnerType" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAccessRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingReport" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "reporterId" TEXT,
    "reporterEmail" TEXT,
    "reason" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "adminNote" TEXT,
    "actionTaken" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrientationBranch" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "possibleJobs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#7C3AED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrientationBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrientationQuestion" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'single',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrientationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrientationAnswerOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "helperText" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrientationAnswerOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrientationAnswerScore" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrientationAnswerScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrientationResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "primaryBranchId" TEXT,
    "secondaryBranchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scoresJson" JSONB NOT NULL DEFAULT '{}',
    "answersJson" JSONB NOT NULL DEFAULT '{}',
    "confidenceScore" DOUBLE PRECISION,
    "summary" TEXT,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrientationResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormationOrganization_slug_key" ON "FormationOrganization"("slug");
CREATE INDEX "FormationOrganization_partnerOrganization_idx" ON "FormationOrganization"("partnerOrganization");
CREATE INDEX "FormationOrganization_status_idx" ON "FormationOrganization"("status");
CREATE INDEX "FormationOrganization_type_idx" ON "FormationOrganization"("type");

CREATE UNIQUE INDEX "FormationOrgMember_organizationId_userId_key" ON "FormationOrgMember"("organizationId","userId");
CREATE INDEX "FormationOrgMember_userId_idx" ON "FormationOrgMember"("userId");

CREATE UNIQUE INDEX "OrganizationTrainingPermission_organizationId_key" ON "OrganizationTrainingPermission"("organizationId");

CREATE UNIQUE INDEX "TrainingCategory_slug_key" ON "TrainingCategory"("slug");
CREATE INDEX "TrainingCategory_isActive_idx" ON "TrainingCategory"("isActive");
CREATE INDEX "TrainingCategory_order_idx" ON "TrainingCategory"("order");

CREATE UNIQUE INDEX "TrainingTag_slug_key" ON "TrainingTag"("slug");
CREATE INDEX "TrainingTag_isOrientationTag_idx" ON "TrainingTag"("isOrientationTag");

CREATE INDEX "TrainingTagOnTraining_tagId_idx" ON "TrainingTagOnTraining"("tagId");

CREATE UNIQUE INDEX "TrainingBadge_slug_key" ON "TrainingBadge"("slug");

CREATE INDEX "TrainingBadgeOnTraining_badgeId_idx" ON "TrainingBadgeOnTraining"("badgeId");

CREATE UNIQUE INDEX "Training_slug_key" ON "Training"("slug");
CREATE INDEX "Training_organizationId_idx" ON "Training"("organizationId");
CREATE INDEX "Training_status_idx" ON "Training"("status");
CREATE INDEX "Training_visibility_idx" ON "Training"("visibility");
CREATE INDEX "Training_categoryId_idx" ON "Training"("categoryId");
CREATE INDEX "Training_status_visibility_idx" ON "Training"("status","visibility");
CREATE INDEX "Training_publishedAt_idx" ON "Training"("publishedAt");

CREATE INDEX "TrainingSession_trainingId_idx" ON "TrainingSession"("trainingId");
CREATE INDEX "TrainingSession_organizationId_idx" ON "TrainingSession"("organizationId");
CREATE INDEX "TrainingSession_status_idx" ON "TrainingSession"("status");
CREATE INDEX "TrainingSession_startsAt_idx" ON "TrainingSession"("startsAt");

CREATE UNIQUE INDEX "TrainingEnrollment_confirmationToken_key" ON "TrainingEnrollment"("confirmationToken");
CREATE UNIQUE INDEX "TrainingEnrollment_sessionId_citizenEmailNormalized_key" ON "TrainingEnrollment"("sessionId","citizenEmailNormalized");
CREATE INDEX "TrainingEnrollment_sessionId_status_idx" ON "TrainingEnrollment"("sessionId","status");
CREATE INDEX "TrainingEnrollment_trainingId_idx" ON "TrainingEnrollment"("trainingId");
CREATE INDEX "TrainingEnrollment_organizationId_status_idx" ON "TrainingEnrollment"("organizationId","status");
CREATE INDEX "TrainingEnrollment_userId_idx" ON "TrainingEnrollment"("userId");

CREATE UNIQUE INDEX "TrainingSaved_userId_trainingId_key" ON "TrainingSaved"("userId","trainingId");
CREATE INDEX "TrainingSaved_userId_idx" ON "TrainingSaved"("userId");

CREATE INDEX "TrainingAccessRule_trainingId_idx" ON "TrainingAccessRule"("trainingId");
CREATE INDEX "TrainingAccessRule_email_idx" ON "TrainingAccessRule"("email");
CREATE INDEX "TrainingAccessRule_userId_idx" ON "TrainingAccessRule"("userId");

CREATE INDEX "TrainingReport_trainingId_idx" ON "TrainingReport"("trainingId");
CREATE INDEX "TrainingReport_status_idx" ON "TrainingReport"("status");

CREATE UNIQUE INDEX "OrientationBranch_key_key" ON "OrientationBranch"("key");
CREATE UNIQUE INDEX "OrientationBranch_slug_key" ON "OrientationBranch"("slug");
CREATE INDEX "OrientationBranch_isActive_idx" ON "OrientationBranch"("isActive");

CREATE INDEX "OrientationQuestion_isActive_idx" ON "OrientationQuestion"("isActive");
CREATE INDEX "OrientationQuestion_order_idx" ON "OrientationQuestion"("order");

CREATE INDEX "OrientationAnswerOption_questionId_idx" ON "OrientationAnswerOption"("questionId");

CREATE INDEX "OrientationAnswerScore_optionId_idx" ON "OrientationAnswerScore"("optionId");
CREATE INDEX "OrientationAnswerScore_branchId_idx" ON "OrientationAnswerScore"("branchId");

CREATE INDEX "OrientationResult_userId_idx" ON "OrientationResult"("userId");
CREATE INDEX "OrientationResult_sessionId_idx" ON "OrientationResult"("sessionId");

-- AddForeignKey
ALTER TABLE "FormationOrgMember" ADD CONSTRAINT "FormationOrgMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "FormationOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationTrainingPermission" ADD CONSTRAINT "OrganizationTrainingPermission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "FormationOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingTagOnTraining" ADD CONSTRAINT "TrainingTagOnTraining_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingTagOnTraining" ADD CONSTRAINT "TrainingTagOnTraining_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TrainingTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingBadgeOnTraining" ADD CONSTRAINT "TrainingBadgeOnTraining_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingBadgeOnTraining" ADD CONSTRAINT "TrainingBadgeOnTraining_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "TrainingBadge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Training" ADD CONSTRAINT "Training_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "FormationOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Training" ADD CONSTRAINT "Training_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TrainingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingSaved" ADD CONSTRAINT "TrainingSaved_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingAccessRule" ADD CONSTRAINT "TrainingAccessRule_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrientationAnswerOption" ADD CONSTRAINT "OrientationAnswerOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "OrientationQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrientationAnswerScore" ADD CONSTRAINT "OrientationAnswerScore_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "OrientationAnswerOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrientationAnswerScore" ADD CONSTRAINT "OrientationAnswerScore_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "OrientationBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
