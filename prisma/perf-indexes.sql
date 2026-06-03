-- ============================================================================
-- Index de performance ADDITIFS — cycle perf (Phase 6, DB).
-- ============================================================================
-- ⚠️  Base Neon PARTAGÉE + projet en PR. NE JAMAIS `prisma db push`
--     (détruirait pgvector + tables PDF). Ce fichier est 100 % additif.
--
-- Toutes les instructions sont idempotentes (IF NOT EXISTS) → ré-exécutables
-- sans danger.
--
-- `CREATE INDEX CONCURRENTLY` = construction NON-bloquante (pas de lock en
-- écriture sur la table), MAIS ne peut PAS tourner dans une transaction.
--
-- Application recommandée — une instruction à la fois, hors transaction :
--
--   psql "$DATABASE_URL" -c 'CREATE INDEX CONCURRENTLY IF NOT EXISTS ...'
--
-- Ou via Prisma (vérifier qu'il n'enveloppe pas dans une transaction ; sinon
-- lancer chaque CONCURRENTLY séparément) :
--
--   pnpm dlx dotenv -e .env.local -- prisma db execute \
--     --schema prisma/schema.prisma --file prisma/perf-indexes.sql
-- ============================================================================

-- 1) Activity — la table n'a AUCUN index alors qu'elle est lue par le feed
--    d'activité admin (/api/activities) : tri `createdAt DESC` + filtres
--    `resource` / `action`. Sans index → seq-scan + sort à chaque requête.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Activity_createdAt_idx"
  ON "Activity" ("createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Activity_resource_action_createdAt_idx"
  ON "Activity" ("resource", "action", "createdAt" DESC);

-- 2) DocumentBundleItem.templateId — FK sans index standalone. Le composite
--    @@unique([bundleId, templateId]) (préfixe bundleId) ne sert pas les
--    filtres/joins par `templateId` seul.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DocumentBundleItem_templateId_idx"
  ON "DocumentBundleItem" ("templateId");

-- 3) KboDenomination — l'autocomplete société fait
--    `denomination ILIKE 'prefix%'` (Prisma `startsWith` + `mode:"insensitive"`).
--    Le btree simple `@@index([denomination])` ne sert PAS l'ILIKE sur une table
--    multi-millions de lignes → seq-scan à chaque frappe. Un GIN trigram couvre
--    l'ILIKE (préfixe ET sous-chaîne).
--    Prérequis : extension pg_trgm (déjà utilisée par la recherche lookup ONEM).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "KboDenomination_denomination_trgm_idx"
  ON "KboDenomination" USING gin ("denomination" gin_trgm_ops);

-- ============================================================================
-- Vérification (optionnel) : lister les index créés
--   SELECT indexname FROM pg_indexes
--   WHERE indexname IN (
--     'Activity_createdAt_idx',
--     'Activity_resource_action_createdAt_idx',
--     'DocumentBundleItem_templateId_idx',
--     'KboDenomination_denomination_trgm_idx'
--   );
-- ============================================================================
