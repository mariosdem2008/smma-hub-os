import { resolveSnapshotValue } from "./onboardingState.ts";

export type QuestionPriority = "P0" | "P1";
export type InputType = "text" | "list" | "numeric" | "percent" | "tz_lang";

export type QuestionDef = {
  id: string;
  field_path: string;
  priority: QuestionPriority;
  question_text: string;
  examples: string[];
  input_type: InputType;
  module: string;
  why_needed?: string;
  impact?: string;
  validation_rule: string;
  error_code: string;
  help_text: string;
  condition?: "requires_paid_ads";
};

export const REMOVED_FIELDS: Array<{ field: string; reason: string }> = [
  {
    field: "positioning.proof",
    reason: "Merged into agency.proof_metrics with metric + timeframe + optional URL format.",
  },
  {
    field: "positioning.competitors",
    reason: "Replaced by agency.competitor_urls for concrete benchmark inputs.",
  },
  {
    field: "offer_stack.add_ons",
    reason: "Removed from onboarding core to keep first pass focused on sellable packaged offers.",
  },
  {
    field: "offer_stack.guarantees",
    reason: "Moved out of onboarding and handled in offer/legal templates later.",
  },
  {
    field: "operations.content_pillars",
    reason: "Merged into execution templates post-activation; not required for onboarding core.",
  },
  {
    field: "bootstrap.client_types",
    reason: "Replaced by agency.client_type_split with strict SMB/Mid/Enterprise split.",
  },
];

export const QUESTION_EXPLAINERS: Record<string, { why_needed: string; impact: string }> = {
  "agency.name": {
    why_needed: "Canonical agency identity across documents, invoices, and assistant output.",
    impact: "Prevents naming drift in AI-generated artifacts.",
  },
  "agency.timezone": {
    why_needed: "Timezone anchors calendar timing and deadline interpretation.",
    impact: "Improves SLA windows, send-times, and scheduling accuracy.",
  },
  "agency.primary_client_languages": {
    why_needed: "Language mix controls output language defaults and variants.",
    impact: "Improves localization and communication quality.",
  },
  "agency.best_client_summary": {
    why_needed: "Best-client snapshot sets the ICP reference point.",
    impact: "Improves targeting, messaging, and proposal generation.",
  },
  "agency.key_differentiators": {
    why_needed: "Differentiators drive positioning and hooks.",
    impact: "Used in proposals, ads, and sales narratives.",
  },
  "agency.service_catalog": {
    why_needed: "Defines what the agency actually delivers.",
    impact: "Controls templates, task plans, and staffing suggestions.",
  },
  "agency.packaged_offers": {
    why_needed: "Offer packaging is required for reusable sales and delivery systems.",
    impact: "Enables automated proposals and KPI-aligned plans.",
  },
  "agency.pricing_model": {
    why_needed: "Pricing model controls forecast and recommendation logic.",
    impact: "Improves deal structuring and growth planning.",
  },
};

export const QUESTION_BANK: QuestionDef[] = [
  {
    id: "Q-101",
    field_path: "agency.name",
    priority: "P0",
    question_text: "Legal / public brand name (exact).",
    examples: ["Bootstrap Agency", "Apex Social Partners", "Nimbus Media Group"],
    input_type: "text",
    module: "bootstrap",
    validation_rule: "string length 3-80, no emojis, no markup",
    error_code: "ERR_AGENCY_NAME_FORMAT",
    help_text: "Use 3-80 plain characters with letters/numbers/spaces only.",
  },
  {
    id: "Q-102",
    field_path: "agency.timezone",
    priority: "P0",
    question_text: "What timezone should we use for deadlines and reports? (e.g., Europe/Athens)",
    examples: ["Europe/Athens", "Europe/Nicosia", "Asia/Dubai"],
    input_type: "tz_lang",
    module: "bootstrap",
    validation_rule: "must be valid IANA timezone string",
    error_code: "ERR_TIMEZONE_INVALID",
    help_text: "Pick a valid IANA timezone such as Europe/Athens.",
  },
  {
    id: "Q-103",
    field_path: "agency.primary_client_languages",
    priority: "P0",
    question_text: "What languages do your clients speak most? Add percentages that total 100.",
    examples: ["English 70%, Greek 30%", "English 100%", "Arabic 60%, English 40%"],
    input_type: "percent",
    module: "bootstrap",
    validation_rule: "language + integer percent entries, total must equal 100",
    error_code: "ERR_LANGUAGE_SPLIT_INVALID",
    help_text: "Provide language-percent pairs that sum exactly to 100.",
  },
  {
    id: "Q-104",
    field_path: "agency.team_size_total",
    priority: "P0",
    question_text: "How many people are on your team, including founders?",
    examples: ["7", "12", "3"],
    input_type: "numeric",
    module: "bootstrap",
    validation_rule: "integer between 0 and 500",
    error_code: "ERR_TEAM_SIZE_RANGE",
    help_text: "Enter an integer between 0 and 500.",
  },
  {
    id: "Q-105",
    field_path: "agency.active_paying_clients",
    priority: "P0",
    question_text: "How many paying clients do you currently manage?",
    examples: ["12", "3", "48"],
    input_type: "numeric",
    module: "bootstrap",
    validation_rule: "integer between 0 and 5000",
    error_code: "ERR_ACTIVE_CLIENTS_RANGE",
    help_text: "Enter an integer between 0 and 5000.",
  },
  {
    id: "Q-106",
    field_path: "agency.top_industries",
    priority: "P0",
    question_text: "Which industries are your main focus? (up to 5, one per line)",
    examples: ["Gyms\nDentists\nSaaS B2B", "Real Estate\nClinics", "Ecommerce\nHospitality\nLegal"],
    input_type: "list",
    module: "bootstrap",
    validation_rule: "1-5 entries, one industry per line; custom entries require proof sentence",
    error_code: "ERR_TOP_INDUSTRIES_INVALID",
    help_text: "Provide 1-5 industries. If using a custom industry, add 'proof: ...' on that line.",
  },
  {
    id: "Q-107",
    field_path: "agency.best_client_summary",
    priority: "P0",
    question_text: "Describe your ideal or best-fit client in one sentence (who they are, main goal, and size or budget).",
    examples: [
      "Local gym owner, 10-30 new signups per month, primary goal is lead volume.",
      "B2B SaaS founder at $40k MRR focused on qualified demo bookings.",
      "Dental clinic owner with 3 dentists seeking predictable monthly bookings.",
    ],
    input_type: "text",
    module: "positioning",
    validation_rule: "single sentence, 10-30 words",
    error_code: "ERR_BEST_CLIENT_SUMMARY_LENGTH",
    help_text: "Use one sentence between 10 and 30 words.",
  },
  {
    id: "Q-108",
    field_path: "agency.key_differentiators",
    priority: "P0",
    question_text: "What are your 3 biggest differentiators? (one short bullet per line)",
    examples: [
      "48h content turnaround\nFounder-led strategy\nNiche expertise in dentists",
      "Data-backed scripts\nFast approvals\nIn-house UGC network",
      "Performance-first creative\nClear weekly reporting\nOffer positioning depth",
    ],
    input_type: "list",
    module: "positioning",
    validation_rule: "exactly 3 bullets, each bullet max 10 words",
    error_code: "ERR_DIFFERENTIATORS_FORMAT",
    help_text: "Provide exactly 3 bullet lines; each line 10 words or fewer.",
  },
  {
    id: "Q-109",
    field_path: "agency.service_catalog",
    priority: "P0",
    question_text: "Which services do you sell today? Add one line of scope for each service.",
    examples: [
      "Paid Ads | Meta + Google ad management and creative testing",
      "Social Mgmt | Monthly strategy, posting, and community management",
      "Content Production | Reels and short-form production workflow",
    ],
    input_type: "list",
    module: "offer_stack",
    validation_rule: "one or more rows in format Service | scope summary",
    error_code: "ERR_SERVICE_CATALOG_FORMAT",
    help_text: "Provide at least one row using 'Service | scope summary'.",
  },
  {
    id: "Q-110",
    field_path: "agency.top_margin_offers",
    priority: "P0",
    question_text: "What are your top 1-2 highest-margin offers? Use: Offer | Deliverables | Price Range | Why margin is high.",
    examples: [
      "Retainer Growth | Weekly strategy; 12 creatives; reporting | 1500-2500 | Reusable workflow",
      "UGC Engine | Creator sourcing; 8 videos; usage rights | 1200-2200 | Low production overhead",
      "LinkedIn Demand | 12 posts; DM script; pipeline review | 1300-2100 | High perceived value",
    ],
    input_type: "list",
    module: "offer_stack",
    validation_rule: "1-2 rows in pipe format with 4 columns",
    error_code: "ERR_TOP_MARGIN_OFFERS_FORMAT",
    help_text: "Provide 1 or 2 rows using 'name | 3 deliverables | EUR range | reason'.",
  },
  {
    id: "Q-111",
    field_path: "agency.packaged_offers",
    priority: "P0",
    question_text: "List 1-5 packaged offers. Use: Offer | KPI outcome | Deliverables | Duration | Price range.",
    examples: [
      "Lead Engine | 40 leads/month | 12 creatives; ad mgmt; reporting | 30 days | 1500-2500",
      "Content Machine | 20 reels/month | scripting; filming; editing | 30 days | 1200-1800",
      "LinkedIn Authority | 12 posts + 20 DMs/week | posts; DM scripts; analytics | 30 days | 1100-1700",
    ],
    input_type: "list",
    module: "offer_stack",
    validation_rule: "1-5 rows, each with 5 mandatory pipe-separated columns",
    error_code: "ERR_PACKAGED_OFFERS_FORMAT",
    help_text: "Provide 1-5 rows using 'name | KPI | deliverables | duration | EUR range'.",
  },
  {
    id: "Q-112",
    field_path: "agency.pricing_model",
    priority: "P0",
    question_text: "Which pricing model do you use most? Choose one and add a short reason.",
    examples: [
      "Fixed retainer | Predictable monthly workload and scope",
      "Tiered packages | Different client sizes need different service depth",
      "Hybrid | Base fee plus variable performance component",
    ],
    input_type: "text",
    module: "offer_stack",
    validation_rule: "one allowed model + one explanatory sentence",
    error_code: "ERR_PRICING_MODEL_FORMAT",
    help_text: "Use format 'Model | one-line explanation' with one of the allowed models.",
  },

  {
    id: "Q-201",
    field_path: "ai.persona_name",
    priority: "P1",
    question_text: "AI assistant name (optional, leave blank for default 'Alex').",
    examples: ["Alex", "Nova", "Atlas"],
    input_type: "text",
    module: "ai_persona",
    validation_rule: "string up to 20 chars",
    error_code: "ERR_PERSONA_NAME_LENGTH",
    help_text: "Use up to 20 characters.",
  },
  {
    id: "Q-202",
    field_path: "ai.role_title",
    priority: "P1",
    question_text: "Primary role label the assistant should use (e.g., Strategy Partner).",
    examples: ["Strategy Partner", "Operations Manager", "Head of Content"],
    input_type: "text",
    module: "ai_persona",
    validation_rule: "string up to 30 chars",
    error_code: "ERR_ROLE_TITLE_LENGTH",
    help_text: "Use up to 30 characters.",
  },
  {
    id: "Q-203",
    field_path: "ai.personality_traits",
    priority: "P1",
    question_text: "Pick 3 traits from checklist + pick intensity Low/Med/High for each.",
    examples: ["Direct:High, Friendly:Med, Analytical:High", "Creative:Med, Urgent:High, Detail-oriented:Med", "Formal:Med, Minimalist:High, Analytical:Med"],
    input_type: "list",
    module: "ai_persona",
    validation_rule: "exactly 3 trait:level pairs; level must be Low/Med/High",
    error_code: "ERR_PERSONALITY_TRAITS_FORMAT",
    help_text: "Provide exactly 3 pairs using Trait:Low/Med/High.",
  },
  {
    id: "Q-204",
    field_path: "ai.writing_preferences",
    priority: "P1",
    question_text: "Tone: Formal/Neutral/Conversational. Sentence length: Short/Medium/Long. Emojis allowed: 0 / 1-2 / 3+. Always include CTA? Yes/No.",
    examples: ["Tone: Neutral | Length: Short | Emojis: 1-2 | CTA: Yes", "Tone: Formal | Length: Medium | Emojis: 0 | CTA: Yes", "Tone: Conversational | Length: Short | Emojis: 1-2 | CTA: No"],
    input_type: "text",
    module: "ai_persona",
    validation_rule: "structured select values for tone, length, emojis, CTA",
    error_code: "ERR_WRITING_PREFS_FORMAT",
    help_text: "Use format 'Tone: ... | Length: ... | Emojis: ... | CTA: Yes/No'.",
  },
  {
    id: "Q-205",
    field_path: "agency.website_and_links",
    priority: "P1",
    question_text: "Main website + 0-5 public social links (paste URLs).",
    examples: ["https://bootstrapagency.com", "https://linkedin.com/company/bootstrapagency", "https://instagram.com/bootstrapagency"],
    input_type: "list",
    module: "bootstrap",
    validation_rule: "1-6 valid URLs",
    error_code: "ERR_WEBSITE_LINKS_INVALID",
    help_text: "Provide 1-6 valid http(s) URLs.",
  },
  {
    id: "Q-206",
    field_path: "agency.role_counts",
    priority: "P1",
    question_text: "Headcount by role (CSV): role, count (e.g., 'strategist,2').",
    examples: ["strategist,2", "editor,3", "account manager,1"],
    input_type: "list",
    module: "bootstrap",
    validation_rule: "CSV rows role,count and total must match agency.team_size_total when available",
    error_code: "ERR_ROLE_COUNTS_INVALID",
    help_text: "Provide CSV rows 'role,count'; if team size is set, totals must match.",
  },
  {
    id: "Q-207",
    field_path: "agency.client_type_split",
    priority: "P1",
    question_text: "Client type % split (SMB / Mid / Enterprise) - must sum to 100.",
    examples: ["SMB 70, Mid 20, Enterprise 10", "SMB 100, Mid 0, Enterprise 0", "SMB 60, Mid 30, Enterprise 10"],
    input_type: "percent",
    module: "positioning",
    validation_rule: "three integer percentages summing exactly to 100",
    error_code: "ERR_CLIENT_TYPE_SPLIT_INVALID",
    help_text: "Provide SMB, Mid, Enterprise percentages totaling 100.",
  },
  {
    id: "Q-208",
    field_path: "agency.who_to_avoid",
    priority: "P1",
    question_text: "Client traits to decline (3 bullets).",
    examples: ["No decision-maker access", "Unrealistic guarantees requested", "No assets and no budget"],
    input_type: "list",
    module: "positioning",
    validation_rule: "1-3 bullet lines",
    error_code: "ERR_WHO_TO_AVOID_INVALID",
    help_text: "Provide 1-3 bullets.",
  },
  {
    id: "Q-209",
    field_path: "agency.proof_metrics",
    priority: "P1",
    question_text: "Top proof: 1-3 metrics with timeframe and link (e.g., +120% leads in 60 days, link).",
    examples: ["+120% leads in 60 days | https://example.com/case-study-1", "ROAS 4.1x in 90 days", "3.2M views/month in Q4 | https://example.com/case-study-2"],
    input_type: "list",
    module: "positioning",
    validation_rule: "1-3 rows, each includes number and timeframe, optional URL",
    error_code: "ERR_PROOF_METRICS_INVALID",
    help_text: "Each row needs a number and timeframe (URL optional).",
  },
  {
    id: "Q-210",
    field_path: "agency.competitor_urls",
    priority: "P1",
    question_text: "3 competitor / benchmark URLs (public sites) for style/price benchmarking.",
    examples: ["https://competitor-1.com", "https://competitor-2.com", "https://competitor-3.com"],
    input_type: "list",
    module: "positioning",
    validation_rule: "0-3 valid URLs",
    error_code: "ERR_COMPETITOR_URLS_INVALID",
    help_text: "Provide up to 3 valid URLs.",
  },
  {
    id: "Q-211",
    field_path: "agency.price_ranges_by_tier",
    priority: "P1",
    question_text: "Typical EUR per month per tier (provide 2-4 tiers: name, low, high).",
    examples: ["Starter,500,900", "Growth,1000,1800", "Scale,2000,3500"],
    input_type: "list",
    module: "offer_stack",
    validation_rule: "2-4 CSV rows in format tier,low,high with low<=high",
    error_code: "ERR_PRICE_RANGES_BY_TIER_INVALID",
    help_text: "Provide 2-4 rows in CSV: tier,low,high.",
  },

  {
    id: "Q-301",
    field_path: "operations.required_client_assets",
    priority: "P1",
    question_text: "Before kickoff, what must clients send you and within how many days? Use: Asset | Max delay days.",
    examples: ["Brand guidelines | 5", "Ad account access | 3", "Offer details + pricing | 4"],
    input_type: "list",
    module: "operations",
    validation_rule: "one or more rows in format asset | max_delay_days",
    error_code: "ERR_REQUIRED_ASSETS_INVALID",
    help_text: "Use 'asset | days' rows with integer days.",
  },
  {
    id: "Q-302",
    field_path: "operations.approval_workflow",
    priority: "P1",
    question_text: "Who approves content and in what SLA? Provide role, contact method, SLA hours (e.g., Founder, email, 48h).",
    examples: ["Founder,email,48", "Account Manager,slack,24", "Client POC,whatsapp,36"],
    input_type: "list",
    module: "operations",
    validation_rule: "1-3 CSV rows role,method,sla_hours",
    error_code: "ERR_APPROVAL_WORKFLOW_INVALID",
    help_text: "Provide 1-3 rows in CSV: role,method,sla_hours.",
  },
  {
    id: "Q-303",
    field_path: "operations.turnaround_slas",
    priority: "P1",
    question_text: "Standard SLAs (drafts, edits, urgent) in hours.",
    examples: ["drafts:48, edits:24, urgent:6", "drafts:72, edits:24, urgent:8", "drafts:36, edits:12, urgent:4"],
    input_type: "text",
    module: "operations",
    validation_rule: "must include drafts, edits, urgent hour values",
    error_code: "ERR_TURNAROUND_SLAS_INVALID",
    help_text: "Include numeric hours for drafts, edits, and urgent.",
  },
  {
    id: "Q-304",
    field_path: "operations.reporting_cadence",
    priority: "P1",
    question_text: "Reporting cadence and format (weekly email, monthly dashboard, etc.).",
    examples: ["Weekly email + monthly dashboard", "Bi-weekly call + monthly PDF", "Monthly dashboard + quarterly strategy review"],
    input_type: "text",
    module: "operations",
    validation_rule: "pick cadence format with short custom note",
    error_code: "ERR_REPORTING_CADENCE_INVALID",
    help_text: "Provide cadence and output format in one short line.",
  },
  {
    id: "Q-305",
    field_path: "operations.tools_stack",
    priority: "P1",
    question_text: "Primary tools used (PM / content / analytics / ads) - paste tool names.",
    examples: ["Notion, ClickUp, GA4", "Asana, Figma, Meta Ads", "Slack, Airtable, Looker Studio"],
    input_type: "list",
    module: "operations",
    validation_rule: "1-6 tools",
    error_code: "ERR_TOOLS_STACK_INVALID",
    help_text: "Provide 1-6 tool names.",
  },
  {
    id: "Q-306",
    field_path: "operations.platforms_managed",
    priority: "P1",
    question_text: "Primary platforms you manage (select up to 6).",
    examples: ["Instagram, TikTok, LinkedIn", "YouTube, Facebook", "LinkedIn, X"],
    input_type: "list",
    module: "operations",
    validation_rule: "1-6 platforms",
    error_code: "ERR_PLATFORMS_MANAGED_INVALID",
    help_text: "Provide 1-6 platforms.",
  },
  {
    id: "Q-307",
    field_path: "operations.rep_policy_boundaries",
    priority: "P1",
    question_text: "Compliance or disallowed claims (3 bullets).",
    examples: ["No legal, medical, or financial claims", "No guaranteed outcomes", "Escalate compliance-sensitive requests"],
    input_type: "list",
    module: "rep_policy",
    validation_rule: "1-5 bullets",
    error_code: "ERR_REP_POLICY_BOUNDARIES_INVALID",
    help_text: "Provide 1-5 bullet lines.",
  },

  {
    id: "Q-308",
    field_path: "operations.paid_ads_account_access",
    priority: "P1",
    question_text: "Paid Ads selected: confirm ad-account access model and owner contact.",
    examples: ["Meta Business Manager + owner@client.com", "Google Ads MCC + founder@client.com", "Shared ad account + accountmanager@client.com"],
    input_type: "text",
    module: "operations",
    validation_rule: "required when Paid Ads is in service catalog",
    error_code: "ERR_PAID_ADS_ACCESS_REQUIRED",
    help_text: "Provide platform access model and owner contact.",
    condition: "requires_paid_ads",
  },
  {
    id: "Q-309",
    field_path: "operations.paid_ads_spend_bracket",
    priority: "P1",
    question_text: "Paid Ads selected: monthly ad spend bracket per client (EUR).",
    examples: ["500-1500", "1500-5000", "5000-20000"],
    input_type: "text",
    module: "operations",
    validation_rule: "required when Paid Ads is in service catalog; format low-high",
    error_code: "ERR_PAID_ADS_SPEND_BRACKET_REQUIRED",
    help_text: "Provide a bracket like 1500-5000.",
    condition: "requires_paid_ads",
  },
];

export const REQUIRED_P0 = QUESTION_BANK.filter((question) => question.priority === "P0");

export function splitFieldPath(fieldPath: string) {
  const [module, ...rest] = fieldPath.split(".");
  if (rest.length === 0) {
    return { module: "agency", path: module };
  }
  return { module, path: rest.join(".") };
}

export function isAnswered(snapshot: Record<string, unknown>, fieldPath: string) {
  const { module, path } = splitFieldPath(fieldPath);
  if (!module || !path) return false;
  const value = resolveSnapshotValue(snapshot, module, path);
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function hasPaidAdsInServiceCatalog(snapshot: Record<string, unknown>) {
  const value = resolveSnapshotValue(snapshot, "agency", "service_catalog");
  if (Array.isArray(value)) {
    return value.some((item) => String(item).toLowerCase().includes("paid ads"));
  }
  if (typeof value === "string") {
    return value.toLowerCase().includes("paid ads");
  }
  return false;
}

function shouldAskQuestion(question: QuestionDef, snapshot: Record<string, unknown>) {
  if (!question.condition) return true;
  if (question.condition === "requires_paid_ads") {
    return hasPaidAdsInServiceCatalog(snapshot);
  }
  return true;
}

export function getNextQuestion(snapshot: Record<string, unknown>, skipped: Record<string, boolean>) {
  for (const question of QUESTION_BANK) {
    if (question.priority !== "P0") continue;
    if (!isAnswered(snapshot, question.field_path)) return question;
  }

  const operationsQuestions = QUESTION_BANK.filter(
    (question) => question.priority !== "P0" && question.field_path.startsWith("operations.")
  );
  for (const question of operationsQuestions) {
    if (!shouldAskQuestion(question, snapshot)) continue;
    if (skipped[question.field_path]) continue;
    if (!isAnswered(snapshot, question.field_path)) return question;
  }

  const advancedQuestions = QUESTION_BANK.filter(
    (question) => question.priority !== "P0" && !question.field_path.startsWith("operations.")
  );
  for (const question of advancedQuestions) {
    if (!shouldAskQuestion(question, snapshot)) continue;
    if (skipped[question.field_path]) continue;
    if (!isAnswered(snapshot, question.field_path)) return question;
  }

  return null;
}

export function countRequiredComplete(snapshot: Record<string, unknown>) {
  const total = REQUIRED_P0.length;
  const complete = REQUIRED_P0.filter((question) => isAnswered(snapshot, question.field_path)).length;
  return { complete, total, requiredComplete: complete === total };
}
