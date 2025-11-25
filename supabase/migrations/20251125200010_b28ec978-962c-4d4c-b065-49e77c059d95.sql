-- Make client-uploads bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'client-uploads';