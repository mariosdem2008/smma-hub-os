-- Add unique constraint to social_connections for proper OAuth upsert
-- This allows upsert based on platform + account_id combination
ALTER TABLE social_connections
ADD CONSTRAINT social_connections_platform_account_unique
UNIQUE (platform, account_id);