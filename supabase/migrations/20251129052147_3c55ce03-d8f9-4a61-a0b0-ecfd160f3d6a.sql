-- Remove the incorrect unique constraint
ALTER TABLE social_connections
DROP CONSTRAINT IF EXISTS social_connections_platform_account_unique;

-- Add the correct unique constraint for client-based connections
-- This ensures each client can only have one connection per platform
ALTER TABLE social_connections
ADD CONSTRAINT social_connections_client_platform_unique
UNIQUE (client_id, platform);