-- Grants to ensure service_role can access public schema and tables (including agency_members)

-- Usage on public schema
GRANT USAGE ON SCHEMA public TO service_role;

-- Basic DML on specific table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_members TO service_role;

-- Optional: blanket grants on all tables/sequences in public (uncomment if desired)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Optional: default privileges for future tables/sequences
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
