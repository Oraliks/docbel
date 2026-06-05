-- Migration 36 — Plateforme de prise de rendez-vous (booking) multi-tenant.
--
-- ⚠️ APPLIQUÉE VIA `prisma db execute` — PAS `prisma migrate` NI `db push`.
-- La base Neon est PARTAGÉE et contient des données réelles (embeddings
-- pgvector non représentables par Prisma, tables PDF) qu'un push détruirait.
-- Toutes les opérations ci-dessous sont strictement ADDITIVES et idempotentes
-- (CREATE TYPE via DO-block, CREATE TABLE/INDEX IF NOT EXISTS). Aucune table
-- existante n'est modifiée — les références vers User/Bureau/Organisme/Commune
-- sont des colonnes TEXT libres (pas de FK), comme RendezVousHistory.
--
-- Cf. lib/booking/* (logique) et prisma/schema.prisma (modèles).

-- 1) Enums --------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "BookingCategory" AS ENUM ('unemployment', 'social_aid', 'municipal', 'private', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BookingMemberRole" AS ENUM ('owner', 'manager', 'agent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BookingExceptionKind" AS ENUM ('closed', 'extra');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BookingDedupeField" AS ENUM ('email', 'name', 'nrn', 'none');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('pending_approval', 'confirmed', 'rejected', 'cancelled_citizen', 'cancelled_partner', 'no_show', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Tables -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "BookingTenant" (
  "id"                    TEXT NOT NULL,
  "slug"                  TEXT NOT NULL,
  "name"                  TEXT NOT NULL,
  "category"              "BookingCategory" NOT NULL DEFAULT 'other',
  "organismeId"           TEXT,
  "partnerOrganization"   TEXT,
  "logoUrl"               TEXT,
  "brandColor"            TEXT,
  "emailFromName"         TEXT,
  "formFields"            JSONB NOT NULL DEFAULT '[]',
  "requireApproval"       BOOLEAN NOT NULL DEFAULT true,
  "autoApproveAfterHours" INTEGER NOT NULL DEFAULT 48,
  "dedupeField"           "BookingDedupeField" NOT NULL DEFAULT 'email',
  "dedupeWindowDays"      INTEGER NOT NULL DEFAULT 30,
  "active"                BOOLEAN NOT NULL DEFAULT true,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingTenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BookingTenantMember" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "role"      "BookingMemberRole" NOT NULL DEFAULT 'agent',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingTenantMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingTenantMember_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "BookingTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "BookingLocation" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "bureauId"   TEXT,
  "street"     TEXT,
  "postalCode" TEXT,
  "city"       TEXT,
  "lat"        DOUBLE PRECISION,
  "lng"        DOUBLE PRECISION,
  "active"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingLocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingLocation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "BookingTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "BookingSlotRule" (
  "id"          TEXT NOT NULL,
  "locationId"  TEXT NOT NULL,
  "weekday"     INTEGER NOT NULL,
  "startTime"   TEXT NOT NULL,
  "endTime"     TEXT NOT NULL,
  "capacity"    INTEGER NOT NULL DEFAULT 1,
  "serviceCode" TEXT,
  "validFrom"   TIMESTAMP(3),
  "validUntil"  TIMESTAMP(3),
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingSlotRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingSlotRule_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "BookingLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "BookingException" (
  "id"          TEXT NOT NULL,
  "locationId"  TEXT NOT NULL,
  "date"        TEXT NOT NULL,
  "kind"        "BookingExceptionKind" NOT NULL,
  "slots"       JSONB NOT NULL DEFAULT '[]',
  "reason"      TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingException_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingException_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "BookingLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Booking" (
  "id"                    TEXT NOT NULL,
  "tenantId"              TEXT NOT NULL,
  "locationId"            TEXT NOT NULL,
  "date"                  TEXT NOT NULL,
  "startTime"             TEXT NOT NULL,
  "endTime"               TEXT NOT NULL,
  "serviceCode"           TEXT,
  "formData"              JSONB NOT NULL DEFAULT '{}',
  "citizenName"           TEXT,
  "citizenNameNormalized" TEXT,
  "citizenEmail"          TEXT,
  "citizenPhone"          TEXT,
  "citizenNrnHash"        TEXT,
  "citizenNrnLast4"       TEXT,
  "citizenPostalCode"     TEXT,
  "citizenCommuneId"      TEXT,
  "userId"                TEXT,
  "status"                "BookingStatus" NOT NULL DEFAULT 'pending_approval',
  "confirmationToken"     TEXT NOT NULL,
  "autoApproved"          BOOLEAN NOT NULL DEFAULT false,
  "confirmedAt"           TIMESTAMP(3),
  "approvedById"          TEXT,
  "approvedAt"            TIMESTAMP(3),
  "rejectedById"          TEXT,
  "rejectionReason"       TEXT,
  "cancelReason"          TEXT,
  "cancelledAt"           TIMESTAMP(3),
  "reminderSentAt"        TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Booking_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "BookingTenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Booking_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "BookingLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3) Index --------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "BookingTenant_slug_key" ON "BookingTenant"("slug");
CREATE INDEX IF NOT EXISTS "BookingTenant_active_idx" ON "BookingTenant"("active");
CREATE INDEX IF NOT EXISTS "BookingTenant_partnerOrganization_idx" ON "BookingTenant"("partnerOrganization");

CREATE UNIQUE INDEX IF NOT EXISTS "BookingTenantMember_tenantId_userId_key" ON "BookingTenantMember"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "BookingTenantMember_userId_idx" ON "BookingTenantMember"("userId");

CREATE INDEX IF NOT EXISTS "BookingLocation_tenantId_active_idx" ON "BookingLocation"("tenantId", "active");

CREATE INDEX IF NOT EXISTS "BookingSlotRule_locationId_weekday_active_idx" ON "BookingSlotRule"("locationId", "weekday", "active");

CREATE INDEX IF NOT EXISTS "BookingException_locationId_date_idx" ON "BookingException"("locationId", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_confirmationToken_key" ON "Booking"("confirmationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_locationId_date_startTime_citizenEmail_key" ON "Booking"("locationId", "date", "startTime", "citizenEmail");
CREATE INDEX IF NOT EXISTS "Booking_tenantId_status_createdAt_idx" ON "Booking"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Booking_locationId_date_status_idx" ON "Booking"("locationId", "date", "status");
CREATE INDEX IF NOT EXISTS "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Booking_tenantId_citizenEmail_idx" ON "Booking"("tenantId", "citizenEmail");
CREATE INDEX IF NOT EXISTS "Booking_tenantId_citizenNameNormalized_idx" ON "Booking"("tenantId", "citizenNameNormalized");
CREATE INDEX IF NOT EXISTS "Booking_tenantId_citizenNrnHash_idx" ON "Booking"("tenantId", "citizenNrnHash");
