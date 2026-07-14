-- Lot 3 — reprise fine + brouillon serveur anonyme (7 jours) + autosave honnête.
-- Ajouts ADDITIFS et IDEMPOTENTS sur BundleRun (base Neon partagée) :
--   - lastFormId / lastStepId / lastActiveField : repère de reprise (étape stable).
--   - draftPayloads : réponses en cours non validées, { [pdfFormId]: answers },
--     séparé de `payloads` (validé). Purgé à 7 jours + à la validation.
-- Toutes les colonnes sont NULLABLE → aucun backfill, aucun impact sur l'existant.
ALTER TABLE "BundleRun" ADD COLUMN IF NOT EXISTS "lastFormId" TEXT;
ALTER TABLE "BundleRun" ADD COLUMN IF NOT EXISTS "lastStepId" TEXT;
ALTER TABLE "BundleRun" ADD COLUMN IF NOT EXISTS "lastActiveField" TEXT;
ALTER TABLE "BundleRun" ADD COLUMN IF NOT EXISTS "draftPayloads" JSONB;
