-- Migration 39 — Champ "reason" sur AdminImpersonationLog (Phase C #11)
--
-- Applique via `prisma db execute` (base Neon partagee) — additif &
-- idempotent. Champ optionnel : en dev pas force, en prod requis cote API
-- /api/admin/impersonate (modal de confirmation dans ViewAsMenu).
--
-- Le numero 39 prend la place suivante apres :
--   - 32_rendez_vous_history
--   - 33_rdv_history_access
--   - 34_drop_legacy_documents
--   - 35_add_impersonation_audit (deja en main)
--   - 36..38 reserves pour les sessions paralleles d'autres agents (booking)

ALTER TABLE "AdminImpersonationLog" ADD COLUMN IF NOT EXISTS "reason" TEXT;
