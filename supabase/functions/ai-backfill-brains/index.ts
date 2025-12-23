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

const REQUIRED_AGENCY_FIELDS = [
  "identity.name",
  "identity.niches",
  "identity.offers",
  "identity.geo",
  "identity.languages",
  "icp.industries",
  "icp.size",
  "icp.personas",
  "icp.pains",
  "icp.objections",
  "voice_tone.adjectives",
  "voice_tone.banned_words",
  "voice_tone.preferred_vocab",
  "voice_tone.writing_rules",
  "strategy_defaults.pillars",
  "strategy_defaults.hook_styles",
  "strategy_defaults.cta_styles",
  "strategy_defaults.platform_formats",
  "safety_policy.allowed",
  "safety_policy.avoid",
  "safety_policy.compliance_notes",
  "process_rules.revisions",
  "process_rules.approvals",
  "process_rules.escalation_rules",
  "faq",
  "gold_examples",
];

const REQUIRED_CLIENT_FIELDS = [
  "brand_basics.name",
  "brand_basics.website",
  "brand_basics.socials",
  "brand_basics.tone",
  "brand_basics.differentiators",
  "offer_details.products_services",
  "offer_details.usps",
  "audience.demographics",
  "audience.location",
  "audience.intent",
  "audience.problems",
  "audience.objections",
  "competitors",
  "constraints.banned_claims",
  "constraints.legal_constraints",
  "constraints.taboo_topics",
  "constraints.dos",
  "constraints.donts",
  "pillars",
  "faq",
  "assets_links.key_urls",
  "assets_links.guidelines_link",
];

function getPathValue(target: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, target);
}

function mergeDeep(target: Record<string, unknown>, source: Record<string, unknown>) {
  const result = { ...target };
  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value;
      return;
    }
    if (value && typeof value === "object") {
      const current = (result[key] as Record<string, unknown>) ?? {};
      result[key] = mergeDeep(current, value as Record<string, unknown>);
      return;
    }
    result[key] = value;
  });
  return result;
}

function completionPercent(target: Record<string, unknown>, requiredFields: string[]) {
  const total = requiredFields.length;
  if (total === 0) return 0;
  const filled = requiredFields.filter((field) => isFilled(getPathValue(target, field))).length;
  return Math.round((filled / total) * 100);
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
    skipped_sources: [] as string[],
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

    const { data: agencySeedDocs, error: agencySeedError } = await supabase
      .from("ai_documents")
      .select("metadata")
      .eq("agency_id", agency.id)
      .eq("doc_type", "agency_sop")
      .limit(1);
    if (agencySeedError) {
      stats.errors.push(`agency_seed_doc ${agency.id}: ${agencySeedError.message}`);
    }
    const agencySeedPayload = agencySeedDocs?.[0]?.metadata?.backfill_payload;
    const mergedAgencyBrain = agencySeedPayload && typeof agencySeedPayload === "object"
      ? mergeDeep(brain, agencySeedPayload as Record<string, unknown>)
      : brain;

    const completion = completionPercent(mergedAgencyBrain, REQUIRED_AGENCY_FIELDS);
    const status = completion >= 70 ? "usable" : "draft";
    if (!dryRun) {
      const { error } = await supabase.from("agency_brains").insert({
        agency_id: agency.id,
        version: 1,
        status,
        locked: false,
        brain_json: mergedAgencyBrain,
        json_diff: null,
        confidence: completion,
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
    if (brandingError) {
      if (brandingError.message.includes("Could not find the table")) {
        stats.skipped_sources.push(`client_branding:${client.id}`);
      } else {
        stats.errors.push(`client_branding ${client.id}: ${brandingError.message}`);
      }
    }

    let pillars: Array<{ title: string; description: string | null }> | null = null;
    const { data: pillarsData, error: pillarsError } = await supabase
      .from("client_content_pillars")
      .select("title, description")
      .eq("client_id", client.id);
    if (pillarsError) {
      if (pillarsError.message.includes("Could not find the table")) {
        stats.skipped_sources.push(`client_content_pillars:${client.id}`);
      } else {
        stats.errors.push(`client_content_pillars ${client.id}: ${pillarsError.message}`);
      }
    } else {
      pillars = pillarsData ?? [];
    }

    let assets: Array<{ file_url: string | null }> | null = null;
    const { data: assetsData, error: assetsError } = await supabase
      .from("client_assets")
      .select("file_url")
      .eq("client_id", client.id);
    if (assetsError) {
      if (assetsError.message.includes("Could not find the table")) {
        stats.skipped_sources.push(`client_assets:${client.id}`);
      } else {
        stats.errors.push(`client_assets ${client.id}: ${assetsError.message}`);
      }
    } else {
      assets = assetsData ?? [];
    }

    let socials: Array<{ url: string | null }> | null = null;
    const { data: socialsData, error: socialsError } = await supabase
      .from("social_profiles")
      .select("url")
      .eq("client_id", client.id);
    if (socialsError) {
      if (socialsError.message.includes("Could not find the table")) {
        stats.skipped_sources.push(`social_profiles:${client.id}`);
      } else {
        stats.errors.push(`social_profiles ${client.id}: ${socialsError.message}`);
      }
    } else {
      socials = socialsData ?? [];
    }

    const assetUrls = [
      ...(assets ?? []).map((asset) => asset.file_url).filter(Boolean),
      client.logo_url,
    ].filter(Boolean) as string[];

    const brain = {
      brand_basics: {
        name: client.name ?? "",
        website: client.website ?? "",
        socials: (socials ?? []).map((profile) => profile.url).filter(Boolean) as string[],
        tone: branding?.brand_tone ?? branding?.brand_voice ?? client.tone_of_voice ?? "",
        differentiators: branding?.brand_guidelines ? [branding.brand_guidelines] : [],
      },
      offer_details: {
        products_services: client.niche ? [client.niche] : [],
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

    const { data: clientSeedDocs, error: clientSeedError } = await supabase
      .from("ai_documents")
      .select("metadata")
      .eq("client_id", client.id)
      .eq("doc_type", "client_guidelines")
      .limit(1);
    if (clientSeedError) {
      stats.errors.push(`client_seed_doc ${client.id}: ${clientSeedError.message}`);
    }
    const clientSeedPayload = clientSeedDocs?.[0]?.metadata?.backfill_payload;
    const mergedClientBrain = clientSeedPayload && typeof clientSeedPayload === "object"
      ? mergeDeep(brain, clientSeedPayload as Record<string, unknown>)
      : brain;

    const completion = completionPercent(mergedClientBrain, REQUIRED_CLIENT_FIELDS);
    const status = completion >= 70 ? "usable" : "draft";
    if (!dryRun) {
      const { error } = await supabase.from("client_brains").insert({
        agency_id: client.agency_id,
        client_id: client.id,
        version: 1,
        status,
        locked: false,
        brain_json: mergedClientBrain,
        json_diff: null,
        confidence: completion,
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
