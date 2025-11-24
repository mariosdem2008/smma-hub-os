-- Drop any existing overly permissive policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create strict RLS policy: users can ONLY view their own profile
CREATE POLICY "Users can view only their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create strict RLS policy: users can ONLY update their own profile
CREATE POLICY "Users can update only their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Prevent manual inserts (profiles are created via trigger only)
-- No INSERT policy needed - profiles auto-created by handle_new_user() trigger

-- Optional: Allow users to delete their own profile
CREATE POLICY "Users can delete only their own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Add documentation
COMMENT ON TABLE public.profiles IS 'User profiles table. RLS policies ensure users can only access their own profile data. Email addresses are protected from cross-user access.';
COMMENT ON COLUMN public.profiles.email IS 'SENSITIVE: User email address - strictly restricted to profile owner only via RLS';