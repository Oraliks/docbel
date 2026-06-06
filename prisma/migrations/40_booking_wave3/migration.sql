-- Migration 40 — Booking vague 3 : déblocage doublon, no-show, liste d'attente,
-- outils responsable (notes/attribution), double opt-in, i18n.
--
-- ⚠️ APPLIQUÉE VIA `prisma db execute` — additive & idempotente (Neon partagée).
-- JAMAIS `prisma db push` (détruit pgvector + tables PDF).

-- B : relance no-show + confirmation de présence
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "noShowFollowupSentAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "presenceConfirmedAt" TIMESTAMP(3);

-- F : double opt-in (vérification email)
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "BookingTenant" ADD COLUMN IF NOT EXISTS "requireEmailVerification" BOOLEAN NOT NULL DEFAULT false;

-- D : note interne + attribution à un agent
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "internalNote" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "assignedToName" TEXT;

-- G : langue choisie par le citoyen (fr|nl|en|de)
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "locale" TEXT;

-- C : liste d'attente
CREATE TABLE IF NOT EXISTS "BookingWaitlist" (
  "id"                    TEXT NOT NULL,
  "tenantId"              TEXT NOT NULL,
  "locationId"            TEXT NOT NULL,
  "date"                  TEXT NOT NULL,
  "startTime"             TEXT NOT NULL,
  "citizenName"           TEXT,
  "citizenNameNormalized" TEXT,
  "citizenEmail"          TEXT,
  "citizenPhone"          TEXT,
  "citizenNrnHash"        TEXT,
  "citizenNrnLast4"       TEXT,
  "citizenPostalCode"     TEXT,
  "userId"                TEXT,
  "status"                TEXT NOT NULL DEFAULT 'waiting',
  "notifiedAt"            TIMESTAMP(3),
  "notifyToken"           TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingWaitlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookingWaitlist_notifyToken_key"
  ON "BookingWaitlist" ("notifyToken");
CREATE INDEX IF NOT EXISTS "BookingWaitlist_locationId_date_startTime_status_idx"
  ON "BookingWaitlist" ("locationId", "date", "startTime", "status");
CREATE INDEX IF NOT EXISTS "BookingWaitlist_tenantId_idx"
  ON "BookingWaitlist" ("tenantId");
