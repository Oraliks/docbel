-- Migration 12 — Onboarding extensions
--
-- Ajoute :
--   * Sur DocumentBundle : champs pour l'onboarding "Quelle est ma situation ?"
--     (catégorie événement de vie, flag d'affichage, tags vocabulaire,
--      questions de pré-qualification informatives, avertissements).
--   * Sur BundleRun : système de code de reprise lisible utilisateur (au-delà
--     du cookie de session), email optionnel pour rappel, réponses au
--     questionnaire de pré-qualification.

-- ============================================================================
-- DocumentBundle
-- ============================================================================

ALTER TABLE "DocumentBundle"
  ADD COLUMN "lifeEventCategory"    TEXT,
  ADD COLUMN "showOnOnboarding"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vocabularyTags"       JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN "eligibilityQuestions" JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN "warnings"             JSONB   NOT NULL DEFAULT '[]';

CREATE INDEX "DocumentBundle_showOnOnboarding_idx"   ON "DocumentBundle"("showOnOnboarding");
CREATE INDEX "DocumentBundle_lifeEventCategory_idx"  ON "DocumentBundle"("lifeEventCategory");

-- ============================================================================
-- BundleRun
-- ============================================================================

ALTER TABLE "BundleRun"
  ADD COLUMN "resumeCode"           TEXT,
  ADD COLUMN "resumeCodeExpiresAt"  TIMESTAMP(3),
  ADD COLUMN "resumeEmail"          TEXT,
  ADD COLUMN "eligibilityAnswers"   JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX "BundleRun_resumeCode_key"            ON "BundleRun"("resumeCode");
CREATE        INDEX "BundleRun_resumeCodeExpiresAt_idx"   ON "BundleRun"("resumeCodeExpiresAt");
