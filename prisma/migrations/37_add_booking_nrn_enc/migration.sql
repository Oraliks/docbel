-- Migration 37 — NRN chiffré au repos pour la plateforme de booking.
--
-- ⚠️ APPLIQUÉE VIA `prisma db execute` — additive & idempotente (base Neon
-- partagée). Ajoute la colonne du NRN chiffré (AES-256-GCM), déchiffré à la
-- demande pour l'affichage aux agents autorisés. Le NRN n'est jamais stocké en
-- clair ; `citizenNrnHash` (HMAC) reste pour le dedupe, `citizenNrnLast4` pour
-- l'affichage compact.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "citizenNrnEnc" TEXT;
