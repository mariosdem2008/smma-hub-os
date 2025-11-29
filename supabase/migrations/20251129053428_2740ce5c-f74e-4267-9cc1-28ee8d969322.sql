-- Add retry_count column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Create token_refresh_logs table for tracking token refresh operations
CREATE TABLE IF NOT EXISTS token_refresh_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_connection_id uuid REFERENCES social_connections(id) ON DELETE CASCADE,
  old_token_preview TEXT, -- Store first 10 chars only for security
  new_token_preview TEXT,
  success BOOLEAN NOT NULL,
  response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create post_logs table for tracking all publish attempts
CREATE TABLE IF NOT EXISTS post_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  attempt_number INTEGER DEFAULT 1,
  success BOOLEAN NOT NULL,
  response JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for token_refresh_logs (agency members can view)
ALTER TABLE token_refresh_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view token refresh logs"
ON token_refresh_logs FOR SELECT
USING (
  social_connection_id IN (
    SELECT sc.id
    FROM social_connections sc
    JOIN clients c ON sc.client_id = c.id
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Add RLS policies for post_logs (agency members can view)
ALTER TABLE post_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view post logs"
ON post_logs FOR SELECT
USING (
  project_id IN (
    SELECT p.id
    FROM projects p
    JOIN agency_members am ON p.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);