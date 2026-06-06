-- Migration 38 — Email de notification équipe par guichet de booking.
--
-- ⚠️ APPLIQUÉE VIA `prisma db execute` — additive & idempotente (Neon partagée).
-- `notifyEmail` : adresse notifiée à chaque nouvelle demande de rendez-vous.

ALTER TABLE "BookingTenant" ADD COLUMN IF NOT EXISTS "notifyEmail" TEXT;
