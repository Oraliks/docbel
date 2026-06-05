-- Migration 32 — Impersonation admin + audit log.
--
-- Appliquée via `prisma db execute` (base Neon partagée) — additif &
-- idempotent. Active le plugin admin de Better Auth :
--   * "Session.impersonatedBy" : id de l'admin qui a déclenché l'impersonation
--     (NULL = session normale). Better Auth pose ce champ via
--     auth.api.impersonateUser({ userId }).
--   * "AdminImpersonationLog" : table d'audit dédiée (Better Auth ne logge
--     pas, on log nous-mêmes côté API route).

ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "impersonatedBy" TEXT;
CREATE INDEX IF NOT EXISTS "Session_impersonatedBy_idx" ON "Session"("impersonatedBy");

-- Champs ban requis par le schema du plugin admin (cf. node_modules/better-auth/.../admin/schema.mjs).
-- On ne se sert pas du ban dans l'UI pour l'instant (pas de "désactiver un user partenaire"),
-- mais Better Auth les sélectionne lors du getSession, donc les colonnes doivent exister.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banned"     BOOLEAN   NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banReason"  TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banExpires" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AdminImpersonationLog" (
  "id"         TEXT PRIMARY KEY,
  "adminId"    TEXT NOT NULL,
  "targetId"   TEXT NOT NULL,
  "ipAddress"  TEXT,
  "userAgent"  TEXT,
  "startedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stoppedAt"  TIMESTAMP(3),
  CONSTRAINT "AdminImpersonationLog_admin_fk"
    FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "AdminImpersonationLog_target_fk"
    FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "AdminImpersonationLog_adminId_idx"   ON "AdminImpersonationLog"("adminId");
CREATE INDEX IF NOT EXISTS "AdminImpersonationLog_targetId_idx"  ON "AdminImpersonationLog"("targetId");
CREATE INDEX IF NOT EXISTS "AdminImpersonationLog_startedAt_idx" ON "AdminImpersonationLog"("startedAt");
