-- Migration 13 — Bibliothèque canonique de champs
--
-- Étend FieldValidationPreset pour qu'il serve aussi de "template de champ
-- réutilisable" placé via la palette rapide / picker de l'éditeur visuel.

ALTER TABLE "FieldValidationPreset"
  ADD COLUMN "defaultLabel"   TEXT,
  ADD COLUMN "defaultWidth"   INTEGER,
  ADD COLUMN "defaultHeight"  INTEGER,
  ADD COLUMN "defaultValue"   TEXT,
  ADD COLUMN "defaultOptions" JSONB,
  ADD COLUMN "popular"        BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "FieldValidationPreset_popular_idx" ON "FieldValidationPreset"("popular");
