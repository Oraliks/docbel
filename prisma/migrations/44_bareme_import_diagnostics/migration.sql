-- Diagnostics d'import des barèmes ONEM : taille du fichier source et
-- diagnostics structurés (codes inconnus, lignes ignorées, feuilles non
-- supportées, périodes par feuille, doublons). Additif uniquement — la DB Neon
-- est partagée entre plusieurs branches de travail.

ALTER TABLE "BaremeFile" ADD COLUMN IF NOT EXISTS "fileSize" INTEGER;
ALTER TABLE "BaremeFile" ADD COLUMN IF NOT EXISTS "diagnostics" JSONB;
