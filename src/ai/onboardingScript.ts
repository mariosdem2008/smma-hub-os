import { resolveSnapshotValue } from "./onboardingState.ts";

export type QuestionPriority = "P0" | "P1" | "P2";
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
};

export const QUESTION_EXPLAINERS: Record<
  string,
  { why_needed: string; impact: string }
> = {
  "ai_persona.name": {
    why_needed: "This name appears in your internal AI copilots and makes the assistant feel like part of your team.",
    impact: "Improves personalization and consistency in how the assistant addresses your team and clients.",
  },
  "ai_persona.role_title": {
    why_needed: "This anchors the assistantâ€™s tone and responsibilities.",
    impact: "Guides how the AI responds (ops vs strategy vs content).",
  },
  "ai_persona.traits": {
    why_needed: "Traits calibrate how the assistant communicates and prioritizes.",
    impact: "Aligns AI personality with your brand preferences.",
  },
  "ai_persona.writing_style": {
    why_needed: "Defines how outputs are written across drafts and client content.",
    impact: "Reduces editing time and keeps tone consistent.",
  },
  "bootstrap.agency_name": {
    why_needed: "We use this across your AI brain and client-facing materials.",
    impact: "Ensures outputs reference your agency correctly.",
  },
  "bootstrap.links": {
    why_needed: "We use these to understand your positioning and brand presence.",
    impact: "Improves personalization and future audits.",
  },
  "bootstrap.locale": {
    why_needed: "We need this to schedule work and generate client-ready copy.",
    impact: "Ensures content timing and language match your operations.",
  },
  "bootstrap.team_size": {
    why_needed: "Team size helps us size workflows and recommendations.",
    impact: "Tailors playbooks to your capacity.",
  },
  "bootstrap.team_roles": {
    why_needed: "Role breakdown clarifies who handles strategy, content, ops, and sales.",
    impact: "Improves task delegation suggestions and SOPs.",
  },
  "bootstrap.active_clients": {
    why_needed: "Active clients determine workload and baseline benchmarks.",
    impact: "Adjusts recommendations to your scale.",
  },
  "bootstrap.client_types": {
    why_needed: "Client mix affects strategy and content examples.",
    impact: "Tunes AI suggestions to the dominant client type.",
  },
  "bootstrap.target_industries": {
    why_needed: "Industry focus defines your positioning and proof.",
    impact: "Sharpens niche-specific outputs.",
  },
  "positioning.icp_best": {
    why_needed: "Your best ICP anchors all strategy and messaging.",
    impact: "Guides the AIâ€™s targeting recommendations.",
  },
  "positioning.icp_worst": {
    why_needed: "Avoiding bad-fit clients protects margins and delivery.",
    impact: "Helps AI filter recommendations and qualification prompts.",
  },
  "positioning.differentiators": {
    why_needed: "Differentiators power sales copy and positioning.",
    impact: "Used directly in pitch and proposal drafts.",
  },
  "positioning.proof": {
    why_needed: "Proof drives trust and conversion.",
    impact: "Used in credibility sections and case studies.",
  },
  "positioning.competitors": {
    why_needed: "Benchmarking informs competitive positioning.",
    impact: "Helps AI suggest differentiation angles.",
  },
  "bootstrap.services": {
    why_needed: "Core services define what the AI should recommend and not recommend.",
    impact: "Prevents irrelevant outputs.",
  },
  "offer_stack.core_offer_high_margin": {
    why_needed: "High-margin offers should be prioritized in strategy.",
    impact: "Guides optimization and packaging advice.",
  },
  "offer_stack.core_offers": {
    why_needed: "Packaged offers define your productized services.",
    impact: "Used in client proposals and internal planning.",
  },
  "offer_stack.pricing_model": {
    why_needed: "Pricing model affects recommendations and onboarding flows.",
    impact: "Aligns AI with your revenue model.",
  },
  "offer_stack.price_ranges": {
    why_needed: "Price ranges set expectations and filters.",
    impact: "AI can recommend realistic options and positioning.",
  },
  "offer_stack.add_ons": {
    why_needed: "Add-ons drive upsells and retention.",
    impact: "Used in expansion recommendations.",
  },
  "offer_stack.guarantees": {
    why_needed: "Guarantees shape risk language and sales messaging.",
    impact: "AI avoids conflicting promises.",
  },
  "operations.content_pillars": {
    why_needed: "Pillars are the backbone of content planning.",
    impact: "Used to generate consistent content ideas.",
  },
  "rep_policy.boundaries": {
    why_needed: "Compliance boundaries prevent risky outputs.",
    impact: "AI avoids taboo claims and escalates to humans.",
  },
  "operations.approvals": {
    why_needed: "Approval flow affects timelines and automation.",
    impact: "AI aligns schedules and expectations.",
  },
  "operations.turnaround_sla": {
    why_needed: "Turnaround defines delivery cadence.",
    impact: "AI sets realistic deadlines.",
  },
  "operations.reporting_cadence": {
    why_needed: "Reporting needs shape client updates.",
    impact: "AI drafts reports in your preferred cadence.",
  },
  "operations.tools_stack": {
    why_needed: "Tools determine workflow integrations.",
    impact: "AI references the right systems.",
  },
  "operations.platforms": {
    why_needed: "Platforms define channel strategy.",
    impact: "AI only suggests relevant formats.",
  },
  "operations.required_assets": {
    why_needed: "Assets required to deliver on time.",
    impact: "AI can request missing inputs proactively.",
  },
};

export const QUESTION_BANK: QuestionDef[] = [
  {
    id: "Q-001",
    field_path: "ai_persona.name",
    priority: "P1",
    question_text: "What should we call your agency’s AI assistant? (default: Alex)",
    examples: ["Alex", "Nova", "Atlas", "Bootstrap Ops", "Client Success AI"],
    input_type: "text",
    module: "ai_persona",
  },
  {
    id: "Q-002",
    field_path: "ai_persona.role_title",
    priority: "P2",
    question_text: "What role should it feel like?",
    examples: ["Operations Manager", "Head of Content", "Strategy Partner", "Account Manager", "COO Assistant"],
    input_type: "text",
    module: "ai_persona",
  },
  {
    id: "Q-003",
    field_path: "ai_persona.traits",
    priority: "P2",
    question_text: "Pick 3–5 personality traits (0–10 each).",
    examples: [
      "Direct 9, Friendly 6, Formal 3",
      "Creative 8, Analytical 7, Risk-averse 2",
      "High-urgency 9, Detail 8",
      "Minimalist 7, Playful 4",
    ],
    input_type: "text",
    module: "ai_persona",
  },
  {
    id: "Q-004",
    field_path: "ai_persona.writing_style",
    priority: "P2",
    question_text: "Default writing settings?",
    examples: ["Short sentences, punchy", "Premium/Apple clean", "Emojis: 0", "Emojis: 2–3 max", "Always include CTA"],
    input_type: "text",
    module: "ai_persona",
  },
  {
    id: "Q-005",
    field_path: "bootstrap.agency_name",
    priority: "P0",
    question_text: "Legal / brand name?",
    examples: ["Bootstrap Agency", "Apex Social", "GrowthFoundry", "Nimbus Media", "Studio K"],
    input_type: "text",
    module: "bootstrap",
  },
  {
    id: "Q-006",
    field_path: "bootstrap.links",
    priority: "P1",
    question_text: "Your site + main socials.",
    examples: ["website + Instagram", "LinkedIn company page", "YouTube channel", "TikTok", "Portfolio link"],
    input_type: "list",
    module: "bootstrap",
  },
  {
    id: "Q-007",
    field_path: "bootstrap.locale",
    priority: "P0",
    question_text: "Timezone + primary languages used with clients.",
    examples: ["Europe/Athens, English", "Europe/Nicosia, Greek+English", "UK, English", "UAE, Arabic+English"],
    input_type: "tz_lang",
    module: "bootstrap",
  },
  {
    id: "Q-008",
    field_path: "bootstrap.team_size",
    priority: "P0",
    question_text: "How many total team members (incl. founders)?",
    examples: ["1", "3", "7", "12", "25"],
    input_type: "numeric",
    module: "bootstrap",
  },
  {
    id: "Q-009",
    field_path: "bootstrap.team_roles",
    priority: "P1",
    question_text: "Count by role (numbers).",
    examples: ["1 strategist, 2 editors, 1 AM", "2 founders, 3 creators, 1 ads", "1 sales, 1 ops, 4 content", "0 AMs (founder does AM)"],
    input_type: "list",
    module: "bootstrap",
  },
  {
    id: "Q-010",
    field_path: "bootstrap.active_clients",
    priority: "P0",
    question_text: "How many paying clients right now?",
    examples: ["0", "3", "8", "20", "60"],
    input_type: "numeric",
    module: "bootstrap",
  },
  {
    id: "Q-011",
    field_path: "bootstrap.client_types",
    priority: "P1",
    question_text: "% split (must sum to 100).",
    examples: ["SMB 80 / Mid 20 / Ent 0", "Local 60 / Online 40", "B2B 70 / B2C 30", "Ecommerce 50 / Services 50"],
    input_type: "percent",
    module: "bootstrap",
  },
  {
    id: "Q-012",
    field_path: "bootstrap.target_industries",
    priority: "P0",
    question_text: "Which industries do you serve most? (max 5)",
    examples: ["Gyms + fitness studios", "Dentists + clinics", "Real estate", "SaaS B2B", "Restaurants"],
    input_type: "list",
    module: "bootstrap",
  },
  {
    id: "Q-013",
    field_path: "positioning.icp_best",
    priority: "P0",
    question_text: "Describe your best client in 1–2 lines.",
    examples: [
      "Local gym owner, 10–30 members/month, needs leads",
      "B2B SaaS, $20k–$100k MRR, wants LinkedIn demand gen",
      "Clinic with 2–5 doctors, wants bookings",
    ],
    input_type: "text",
    module: "positioning",
  },
  {
    id: "Q-014",
    field_path: "positioning.icp_worst",
    priority: "P1",
    question_text: "Who should you avoid?",
    examples: ["Price shoppers under €300/mo", "No decision maker access", "No assets + no budget", "Toxic approval cycles"],
    input_type: "text",
    module: "positioning",
  },
  {
    id: "Q-015",
    field_path: "positioning.differentiators",
    priority: "P0",
    question_text: "Why do clients choose you vs others? (3–7 bullets)",
    examples: ["48h content turnaround", "Founder-led strategy", "UGC creator network", "Performance-first creatives", "Niche expertise: dentists"],
    input_type: "list",
    module: "positioning",
  },
  {
    id: "Q-016",
    field_path: "positioning.proof",
    priority: "P1",
    question_text: "Top proof you can share (numbers).",
    examples: ["+120% leads in 60 days", "3.2M views/month", "ROAS 4.1x", "Booked out for 6 weeks", "Case study links"],
    input_type: "list",
    module: "positioning",
  },
  {
    id: "Q-017",
    field_path: "positioning.competitors",
    priority: "P2",
    question_text: "3 agencies you admire (for benchmarking).",
    examples: ["Agency A", "Agency B", "Local competitor name"],
    input_type: "list",
    module: "positioning",
  },
  {
    id: "Q-018",
    field_path: "bootstrap.services",
    priority: "P0",
    question_text: "What do you deliver? (multi-select)",
    examples: ["Social media management", "Content production (reels/shorts)", "Paid ads", "Email/SMS", "SEO/content blog"],
    input_type: "list",
    module: "bootstrap",
  },
  {
    id: "Q-019",
    field_path: "offer_stack.core_offer_high_margin",
    priority: "P0",
    question_text: "Which offer has best margins and why?",
    examples: ["Content-only retainer (low labor)", "Strategy + templates", "Ads management (percentage)", "UGC packages"],
    input_type: "text",
    module: "offer_stack",
  },
  {
    id: "Q-020",
    field_path: "offer_stack.core_offers",
    priority: "P0",
    question_text: "List 1–5 packaged offers (name + outcome).",
    examples: [
      "Lead Engine: 40 leads/month target",
      "Content Machine: 20 reels/month",
      "LinkedIn Authority: 12 posts/month + DM scripts",
      "Full Funnel: ads + landing + CRM",
    ],
    input_type: "list",
    module: "offer_stack",
  },
  {
    id: "Q-021",
    field_path: "offer_stack.pricing_model",
    priority: "P0",
    question_text: "How do you price?",
    examples: ["Fixed retainer", "Tiered packages (Starter/Growth/Scale)", "Performance-based", "Hybrid (base + bonus)", "Project-based"],
    input_type: "text",
    module: "offer_stack",
  },
  {
    id: "Q-022",
    field_path: "offer_stack.price_ranges",
    priority: "P1",
    question_text: "Typical € per month per tier.",
    examples: ["€500 / €1000 / €2000", "€1500–€3000", "€300 setup + €900/mo", "€0 trial then €1200/mo"],
    input_type: "text",
    module: "offer_stack",
  },
  {
    id: "Q-023",
    field_path: "offer_stack.add_ons",
    priority: "P1",
    question_text: "What can clients upgrade?",
    examples: ["Extra 10 reels", "Extra platform", "Extra ad creatives", "Extra community management", "Monthly photo shoot"],
    input_type: "list",
    module: "offer_stack",
  },
  {
    id: "Q-024",
    field_path: "offer_stack.guarantees",
    priority: "P1",
    question_text: "Any guarantee wording you use?",
    examples: ["No guarantee of results; we guarantee outputs", "Cancel anytime with 14 days notice", "Minimum 90 days", "Refund only if outputs missed"],
    input_type: "list",
    module: "offer_stack",
  },
  {
    id: "Q-025",
    field_path: "operations.content_pillars",
    priority: "P1",
    question_text: "Your key content pillars (3–6).",
    examples: ["Education", "Authority", "Behind the scenes", "Case studies", "Offers"],
    input_type: "list",
    module: "operations",
  },
  {
    id: "Q-026",
    field_path: "rep_policy.boundaries",
    priority: "P1",
    question_text: "Disallowed claims / topics (compliance boundaries).",
    examples: ["No legal, medical, or financial advice", "No guarantees of results", "Avoid sensitive personal data", "Escalate compliance topics to a human"],
    input_type: "list",
    module: "rep_policy",
  },
  {
    id: "Q-027",
    field_path: "operations.approvals",
    priority: "P1",
    question_text: "Approval workflow (who signs off, how fast).",
    examples: ["Founder approves within 24h", "Client approves in 48h", "No approval for routine posts", "Approval required for paid ads"],
    input_type: "text",
    module: "operations",
  },
  {
    id: "Q-028",
    field_path: "operations.turnaround_sla",
    priority: "P1",
    question_text: "Typical turnaround expectations.",
    examples: ["Drafts in 48h", "Edits within 24h", "Monthly plan by the 25th", "Urgent requests within 6h"],
    input_type: "text",
    module: "operations",
  },
  {
    id: "Q-029",
    field_path: "operations.reporting_cadence",
    priority: "P1",
    question_text: "Reporting cadence and format.",
    examples: ["Weekly email summary", "Monthly dashboard review", "Bi-weekly call + PDF", "Quarterly strategy review"],
    input_type: "text",
    module: "operations",
  },
  {
    id: "Q-030",
    field_path: "operations.tools_stack",
    priority: "P1",
    question_text: "Tools stack you use (content, PM, analytics).",
    examples: ["Notion, Slack, Google Drive", "ClickUp, Figma, Meta Ads", "Trello, Canva, GA4", "HubSpot, Airtable"],
    input_type: "list",
    module: "operations",
  },
  {
    id: "Q-031",
    field_path: "operations.platforms",
    priority: "P1",
    question_text: "Primary platforms you manage.",
    examples: ["Instagram, TikTok", "LinkedIn, X", "YouTube, Shorts", "Facebook, Instagram"],
    input_type: "list",
    module: "operations",
  },
  {
    id: "Q-032",
    field_path: "operations.required_assets",
    priority: "P1",
    question_text: "Required assets from clients to start.",
    examples: ["Brand guidelines", "Logo + fonts", "Product photos", "Offer details + pricing", "Access to ad account"],
    input_type: "list",
    module: "operations",
  },
];

export const REQUIRED_P0 = QUESTION_BANK.filter((q) => q.priority === "P0");

export function splitFieldPath(fieldPath: string) {
  const [module, ...rest] = fieldPath.split(".");
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

export function getNextQuestion(
  snapshot: Record<string, unknown>,
  skipped: Record<string, boolean>
) {
  for (const question of QUESTION_BANK) {
    if (question.priority !== "P0") continue;
    if (!isAnswered(snapshot, question.field_path)) return question;
  }

  for (const question of QUESTION_BANK) {
    if (question.priority === "P0") continue;
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
