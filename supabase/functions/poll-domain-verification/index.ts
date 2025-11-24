import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyDNS(domain: string, expectedTarget: string): Promise<boolean> {
  try {
    const dohUrl = `https://dns.google/resolve?name=${domain}&type=CNAME`;
    const response = await fetch(dohUrl, {
      headers: { 'Accept': 'application/dns-json' },
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (!data.Answer || data.Answer.length === 0) return false;

    const cnameRecord = data.Answer.find((record: any) => record.type === 5);
    if (!cnameRecord) return false;

    const actualCname = cnameRecord.data.replace(/\.$/, '').toLowerCase();
    const expectedCnameClean = expectedTarget.replace(/\.$/, '').toLowerCase();
    
    return actualCname === expectedCnameClean;
  } catch (error) {
    console.error('DNS verification error:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting domain verification poll...');

    // Get all domains with pending verification
    const { data: pendingDomains, error: fetchError } = await supabaseClient
      .from('agency_branding')
      .select('agency_id, custom_domain, dns_required_record')
      .eq('verification_status', 'pending')
      .not('custom_domain', 'is', null);

    if (fetchError) {
      console.error('Error fetching pending domains:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending domains' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingDomains?.length || 0} pending domains`);

    if (!pendingDomains || pendingDomains.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending domains to verify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const domain of pendingDomains) {
      console.log(`Verifying ${domain.custom_domain}...`);
      
      const expectedTarget = domain.dns_required_record || Deno.env.get('PORTAL_DOMAIN') || 'your-app.lovable.app';
      const isVerified = await verifyDNS(domain.custom_domain, expectedTarget);

      const updateData: any = {
        dns_last_checked: new Date().toISOString(),
      };

      if (isVerified) {
        updateData.verification_status = 'verified';
        updateData.ssl_status = 'pending';
        console.log(`✓ Domain ${domain.custom_domain} verified`);
      } else {
        console.log(`✗ Domain ${domain.custom_domain} verification failed`);
      }

      const { error: updateError } = await supabaseClient
        .from('agency_branding')
        .update(updateData)
        .eq('agency_id', domain.agency_id);

      if (updateError) {
        console.error(`Failed to update ${domain.custom_domain}:`, updateError);
      }

      results.push({
        domain: domain.custom_domain,
        verified: isVerified,
      });
    }

    return new Response(
      JSON.stringify({
        message: 'Domain verification poll completed',
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in poll-domain-verification:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
