-- Create social_post_metrics table for per-post analytics
CREATE TABLE IF NOT EXISTS public.social_post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  scheduled_post_id uuid REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  platform_post_id text NOT NULL,
  date date NOT NULL,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  saves integer DEFAULT 0,
  shares integer DEFAULT 0,
  clicks integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(scheduled_post_id, platform_post_id, date)
);

-- Create social_profile_stats table for profile-level analytics
CREATE TABLE IF NOT EXISTS public.social_profile_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  profile_id text NOT NULL,
  date date NOT NULL,
  followers integer DEFAULT 0,
  impressions integer DEFAULT 0,
  profile_visits integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, platform, profile_id, date)
);

-- Create metrics_sync_logs table for error tracking
CREATE TABLE IF NOT EXISTS public.metrics_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  sync_type text NOT NULL,
  success boolean NOT NULL,
  error_message text,
  records_synced integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_post_metrics_agency ON public.social_post_metrics(agency_id);
CREATE INDEX idx_post_metrics_client ON public.social_post_metrics(client_id);
CREATE INDEX idx_post_metrics_project ON public.social_post_metrics(project_id);
CREATE INDEX idx_post_metrics_scheduled_post ON public.social_post_metrics(scheduled_post_id);
CREATE INDEX idx_post_metrics_date ON public.social_post_metrics(date DESC);
CREATE INDEX idx_post_metrics_platform ON public.social_post_metrics(platform);

CREATE INDEX idx_profile_stats_agency ON public.social_profile_stats(agency_id);
CREATE INDEX idx_profile_stats_client ON public.social_profile_stats(client_id);
CREATE INDEX idx_profile_stats_date ON public.social_profile_stats(date DESC);
CREATE INDEX idx_profile_stats_platform ON public.social_profile_stats(platform);

CREATE INDEX idx_metrics_sync_logs_created ON public.metrics_sync_logs(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_social_post_metrics_updated_at
  BEFORE UPDATE ON public.social_post_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_metrics_updated_at();

CREATE TRIGGER update_social_profile_stats_updated_at
  BEFORE UPDATE ON public.social_profile_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_metrics_updated_at();

-- Enable RLS
ALTER TABLE public.social_post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_profile_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_post_metrics
CREATE POLICY "Agency members can view post metrics"
  ON public.social_post_metrics
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Client portal users can view their post metrics"
  ON public.social_post_metrics
  FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM public.client_users WHERE id = auth.uid()
    )
  );

-- RLS Policies for social_profile_stats
CREATE POLICY "Agency members can view profile stats"
  ON public.social_profile_stats
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Client portal users can view their profile stats"
  ON public.social_profile_stats
  FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM public.client_users WHERE id = auth.uid()
    )
  );

-- RLS Policies for metrics_sync_logs
CREATE POLICY "Agency members can view sync logs"
  ON public.metrics_sync_logs
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
    )
  );