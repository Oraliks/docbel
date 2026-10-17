-- PRÉPARATION UNIQUEMENT — NE PAS EXÉCUTER AUTOMATIQUEMENT.
--
-- Objectif : compléter les transactions applicatives par une protection DB
-- contre deux BaremeFile `published` de même fileType, y compris si une écriture
-- contourne l'application. PostgreSQL / Neon ; aucun prisma db push.
--
-- 1. Inventaire borné, lecture seule : exécuter d'abord en production.
SELECT
  "fileType",
  COUNT(*) AS published_count,
  ARRAY_AGG("id" ORDER BY "publishedAt" DESC NULLS LAST) AS file_ids
FROM "BaremeFile"
WHERE "status" = 'published'
GROUP BY "fileType"
ORDER BY published_count DESC, "fileType"
LIMIT 100;

-- 2. Détection détaillée des doublons : AUCUN nettoyage automatique.
SELECT
  "id", "name", "fileType", "status", "validFrom", "publishedAt", "createdAt"
FROM "BaremeFile"
WHERE "status" = 'published'
  AND "fileType" IN (
    SELECT "fileType"
    FROM "BaremeFile"
    WHERE "status" = 'published'
    GROUP BY "fileType"
    HAVING COUNT(*) > 1
  )
ORDER BY "fileType", "publishedAt" DESC NULLS LAST, "id";

-- Attendu avant l'étape 3 : zéro ligne au second SELECT. Si des doublons
-- existent, les examiner et décider manuellement (publication/rollback) avant
-- de créer l'index. Ne pas exécuter l'étape 3 tant que ce n'est pas le cas.

-- 3. À exécuter séparément, hors transaction, APRÈS validation de l'inventaire.
-- CREATE UNIQUE INDEX CONCURRENTLY "BaremeFile_one_published_per_fileType"
--   ON "BaremeFile" ("fileType")
--   WHERE "status" = 'published';

-- 4. Rollback si nécessaire (hors transaction) :
-- DROP INDEX CONCURRENTLY IF EXISTS "BaremeFile_one_published_per_fileType";
