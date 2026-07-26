-- Docbel Formations — Lot A : inscription self-service des organismes (additif).
-- 1) FormationOrganization : champs de vérification BCE/KBO + décision admin.
-- 2) FormationOrgInvite : invitations d'équipe par email (token opaque).
-- Aucune table existante supprimée ; aucune colonne existante modifiée.

-- AlterTable: FormationOrganization — vérification & workflow d'inscription
ALTER TABLE "FormationOrganization"
  ADD COLUMN "enterpriseNumber" TEXT,
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "enterpriseVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "enterpriseVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "street" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactRole" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "rejectedReason" TEXT;

-- CreateIndex
CREATE INDEX "FormationOrganization_enterpriseNumber_idx" ON "FormationOrganization"("enterpriseNumber");

-- CreateTable
CREATE TABLE "FormationOrgInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormationOrgInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormationOrgInvite_token_key" ON "FormationOrgInvite"("token");
CREATE UNIQUE INDEX "FormationOrgInvite_organizationId_email_key" ON "FormationOrgInvite"("organizationId","email");
CREATE INDEX "FormationOrgInvite_email_idx" ON "FormationOrgInvite"("email");
CREATE INDEX "FormationOrgInvite_status_idx" ON "FormationOrgInvite"("status");

-- AddForeignKey
ALTER TABLE "FormationOrgInvite" ADD CONSTRAINT "FormationOrgInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "FormationOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
