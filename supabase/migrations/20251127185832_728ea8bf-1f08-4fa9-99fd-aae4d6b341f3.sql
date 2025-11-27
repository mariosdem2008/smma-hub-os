-- Create waitlist_subscribers table
CREATE TABLE public.waitlist_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  agency_size TEXT,
  pain_point TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.waitlist_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts only
CREATE POLICY "Allow anonymous inserts"
  ON public.waitlist_subscribers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Block all selects (no one can read the data except service role)
-- No SELECT policy means no one can select