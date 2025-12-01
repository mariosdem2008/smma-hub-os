
-- Migration: Convert existing scheduled projects to scheduled_posts records
-- This handles projects that were scheduled before the normalized data model

-- Create scheduled_posts records for existing scheduled projects
DO $$
DECLARE
  proj RECORD;
  platform_name TEXT;
  social_conn_id UUID;
BEGIN
  -- Loop through all projects with scheduled_time that don't have scheduled_posts yet
  FOR proj IN 
    SELECT p.id, p.agency_id, p.client_id, p.scheduled_time, p.platforms, p.platform_captions
    FROM public.projects p
    WHERE p.scheduled_time IS NOT NULL
      AND p.status IN ('scheduled', 'approved')
      AND NOT EXISTS (
        SELECT 1 FROM public.scheduled_posts sp WHERE sp.project_id = p.id
      )
  LOOP
    -- For each platform in the project's platforms array
    IF proj.platforms IS NOT NULL THEN
      FOREACH platform_name IN ARRAY proj.platforms
      LOOP
        -- Try to find a social connection for this platform and client
        SELECT id INTO social_conn_id
        FROM public.social_connections
        WHERE client_id = proj.client_id
          AND platform = platform_name
          AND status = 'connected'
        LIMIT 1;

        -- Create scheduled_post record
        INSERT INTO public.scheduled_posts (
          project_id,
          agency_id,
          client_id,
          platform,
          social_connection_id,
          scheduled_for,
          status,
          caption
        ) VALUES (
          proj.id,
          proj.agency_id,
          proj.client_id,
          platform_name,
          social_conn_id, -- Will be NULL if no connection found
          proj.scheduled_time,
          'pending',
          COALESCE(
            (proj.platform_captions->>platform_name),
            NULL
          )
        );
      END LOOP;
    END IF;
  END LOOP;
END $$;
