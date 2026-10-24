-- ONLY after the disposable full test schema has been created. Never production.
DO $$ BEGIN
  IF current_database() <> 'autonomous_rates_test' OR current_user <> 'docbel_test' THEN
    RAISE EXCEPTION 'LOCAL_DISPOSABLE_DATABASE_REQUIRED';
  END IF;
END $$;
INSERT INTO "AutonomousRateRegistry" ("id") VALUES ('autonomous-rates');
INSERT INTO "BaremeFile" ("id", "name", "filePath", "effectiveDate", "status", "updatedAt")
VALUES ('legacy-sentinel', 'TEST-LEGACY-SENTINEL', 'TEST-LEGACY-FILE-UNTOUCHED', '2026-09-01', 'published', CURRENT_TIMESTAMP);
CREATE ROLE autonomous_app LOGIN;
GRANT CONNECT ON DATABASE autonomous_rates_test TO autonomous_app;
GRANT USAGE ON SCHEMA public TO autonomous_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO autonomous_app;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND (tablename LIKE 'Bareme%' OR tablename = 'BareSheet')
  LOOP EXECUTE format('REVOKE ALL ON TABLE %I FROM autonomous_app', r.tablename); END LOOP;
END $$;
