-- Enable RLS on waitlist_subscribers table
ALTER TABLE public.waitlist_subscribers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.waitlist_subscribers;
DROP POLICY IF EXISTS "Block all selects" ON public.waitlist_subscribers;

-- Allow anyone to insert into waitlist_subscribers (anonymous signups)
CREATE POLICY "Allow anonymous inserts"
ON public.waitlist_subscribers
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Block all SELECT queries to prevent data enumeration
CREATE POLICY "Block all selects"
ON public.waitlist_subscribers
FOR SELECT
TO anon, authenticated
USING (false);