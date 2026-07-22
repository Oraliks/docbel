-- Migration additive : remplace le défaut périmé "#7C3AED" (hors-palette) des
-- colonnes `color` par un défaut système, pour éviter la régression sur les
-- nouveaux rows après l'harmonisation couleurs 2026-07-22.
--   - DocumentBundle → ""  (le mapping code CATEGORY_HUE reprend la main)
--   - News / Category / Organisme / TrainingCategory / OrientationBranch → #5B46E5
-- Non destructif : ne touche PAS les données existantes, seulement le DEFAULT
-- appliqué aux futurs INSERT. Idempotent (SET DEFAULT rejouable).
-- À appliquer via : npx prisma db execute --file prisma/migrations/harmonize_color_defaults.sql --schema prisma/schema.prisma

ALTER TABLE "DocumentBundle" ALTER COLUMN "color" SET DEFAULT '';
ALTER TABLE "News" ALTER COLUMN "color" SET DEFAULT '#5B46E5';
ALTER TABLE "Category" ALTER COLUMN "color" SET DEFAULT '#5B46E5';
ALTER TABLE "Organisme" ALTER COLUMN "color" SET DEFAULT '#5B46E5';
ALTER TABLE "TrainingCategory" ALTER COLUMN "color" SET DEFAULT '#5B46E5';
ALTER TABLE "OrientationBranch" ALTER COLUMN "color" SET DEFAULT '#5B46E5';
