import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const GRAPH_API_VERSION = Deno.env.get("GRAPH_API_VERSION") || "v21.0";

interface AdAccount {
  id: string;
  client_id: string;
  agency_id: string;
  meta_ad_account_id: string;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let clientId: string | null = null;
    try {
      const body = await req.json();
      clientId = body.client_id || null;
    } catch {
      // No body provided, sync all accounts
    }

    console.log("[SYNC-ADS] Starting Meta Ads sync", { clientId });

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
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const results: { accountId: string; success: boolean; error?: string; campaigns?: number }[] = [];

    for (const account of adAccounts as AdAccount[]) {
      try {
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

        const campaignsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/act_${account.meta_ad_account_id}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time&access_token=${accessToken}`;
        
        console.log(`[SYNC-ADS] Fetching campaigns for account ${account.meta_ad_account_id}`);
        
        const campaignsResponse = await fetch(campaignsUrl);
        const campaignsData = await campaignsResponse.json();

        if (campaignsData.error) {
          const errorCode = campaignsData.error.code;
          const errorMsg = campaignsData.error.message;
          console.error(`[SYNC-ADS] Meta API error for account ${account.meta_ad_account_id}:`, errorCode, errorMsg);
          
          if (errorCode === 10 || errorCode === 200 || errorCode === 190 || 
              errorMsg.includes('permission') || errorMsg.includes('ads_read') || errorMsg.includes('ads_management')) {
            results.push({ 
              accountId: account.meta_ad_account_id, 
              success: false, 
              error: `Missing permission: ads_read or ads_management. Please reconnect Facebook/Instagram with full permissions.` 
            });
          } else {
            results.push({ accountId: account.meta_ad_account_id, success: false, error: errorMsg });
          }
          continue;
        }

        const campaigns = campaignsData.data || [];
        let campaignsSynced = 0;

        for (const campaign of campaigns) {
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
      { headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SYNC-ADS] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
 status: 500 }    );
  }
});
