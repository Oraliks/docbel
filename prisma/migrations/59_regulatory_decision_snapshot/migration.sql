-- Additive snapshot of the applied regulatory decision for a BundleRun.
-- Existing runs intentionally remain NULL: no historical decision is inferred.
ALTER TABLE "BundleRun" ADD COLUMN IF NOT EXISTS "regulatoryDecisionSnapshot" JSONB;
