import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * sync-meta-ads - Fetches campaign & insights data from Meta Marketing API
 * 
 * CRON SCHEDULE: Run daily at 6 AM UTC
 * SELECT cron.schedule(
 *   'sync-meta-ads-daily',
 *   '0 6 * * *',
 *   $$
 *   SELECT net.http_post(
 *     url:='https://dzyhrzdwwuaorruscxcn.supabase.co/functions/v1/sync-meta-ads',
 *     headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
 *     body:='{}'::jsonb
 *   ) as request_id;
 *   $$
 * );
 */

const GRAPH_API_VERSION = Deno.env.get("GRAPH_API_VERSION") || "v21.0";

interface AdAccount {
  id: string;
  client_id: string;
  agency_id: string;
  meta_ad_account_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional client_id filter
    let clientId: string | null = null;
    try {
      const body = await req.json();
      clientId = body.client_id || null;
    } catch {
      // No body provided, sync all accounts
    }

    console.log("[SYNC-ADS] Starting Meta Ads sync", { clientId });

    // Get all ad accounts (optionally filtered by client)
    let query = supabase
      .from("ad_accounts")
      .select("id, client_id, agency_id, meta_ad_account_id")
      .eq("status", "active");

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data: adAccounts, error: accountsError } = await query;

    if (accountsError) {
      console.error("[SYNC-ADS] Error fetching ad accounts:", accountsError);
      throw accountsError;
    }

    if (!adAccounts || adAccounts.length === 0) {
      console.log("[SYNC-ADS] No ad accounts to sync");
      return new Response(
        JSON.stringify({ success: true, message: "No ad accounts to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { accountId: string; success: boolean; error?: string; campaigns?: number }[] = [];

    for (const account of adAccounts as AdAccount[]) {
      try {
        // Get the social connection for this client to get the access token
        const { data: connection, error: connError } = await supabase
          .from("social_connections")
          .select("access_token")
          .eq("client_id", account.client_id)
          .eq("platform", "facebook")
          .eq("status", "connected")
          .single();

        if (connError || !connection?.access_token) {
          console.log(`[SYNC-ADS] No active Facebook connection for client ${account.client_id}`);
          results.push({ accountId: account.meta_ad_account_id, success: false, error: "No active Facebook connection" });
          continue;
        }

        const accessToken = connection.access_token;

        // Fetch campaigns from Meta Marketing API
        const campaignsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/act_${account.meta_ad_account_id}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time&access_token=${accessToken}`;
        
        console.log(`[SYNC-ADS] Fetching campaigns for account ${account.meta_ad_account_id}`);
        
        const campaignsResponse = await fetch(campaignsUrl);
        const campaignsData = await campaignsResponse.json();

        if (campaignsData.error) {
          console.error(`[SYNC-ADS] Meta API error for account ${account.meta_ad_account_id}:`, campaignsData.error);
          results.push({ accountId: account.meta_ad_account_id, success: false, error: campaignsData.error.message });
          continue;
        }

        const campaigns = campaignsData.data || [];
        let campaignsSynced = 0;

        for (const campaign of campaigns) {
          // Upsert campaign
          const { data: upsertedCampaign, error: campaignError } = await supabase
            .from("ad_campaigns")
            .upsert({
              ad_account_id: account.id,
              meta_campaign_id: campaign.id,
              name: campaign.name,
              objective: campaign.objective,
              status: campaign.status,
              daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
              lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
              start_time: campaign.start_time || null,
              stop_time: campaign.stop_time || null,
            }, { onConflict: "ad_account_id,meta_campaign_id" })
            .select("id")
            .single();

          if (campaignError) {
            console.error(`[SYNC-ADS] Error upserting campaign ${campaign.id}:`, campaignError);
            continue;
          }

          // Fetch insights for this campaign (last 30 days)
          const today = new Date();
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const insightsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${campaign.id}/insights?fields=impressions,clicks,spend,reach,ctr,cpc,cpm,actions&time_range={"since":"${thirtyDaysAgo.toISOString().split("T")[0]}","until":"${today.toISOString().split("T")[0]}"}&time_increment=1&access_token=${accessToken}`;

          const insightsResponse = await fetch(insightsUrl);
          const insightsData = await insightsResponse.json();

          if (insightsData.data && upsertedCampaign) {
            for (const insight of insightsData.data) {
              const conversions = insight.actions?.find((a: any) => a.action_type === "purchase")?.value || 0;
              const spend = parseFloat(insight.spend || "0");
              const costPerConversion = conversions > 0 ? spend / conversions : 0;

              await supabase
                .from("ad_insights")
                .upsert({
                  ad_campaign_id: upsertedCampaign.id,
                  date: insight.date_start,
                  impressions: parseInt(insight.impressions || "0"),
                  clicks: parseInt(insight.clicks || "0"),
                  spend: spend,
                  reach: parseInt(insight.reach || "0"),
                  ctr: parseFloat(insight.ctr || "0"),
                  cpc: parseFloat(insight.cpc || "0"),
                  cpm: parseFloat(insight.cpm || "0"),
                  conversions: parseInt(conversions),
                  cost_per_conversion: costPerConversion,
                }, { onConflict: "ad_campaign_id,date" });
            }
          }

          campaignsSynced++;
        }

        results.push({ accountId: account.meta_ad_account_id, success: true, campaigns: campaignsSynced });
        console.log(`[SYNC-ADS] Synced ${campaignsSynced} campaigns for account ${account.meta_ad_account_id}`);

      } catch (err) {
        console.error(`[SYNC-ADS] Error syncing account ${account.meta_ad_account_id}:`, err);
        results.push({ accountId: account.meta_ad_account_id, success: false, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results, synced: results.filter(r => r.success).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SYNC-ADS] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
