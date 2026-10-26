-- Read-only gate for the additive Lookup import workflow migration.
-- Run against the intended database before applying migration.sql.
-- This does not prove that the entire Prisma history matches the repository;
-- separately require `prisma migrate status` and operator review of the ledger.
BEGIN TRANSACTION READ ONLY;

DO $$
DECLARE
  lookup_table_exists BOOLEAN;
  lookup_entry_exists BOOLEAN;
  lookup_id_column_exists BOOLEAN;
  lookup_table_id_primary_key_exists BOOLEAN;
  revision_column_exists BOOLEAN;
  proposal_table_exists BOOLEAN;
  approval_table_exists BOOLEAN;
  proposal_indexes_exist BOOLEAN;
  approval_indexes_exist BOOLEAN;
  migration_ledger_exists BOOLEAN;
  migration_already_applied BOOLEAN;
  migration_incomplete BOOLEAN;
BEGIN
  IF current_schema() <> 'public' THEN
    RAISE EXCEPTION 'Lookup migration preflight requires the public schema';
  END IF;

  SELECT to_regclass('public."LookupTable"') IS NOT NULL,
         to_regclass('public."LookupEntry"') IS NOT NULL
    INTO lookup_table_exists, lookup_entry_exists;

  IF NOT lookup_table_exists OR NOT lookup_entry_exists THEN
    RAISE EXCEPTION 'Required Lookup base tables are missing; stop and inspect schema/history';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'LookupTable'
       AND column_name = 'id'
  ) INTO lookup_id_column_exists;

  SELECT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = to_regclass('public."LookupTable"')
       AND contype = 'p'
       AND conkey = ARRAY[(
         SELECT attnum
           FROM pg_attribute
          WHERE attrelid = to_regclass('public."LookupTable"')
            AND attname = 'id'
            AND NOT attisdropped
       )]::SMALLINT[]
  ) INTO lookup_table_id_primary_key_exists;

  IF NOT lookup_id_column_exists OR NOT lookup_table_id_primary_key_exists THEN
    RAISE EXCEPTION 'LookupTable.id is missing or is not its primary key; stop and inspect schema';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'LookupTable'
       AND column_name = 'publishedRevision'
  ) INTO revision_column_exists;

  SELECT to_regclass('public."LookupImportProposal"') IS NOT NULL,
         to_regclass('public."LookupImportApproval"') IS NOT NULL
    INTO proposal_table_exists, approval_table_exists;

  SELECT to_regclass('public."LookupImportProposal_tableId_state_createdAt_idx"') IS NOT NULL
     OR to_regclass('public."LookupImportProposal_sourceSha256_idx"') IS NOT NULL
     OR to_regclass('public."LookupImportProposal_tableId_sourceSha256_baseHash_parserVersion_key"') IS NOT NULL
    INTO proposal_indexes_exist;

  SELECT to_regclass('public."LookupImportApproval_proposalId_approverEmail_key"') IS NOT NULL
     OR to_regclass('public."LookupImportApproval_proposalId_idx"') IS NOT NULL
    INTO approval_indexes_exist;

  IF revision_column_exists
     OR proposal_table_exists
     OR approval_table_exists
     OR proposal_indexes_exist
     OR approval_indexes_exist THEN
    RAISE EXCEPTION 'Lookup migration objects are already present or partially present; do not reapply';
  END IF;

  SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL
    INTO migration_ledger_exists;
  IF NOT migration_ledger_exists THEN
    RAISE EXCEPTION 'Prisma migration ledger is missing; history is unknown, stop for operator review';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public."_prisma_migrations"
     WHERE migration_name = '60_lookup_import_proposals'
       AND finished_at IS NOT NULL
       AND rolled_back_at IS NULL
  ) INTO migration_already_applied;

  SELECT EXISTS (
    SELECT 1
      FROM public."_prisma_migrations"
     WHERE migration_name = '60_lookup_import_proposals'
       AND finished_at IS NULL
       AND rolled_back_at IS NULL
  ) INTO migration_incomplete;

  IF migration_already_applied OR migration_incomplete THEN
    RAISE EXCEPTION 'Migration 60 ledger state is already applied or incomplete; stop and reconcile';
  END IF;

  RAISE NOTICE 'Preflight passed: required base tables exist, migration 60 objects are absent, and no active migration 60 ledger row exists.';
  RAISE NOTICE 'Before applying, verify full history with prisma migrate status and review schema drift; unknown or failed history is a stop condition.';
END;
$$;

COMMIT;
