import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const email = `dev-backfill-seed-${crypto.randomUUID()}@example.com`;
const password = "SeedPass123!";

const { data: userData, error: userError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (userError || !userData?.user) {
  console.error("Failed to create seed user:", userError?.message ?? "unknown error");
  Deno.exit(1);
}

const userId = userData.user.id;

const agencyId = crypto.randomUUID();
const { data: agencyRows, error: agencyError } = await supabase
  .from("agencies")
  .insert({
    id: agencyId,
    user_id: userId,
    name: "Seed Agency",
    website: "https://seed-agency.example.com",
    niche: "SaaS",
  })
  .select("id");

if (agencyError || !agencyRows?.length) {
  console.error("Failed to create seed agency:", agencyError?.message ?? "unknown error");
  Deno.exit(1);
}

const { error: memberError } = await supabase
  .from("agency_members")
  .insert({
    agency_id: agencyId,
    user_id: userId,
    role: "owner",
  });

if (memberError) {
  console.error("Failed to create seed agency member:", memberError.message);
  Deno.exit(1);
}

const clientId = crypto.randomUUID();
const { data: clientRows, error: clientError } = await supabase
  .from("clients")
  .insert({
    id: clientId,
    agency_id: agencyId,
    name: "Seed Client",
    website: "https://seed-client.example.com",
    notes: "Seed notes for backfill.",
    niche: "B2B",
    tone_of_voice: "Confident",
  })
  .select("id");

if (clientError || !clientRows?.length) {
  console.error("Failed to create seed client:", clientError?.message ?? "unknown error");
  Deno.exit(1);
}

const agencySeedPayload = {
  identity: {
    name: "Seed Agency",
    niches: ["SaaS"],
    offers: ["Strategy", "Content"],
    geo: ["US"],
    languages: ["English"],
  },
  icp: {
    industries: ["SaaS"],
    size: ["11-50"],
    personas: ["Founder"],
    pains: ["Lead gen"],
    objections: ["Price"],
  },
  voice_tone: {
    adjectives: ["Clear", "Bold", "Direct", "Friendly", "Premium"],
    banned_words: ["cheap"],
    preferred_vocab: ["growth"],
    writing_rules: ["Short sentences"],
  },
  strategy_defaults: {
    pillars: ["Education"],
    hook_styles: ["Question"],
    cta_styles: ["Book a call"],
    platform_formats: ["LinkedIn"],
  },
  safety_policy: {
    allowed: ["General claims"],
    avoid: ["Guarantees"],
    compliance_notes: ["No medical claims"],
  },
  process_rules: {
    revisions: "2 rounds",
    approvals: "Manager approval",
    escalation_rules: "Escalate after 2 rejections",
  },
  faq: Array.from({ length: 10 }).map((_, index) => ({
    question: `FAQ ${index + 1}`,
    answer: "Seed answer",
  })),
  gold_examples: Array.from({ length: 5 }).map((_, index) => ({
    title: `Example ${index + 1}`,
    content: "Seed content",
    why_good: "Clear structure",
  })),
};

const clientSeedPayload = {
  brand_basics: {
    name: "Seed Client",
    website: "https://seed-client.example.com",
    socials: ["https://linkedin.com/company/seed-client"],
    tone: "Confident",
    differentiators: ["Fast delivery"],
  },
  offer_details: {
    products_services: ["B2B SaaS"],
    usps: ["ROI focused"],
  },
  audience: {
    demographics: ["Founders"],
    location: ["US"],
    intent: ["Pipeline growth"],
    problems: ["Low awareness"],
    objections: ["Budget"],
  },
  competitors: [
    { name: "Competitor 1", notes: "Strong brand" },
    { name: "Competitor 2", notes: "Low price" },
    { name: "Competitor 3", notes: "Niche focus" },
  ],
  constraints: {
    banned_claims: ["Guarantees"],
    legal_constraints: ["No financial promises"],
    taboo_topics: ["Politics"],
    dos: ["Use approved CTAs"],
    donts: ["No medical claims"],
  },
  pillars: [
    { name: "Education", examples: ["How-to content"] },
    { name: "Social proof", examples: ["Case studies"] },
    { name: "Product", examples: ["Feature highlights"] },
  ],
  faq: Array.from({ length: 10 }).map((_, index) => ({
    question: `Client FAQ ${index + 1}`,
    answer: "Seed answer",
  })),
  assets_links: {
    key_urls: ["https://seed-client.example.com/guide"],
    guidelines_link: "https://seed-client.example.com/brand",
  },
};

const { error: agencyDocError } = await supabase.from("ai_documents").insert({
  agency_id: agencyId,
  doc_type: "agency_sop",
  title: "Seed Agency SOP",
  content: "Seed agency backfill payload",
  source: { source_type: "seed", source_ref: "dev_backfill_seed" },
  metadata: { backfill_payload: agencySeedPayload },
});

if (agencyDocError) {
  console.error("Failed to insert agency seed document:", agencyDocError.message);
  Deno.exit(1);
}

const { error: clientDocError } = await supabase.from("ai_documents").insert({
  agency_id: agencyId,
  client_id: clientId,
  doc_type: "client_guidelines",
  title: "Seed Client Guidelines",
  content: "Seed client backfill payload",
  source: { source_type: "seed", source_ref: "dev_backfill_seed" },
  metadata: { backfill_payload: clientSeedPayload },
});

if (clientDocError) {
  console.error("Failed to insert client seed document:", clientDocError.message);
  Deno.exit(1);
}

console.log("Seed created:", { userId, agencyId, clientId });
