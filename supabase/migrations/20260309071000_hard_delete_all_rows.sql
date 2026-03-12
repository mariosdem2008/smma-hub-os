-- HARD DELETE ALL ROWS (REMOTE)
-- Requested by user: wipe all data from Supabase tables.
-- This truncates all base tables in public/auth/storage schemas.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname IN ('public', 'auth', 'storage')
      AND NOT (n.nspname = 'auth' AND c.relname = 'schema_migrations')
      AND NOT (n.nspname = 'storage' AND c.relname = 'schema_migrations')
      AND NOT (n.nspname = 'storage' AND c.relname = 'migrations')
  LOOP
    BEGIN
      EXECUTE format(
        'TRUNCATE TABLE %I.%I CASCADE',
        r.schema_name,
        r.table_name
      );
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipped %.% (insufficient_privilege)', r.schema_name, r.table_name;
    END;
  END LOOP;
END
$$;
