import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdAccount {
  id: string;
  client_id: string;
  agency_id: string;
  meta_ad_account_id: string;
  account_name: string | null;
  currency: string;
  status: string;
  created_at: string;
}

export interface AdCampaign {
  id: string;
  ad_account_id: string;
  meta_campaign_id: string;
  name: string;
  objective: string | null;
  status: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  start_time: string | null;
  stop_time: string | null;
  created_at: string;
}

export interface AdInsight {
  id: string;
  ad_campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  cost_per_conversion: number;
}

export interface CampaignWithInsights extends AdCampaign {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
}

// Fetch ad accounts for a client
export function useAdAccounts(clientId: string) {
  return useQuery({
    queryKey: ["ad-accounts", clientId],
    queryFn: async (): Promise<AdAccount[]> => {
      const { data, error } = await supabase
        .from("ad_accounts")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as AdAccount[];
    },
    enabled: !!clientId,
  });
}

// Fetch campaigns for an ad account
export function useAdCampaigns(adAccountId: string | null) {
  return useQuery({
    queryKey: ["ad-campaigns", adAccountId],
    queryFn: async (): Promise<AdCampaign[]> => {
      if (!adAccountId) return [];
      
      const { data, error } = await supabase
        .from("ad_campaigns")
        .select("*")
        .eq("ad_account_id", adAccountId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as AdCampaign[];
    },
    enabled: !!adAccountId,
  });
}

// Fetch insights for a campaign
export function useAdInsights(campaignId: string | null, days: number = 30) {
  return useQuery({
    queryKey: ["ad-insights", campaignId, days],
    queryFn: async (): Promise<AdInsight[]> => {
      if (!campaignId) return [];
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await supabase
        .from("ad_insights")
        .select("*")
        .eq("ad_campaign_id", campaignId)
        .gte("date", startDate.toISOString().split("T")[0])
        .order("date", { ascending: false });

      if (error) throw error;
      return (data || []) as AdInsight[];
    },
    enabled: !!campaignId,
  });
}

// Fetch all campaigns with aggregated insights for a client
export function useClientCampaignsWithInsights(clientId: string) {
  return useQuery({
    queryKey: ["client-campaigns-insights", clientId],
    queryFn: async (): Promise<CampaignWithInsights[]> => {
      // First get all ad accounts for this client
      const { data: accounts, error: accountsError } = await supabase
        .from("ad_accounts")
        .select("id")
        .eq("client_id", clientId);

      if (accountsError) throw accountsError;
      if (!accounts || accounts.length === 0) return [];

      const accountIds = accounts.map(a => a.id);

      // Get all campaigns for these accounts
      const { data: campaigns, error: campaignsError } = await supabase
        .from("ad_campaigns")
        .select("*")
        .in("ad_account_id", accountIds);

      if (campaignsError) throw campaignsError;
      if (!campaigns || campaigns.length === 0) return [];

      // Get insights for all campaigns
      const campaignIds = campaigns.map(c => c.id);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: insights, error: insightsError } = await supabase
        .from("ad_insights")
        .select("*")
        .in("ad_campaign_id", campaignIds)
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

      if (insightsError) throw insightsError;

      // Aggregate insights per campaign
      return campaigns.map(campaign => {
        const campaignInsights = (insights || []).filter(i => i.ad_campaign_id === campaign.id);
        
        const totalSpend = campaignInsights.reduce((sum, i) => sum + (i.spend || 0), 0);
        const totalImpressions = campaignInsights.reduce((sum, i) => sum + (i.impressions || 0), 0);
        const totalClicks = campaignInsights.reduce((sum, i) => sum + (i.clicks || 0), 0);
        const totalReach = campaignInsights.reduce((sum, i) => sum + (i.reach || 0), 0);
        const totalConversions = campaignInsights.reduce((sum, i) => sum + (i.conversions || 0), 0);
        
        const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

        return {
          ...campaign,
          totalSpend,
          totalImpressions,
          totalClicks,
          totalReach,
          totalConversions,
          avgCtr,
          avgCpc,
        } as CampaignWithInsights;
      });
    },
    enabled: !!clientId,
  });
}

// Connect an ad account
export function useConnectAdAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      agencyId, 
      metaAdAccountId, 
      accountName 
    }: { 
      clientId: string; 
      agencyId: string; 
      metaAdAccountId: string; 
      accountName?: string;
    }) => {
      const { data, error } = await supabase
        .from("ad_accounts")
        .insert({
          client_id: clientId,
          agency_id: agencyId,
          meta_ad_account_id: metaAdAccountId,
          account_name: accountName || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ad-accounts", variables.clientId] });
    },
  });
}

// Disconnect an ad account
export function useDisconnectAdAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, clientId }: { accountId: string; clientId: string }) => {
      const { error } = await supabase
        .from("ad_accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;
      return { clientId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ad-accounts", result.clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-campaigns-insights", result.clientId] });
    },
  });
}

// Sync ads data
export function useSyncMetaAds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId?: string) => {
      const { data, error } = await supabase.functions.invoke("sync-meta-ads", {
        body: clientId ? { client_id: clientId } : {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, clientId) => {
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ["ad-accounts", clientId] });
        queryClient.invalidateQueries({ queryKey: ["client-campaigns-insights", clientId] });
      }
      queryClient.invalidateQueries({ queryKey: ["ad-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["ad-insights"] });
    },
  });
}
