export type SetupQuestion = {
  key: string;
  question_text: string;
  expects: "text" | "choice";
  target_path: string;
  examples?: string[];
  suggestions?: Array<{ id: string; label: string; user_message: string }>;
};

export const SETUP_QUESTIONS: SetupQuestion[] = [
  {
    key: "agency.primary_services",
    question_text: "What are your primary services? List 3-6.",
    expects: "text",
    target_path: "setup_profile_v1.agency.primary_services",
    examples: [
      "Social media management",
      "Content creation (Reels + Posts + Stories)",
      "Paid ads management (Meta / Google)",
      "Lead generation (DM / booking)",
      "UGC sourcing + editing",
    ],
    suggestions: [
      { id: "smm", label: "SMM (Monthly)", user_message: "Social media management (monthly retainer)." },
      { id: "content", label: "Content creation", user_message: "Content creation (Reels + Posts + Stories)." },
      { id: "ads", label: "Paid ads", user_message: "Paid ads management (Meta/Google)." },
    ],
  },
  {
    key: "agency.niche_industries",
    question_text: "Which niches/industries do you focus on? (1-3)",
    expects: "text",
    target_path: "setup_profile_v1.agency.niche_industries",
    examples: ["Real estate", "Ecommerce", "Coaches/consultants", "Local services"],
    suggestions: [
      { id: "local", label: "Local services", user_message: "Local service businesses." },
      { id: "ecom", label: "Ecommerce", user_message: "Ecommerce brands." },
      { id: "realestate", label: "Real estate", user_message: "Real estate agents and brokers." },
    ],
  },
  {
    key: "agency.target_client_profile",
    question_text: "Describe your ideal client size and budget range.",
    expects: "text",
    target_path: "setup_profile_v1.agency.target_client_profile",
    examples: ["$2k-$8k/mo local businesses with 2-10 locations", "VC-backed SaaS, $5k-$15k/mo"],
    suggestions: [
      { id: "small", label: "Small local", user_message: "Local businesses, $2k-$5k/mo, 1-3 locations." },
      { id: "mid", label: "Mid-market", user_message: "Mid-market brands, $5k-$12k/mo retainers." },
    ],
  },
  {
    key: "agency.core_offer_outcome",
    question_text: "In one sentence, what outcome do clients get from you?",
    expects: "text",
    target_path: "setup_profile_v1.agency.core_offer_outcome",
    examples: ["We generate consistent qualified leads via organic + paid social."],
  },
  {
    key: "agency.deliverables_standard",
    question_text: "What are your standard deliverables each month? (bullets)",
    expects: "text",
    target_path: "setup_profile_v1.agency.deliverables_standard",
    examples: ["12 posts, 8 short-form videos, monthly report", "2 ad creatives per week"],
  },
  {
    key: "agency.workflow_stages",
    question_text: "List your workflow stages from kickoff to delivery.",
    expects: "text",
    target_path: "setup_profile_v1.agency.workflow_stages",
    examples: ["Discovery → Strategy → Content → Approval → Publish → Report"],
  },
  {
    key: "agency.approvals_sla",
    question_text: "What is your typical approval + response SLA?",
    expects: "text",
    target_path: "setup_profile_v1.agency.approvals_sla",
    examples: ["24-48 hours for approval", "Same-day response for urgent items"],
  },
  {
    key: "brand.voice_adjectives",
    question_text: "Pick 3 adjectives that describe your brand voice.",
    expects: "text",
    target_path: "setup_profile_v1.brand.voice_adjectives",
    examples: ["Bold, direct, friendly", "Premium, calm, expert"],
    suggestions: [
      { id: "bold", label: "Bold / direct", user_message: "Bold, direct, confident." },
      { id: "friendly", label: "Friendly / warm", user_message: "Friendly, warm, helpful." },
      { id: "premium", label: "Premium / expert", user_message: "Premium, calm, expert." },
    ],
  },
  {
    key: "brand.dos_donts",
    question_text: "List brand do’s and don’ts for responses.",
    expects: "text",
    target_path: "setup_profile_v1.brand.dos_donts",
    examples: ["Do: be concise. Don't: make guarantees."],
  },
  {
    key: "ai.boundaries",
    question_text: "What can the AI decide vs what must it ask you?",
    expects: "text",
    target_path: "setup_profile_v1.ai.boundaries",
    examples: ["Can decide: content ideas. Must ask: pricing/guarantees."],
  },
  {
    key: "ai.escalation_rules",
    question_text: "When should the AI say UNKNOWN or escalate to a human?",
    expects: "text",
    target_path: "setup_profile_v1.ai.escalation_rules",
    examples: ["Escalate for legal, pricing, contract terms."],
  },
  {
    key: "faq.seed_top10",
    question_text: "List your top FAQs with short answers (5-10).",
    expects: "text",
    target_path: "faq_v1",
    examples: ["Q: What do you offer? A: Social media management + ads."],
  },
];

export function getQuestionByKey(key: string | null | undefined) {
  if (!key) return null;
  return SETUP_QUESTIONS.find((q) => q.key === key) ?? null;
}

export function getFirstQuestion() {
  return SETUP_QUESTIONS[0] ?? null;
}

export function getNextQuestion(answeredKeys: Set<string>) {
  return SETUP_QUESTIONS.find((q) => !answeredKeys.has(q.key)) ?? null;
}

export function getMissingKeys(answeredKeys: Set<string>) {
  return SETUP_QUESTIONS.filter((q) => !answeredKeys.has(q.key)).map((q) => q.key);
}

export function computeProgress(answeredKeys: Set<string>) {
  if (SETUP_QUESTIONS.length === 0) return 0;
  const ratio = answeredKeys.size / SETUP_QUESTIONS.length;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}
