-- Fix RLS policies for client_uploads to allow client portal users to upload

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Client portal users can upload files" ON client_uploads;
DROP POLICY IF EXISTS "Client users can view their own uploads" ON client_uploads;

-- Create policy allowing client portal users to INSERT their own uploads
CREATE POLICY "Client portal users can upload files"
ON client_uploads
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by IN (
    SELECT id 
    FROM client_users 
    WHERE client_id = client_uploads.client_id
  )
);

-- Allow client portal users to SELECT their own uploads
CREATE POLICY "Client users can view their own uploads"
ON client_uploads
FOR SELECT
TO authenticated
USING (
  uploaded_by IN (
    SELECT id 
    FROM client_users 
    WHERE client_id = client_uploads.client_id
  )
);