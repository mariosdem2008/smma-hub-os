-- Create ad_accounts table
CREATE TABLE public.ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  meta_ad_account_id text NOT NULL,
  account_name text,
  currency text DEFAULT 'USD',
  status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, meta_ad_account_id)
);

-- Create ad_campaigns table
CREATE TABLE public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  meta_campaign_id text NOT NULL,
  name text NOT NULL,
  objective text,
  status text,
  daily_budget numeric,
  lifetime_budget numeric,
  start_time timestamptz,
  stop_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ad_account_id, meta_campaign_id)
);

-- Create ad_insights table (daily aggregated data)
CREATE TABLE public.ad_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  date date NOT NULL,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  spend numeric DEFAULT 0,
  reach integer DEFAULT 0,
  ctr numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cpm numeric DEFAULT 0,
  conversions integer DEFAULT 0,
  cost_per_conversion numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ad_campaign_id, date)
);

-- Enable RLS
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies for ad_accounts
CREATE POLICY "Agency members can manage ad accounts"
  ON public.ad_accounts FOR ALL
  USING (agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()))
  WITH CHECK (agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()));

-- RLS policies for ad_campaigns
CREATE POLICY "Agency members can manage ad campaigns"
  ON public.ad_campaigns FOR ALL
  USING (ad_account_id IN (
    SELECT id FROM public.ad_accounts 
    WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
  ))
  WITH CHECK (ad_account_id IN (
    SELECT id FROM public.ad_accounts 
    WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
  ));

-- RLS policies for ad_insights
CREATE POLICY "Agency members can view ad insights"
  ON public.ad_insights FOR SELECT
  USING (ad_campaign_id IN (
    SELECT c.id FROM public.ad_campaigns c
    JOIN public.ad_accounts a ON c.ad_account_id = a.id
    WHERE a.agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
  ));

-- Updated_at triggers
CREATE TRIGGER update_ad_accounts_updated_at
  BEFORE UPDATE ON public.ad_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_ad_accounts_client_id ON public.ad_accounts(client_id);
CREATE INDEX idx_ad_campaigns_ad_account_id ON public.ad_campaigns(ad_account_id);
CREATE INDEX idx_ad_insights_campaign_date ON public.ad_insights(ad_campaign_id, date);