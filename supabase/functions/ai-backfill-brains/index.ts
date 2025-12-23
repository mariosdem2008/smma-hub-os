import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const MAX_BATCH = 200;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function isFilled(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object") return Object.values(value).some(isFilled);
  return false;
}

function coverageScore(sections: Record<string, unknown>) {
  const keys = Object.keys(sections);
  const filled = keys.filter((key) => isFilled(sections[key])).length;
  return keys.length === 0 ? 0 : filled / keys.length;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

  const adminToken = Deno.env.get("AI_BACKFILL_ADMIN_TOKEN");
  const requestToken = req.headers.get("x-admin-token");
  if (!adminToken || requestToken !== adminToken) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const agencyFilter = body.agency_id as string | undefined;
  const clientFilter = body.client_id as string | undefined;
  const dryRun = Boolean(body.dry_run);

  let agencyQuery = supabase.from("agencies").select("id, name, website, niche").limit(MAX_BATCH);
  if (agencyFilter) agencyQuery = agencyQuery.eq("id", agencyFilter);

  const { data: agencies, error: agencyError } = await agencyQuery;
  if (agencyError) {
    return jsonResponse({ error: agencyError.message }, 400, corsHeaders(req));
  }

  let clientQuery = supabase.from("clients").select("id, agency_id, name, website, logo_url, brand_colors, notes").limit(MAX_BATCH);
  if (clientFilter) clientQuery = clientQuery.eq("id", clientFilter);
  const { data: clients, error: clientError } = await clientQuery;
  if (clientError) {
    return jsonResponse({ error: clientError.message }, 400, corsHeaders(req));
  }

  const stats = {
    agencies_processed: 0,
    agencies_created: 0,
    agencies_usable: 0,
    clients_processed: 0,
    clients_created: 0,
    clients_usable: 0,
    documents_created: 0,
    errors: [] as string[],
  };

  for (const agency of agencies ?? []) {
    stats.agencies_processed += 1;
    const { data: existingAgency } = await supabase
      .from("agency_brains")
      .select("id")
      .eq("agency_id", agency.id)
      .eq("version", 1)
      .maybeSingle();

    if (existingAgency?.id) {
      continue;
    }

    const brain = {
      identity: {
        name: agency.name ?? "",
        niches: agency.niche ? [agency.niche] : [],
        offers: [],
        geo: [],
        languages: [],
      },
      icp: {
        industries: agency.niche ? [agency.niche] : [],
        size: [],
        personas: [],
        pains: [],
        objections: [],
      },
      voice_tone: {
        adjectives: [],
        banned_words: [],
        preferred_vocab: [],
        writing_rules: [],
      },
      strategy_defaults: {
        pillars: [],
        hook_styles: [],
        cta_styles: [],
        platform_formats: [],
      },
      safety_policy: {
        allowed: [],
        avoid: [],
        compliance_notes: [],
      },
      process_rules: {
        revisions: "",
        approvals: "",
        escalation_rules: "",
      },
      faq: [],
      gold_examples: [],
      raw_responses: {
        legacy_agency_name: agency.name ?? "",
        legacy_agency_niche: agency.niche ?? "",
        legacy_agency_website: agency.website ?? "",
      },
      inference_metadata: {
        source: "legacy_onboarding",
        fields: {
          name: !!agency.name,
          niche: !!agency.niche,
          website: !!agency.website,
        },
      },
    };

    const coverage = coverageScore({
      identity: brain.identity,
      icp: brain.icp,
      voice_tone: brain.voice_tone,
      strategy_defaults: brain.strategy_defaults,
      safety_policy: brain.safety_policy,
      process_rules: brain.process_rules,
      faq: brain.faq,
      gold_examples: brain.gold_examples,
    });

    const status = coverage >= 0.7 ? "usable" : "draft";
    if (!dryRun) {
      const { error } = await supabase.from("agency_brains").insert({
        agency_id: agency.id,
        version: 1,
        status,
        locked: false,
        brain_json: brain,
        json_diff: null,
        confidence: Math.round(coverage * 100),
      });
      if (error) {
        stats.errors.push(`agency ${agency.id}: ${error.message}`);
        continue;
      }
    }

    stats.agencies_created += 1;
    if (status === "usable") stats.agencies_usable += 1;

    if (agency.website && !dryRun) {
      const { data: existingDoc } = await supabase
        .from("ai_documents")
        .select("id")
        .eq("agency_id", agency.id)
        .eq("doc_type", "agency_sop")
        .eq("title", "Legacy agency website")
        .maybeSingle();

      if (!existingDoc?.id) {
        const { error } = await supabase.from("ai_documents").insert({
          agency_id: agency.id,
          doc_type: "agency_sop",
          title: "Legacy agency website",
          content: agency.website,
          source: { source_type: "system", source_ref: "legacy_onboarding" },
          metadata: { source: "legacy_onboarding", field: "website" },
        });
        if (!error) stats.documents_created += 1;
      }
    }
  }

  for (const client of clients ?? []) {
    stats.clients_processed += 1;
    const { data: existingClient } = await supabase
      .from("client_brains")
      .select("id")
      .eq("client_id", client.id)
      .eq("version", 1)
      .maybeSingle();

    if (existingClient?.id) {
      continue;
    }

    const { data: branding, error: brandingError } = await supabase
      .from("client_branding")
      .select("brand_voice, brand_tone, brand_guidelines, brand_palette")
      .eq("client_id", client.id)
      .maybeSingle();
    if (brandingError) stats.errors.push(`client_branding ${client.id}: ${brandingError.message}`);

    const { data: pillars, error: pillarsError } = await supabase
      .from("client_content_pillars")
      .select("title, description")
      .eq("client_id", client.id);
    if (pillarsError) stats.errors.push(`client_content_pillars ${client.id}: ${pillarsError.message}`);

    const { data: assets, error: assetsError } = await supabase
      .from("client_assets")
      .select("file_url")
      .eq("client_id", client.id);
    if (assetsError) stats.errors.push(`client_assets ${client.id}: ${assetsError.message}`);

    const assetUrls = [
      ...(assets ?? []).map((asset) => asset.file_url).filter(Boolean),
      client.logo_url,
    ].filter(Boolean) as string[];

    const brain = {
      brand_basics: {
        name: client.name ?? "",
        website: client.website ?? "",
        socials: [],
        tone: branding?.brand_tone ?? branding?.brand_voice ?? "",
        differentiators: branding?.brand_guidelines ? [branding.brand_guidelines] : [],
      },
      offer_details: {
        products_services: [],
        pricing_optional: "",
        usps: [],
      },
      audience: {
        demographics: [],
        location: [],
        intent: [],
        problems: [],
        objections: [],
      },
      competitors: [],
      constraints: {
        banned_claims: [],
        legal_constraints: [],
        taboo_topics: client.notes ? [client.notes] : [],
        dos: branding?.brand_guidelines ? [branding.brand_guidelines] : [],
        donts: [],
      },
      pillars: (pillars ?? []).map((pillar) => ({
        name: pillar.title,
        examples: pillar.description ? [pillar.description] : [],
      })),
      faq: [],
      assets_links: {
        key_urls: assetUrls,
        guidelines_link: "",
        lead_magnet_optional: "",
      },
      raw_responses: {
        legacy_client_notes: client.notes ?? "",
        legacy_brand_voice: branding?.brand_voice ?? "",
        legacy_brand_tone: branding?.brand_tone ?? "",
      },
      inference_metadata: {
        source: "legacy_onboarding",
        fields: {
          name: !!client.name,
          website: !!client.website,
          notes: !!client.notes,
          brand_voice: !!branding?.brand_voice,
          brand_tone: !!branding?.brand_tone,
          brand_guidelines: !!branding?.brand_guidelines,
          pillars: (pillars ?? []).length,
          assets: assetUrls.length,
        },
      },
    };

    const coverage = coverageScore({
      brand_basics: brain.brand_basics,
      offer_details: brain.offer_details,
      audience: brain.audience,
      competitors: brain.competitors,
      constraints: brain.constraints,
      pillars: brain.pillars,
      faq: brain.faq,
      assets_links: brain.assets_links,
    });

    const status = coverage >= 0.7 ? "usable" : "draft";
    if (!dryRun) {
      const { error } = await supabase.from("client_brains").insert({
        agency_id: client.agency_id,
        client_id: client.id,
        version: 1,
        status,
        locked: false,
        brain_json: brain,
        json_diff: null,
        confidence: Math.round(coverage * 100),
      });
      if (error) {
        stats.errors.push(`client ${client.id}: ${error.message}`);
        continue;
      }
    }

    stats.clients_created += 1;
    if (status === "usable") stats.clients_usable += 1;

    if (!dryRun && client.notes) {
      const { data: existingDoc } = await supabase
        .from("ai_documents")
        .select("id")
        .eq("client_id", client.id)
        .eq("doc_type", "client_notes")
        .eq("title", "Legacy client notes")
        .maybeSingle();

      if (!existingDoc?.id) {
        const { error } = await supabase.from("ai_documents").insert({
          agency_id: client.agency_id,
          client_id: client.id,
          doc_type: "client_notes",
          title: "Legacy client notes",
          content: client.notes,
          source: { source_type: "system", source_ref: "legacy_onboarding" },
          metadata: { source: "legacy_onboarding", field: "notes" },
        });
        if (!error) stats.documents_created += 1;
      }
    }
  }

  return jsonResponse({
    dry_run: dryRun,
    stats,
  }, 200, corsHeaders(req));
});
