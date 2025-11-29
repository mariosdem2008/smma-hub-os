-- Part 3: Ensure all extensions are properly in extensions schema

-- Check and move any remaining extensions
DO $$
BEGIN
  -- Check if uuid-ossp is in public and move it
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'uuid-ossp' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
  END IF;
  
  -- Check if pgcrypto is in public and move it
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pgcrypto' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION IF EXISTS pgcrypto CASCADE;
  END IF;
END $$;

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Install extensions in extensions schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA extensions TO postgres, anon, authenticated, service_role;