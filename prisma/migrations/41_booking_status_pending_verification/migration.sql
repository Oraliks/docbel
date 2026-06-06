-- Migration 41 — Ajoute la valeur d'enum BookingStatus.pending_verification (F).
--
-- ⚠️ APPLIQUÉE VIA `prisma db execute` — additive & idempotente (Neon partagée).
-- Fichier séparé : `ALTER TYPE ... ADD VALUE` s'exécute seul (hors transaction
-- multi-statements), et la nouvelle valeur ne peut être utilisée que dans une
-- transaction ultérieure — ce qui est le cas (book route après migration).

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'pending_verification';
