-- Migration 23 — Modèle d'accès 3 segments (citoyen / employeur / partenaire)
-- + sous-types partenaire + entitlements (accès outil par ensemble + flag billing).
--
-- ⚠️ APPLIQUÉE VIA `prisma db execute` — PAS `prisma migrate` NI `db push`.
-- La base Neon est PARTAGÉE et contient des données réelles qu'un push
-- détruirait : embeddings pgvector (KnowledgeChunk.embedding, type `vector`
-- non représentable par Prisma) et les tables PDF de la branche
-- feat/native-pdf-detection (PdfForm/…). Toutes les opérations ci-dessous sont
-- strictement ADDITIVES et idempotentes (IF NOT EXISTS / DROP NOT NULL).
--
-- Cf. lib/audience.ts (segments) et lib/entitlements.ts (canUseTool).

-- 1) UserRole : l'employeur devient un rôle de première classe (à côté de partner).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'employer';

-- 2) User : segment d'accès + sous-type partenaire portés par le compte.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "segment" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "partnerType" TEXT;
CREATE INDEX IF NOT EXISTS "User_segment_idx" ON "User"("segment");

-- 3) PartnerDomain → liste d'autorisations généralisée : match par domaine OU
--    email exact, porteuse du segment + sous-type. `domain` devient nullable
--    (entrées de type email). Unicité ajoutée sur `email`.
ALTER TABLE "PartnerDomain" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'domain';
ALTER TABLE "PartnerDomain" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "PartnerDomain" ADD COLUMN IF NOT EXISTS "segment" TEXT NOT NULL DEFAULT 'partenaire';
ALTER TABLE "PartnerDomain" ADD COLUMN IF NOT EXISTS "partnerType" TEXT;
ALTER TABLE "PartnerDomain" ALTER COLUMN "domain" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerDomain_email_key" ON "PartnerDomain"("email");
CREATE INDEX IF NOT EXISTS "PartnerDomain_segment_idx" ON "PartnerDomain"("segment");

-- 4) Tool : accès par ENSEMBLE {segment, partnerType?}. Array JSON ; vide =
--    fallback sur la hiérarchie `audience` legacy le temps de la migration.
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "access" JSONB NOT NULL DEFAULT '[]';
