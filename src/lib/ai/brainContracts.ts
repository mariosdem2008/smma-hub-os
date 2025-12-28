// Re-export new brain document types for convenience
export * from "./brainModules";
export * from "./brainDocuments";

/**
 * Calibration State for idempotent setup flow (Phase 3)
 *
 * Server-side tracking of calibration progress to prevent
 * duplicate questions and ensure exactly-once semantics.
 */
export interface CalibrationState {
  /** Unique session identifier for this calibration run */
  session_id: string;
  /** Current step/question key being asked (null if complete) */
  current_step: string | null;
  /** Array of question keys that have been answered */
  answered_keys: string[];
  /** ID of the last question asked */
  last_question_id: string | null;
  /** Hash of the last question for deduplication */
  last_question_hash: string | null;
  /** Timestamp when calibration was completed (null if in progress) */
  completed_at: string | null;
}

/**
 * Default empty calibration state
 */
export const EMPTY_CALIBRATION_STATE: CalibrationState = {
  session_id: "",
  current_step: null,
  answered_keys: [],
  last_question_id: null,
  last_question_hash: null,
  completed_at: null,
};

/**
 * Check if calibration is complete
 */
export function isCalibrationComplete(state: CalibrationState): boolean {
  return state.completed_at !== null;
}

/**
 * Check if a question has already been answered
 */
export function isQuestionAnswered(
  state: CalibrationState,
  questionKey: string
): boolean {
  return state.answered_keys.includes(questionKey);
}

/**
 * Legacy AgencyBrain type (kept for backward compatibility)
 * @deprecated Use modular BrainDocument types instead
 */
export type AgencyBrain = {
  identity: {
    name: string;
    niches: string[];
    offers: string[];
    geo: string[];
    languages: string[];
  };
  icp: {
    industries: string[];
    size: string[];
    personas: string[];
    pains: string[];
    objections: string[];
  };
  voice_tone: {
    adjectives: string[];
    banned_words: string[];
    preferred_vocab: string[];
    writing_rules: string[];
  };
  strategy_defaults: {
    pillars: string[];
    hook_styles: string[];
    cta_styles: string[];
    platform_formats: string[];
  };
  safety_policy: {
    allowed: string[];
    avoid: string[];
    compliance_notes: string[];
  };
  process_rules: {
    revisions: string;
    approvals: string;
    escalation_rules: string;
  };
  faq: Array<{ question: string; answer: string }>;
  gold_examples: string[];
  raw_responses: Record<string, unknown>;
  followup_responses: Record<string, unknown>;
  inference_metadata: {
    source: string;
    generated_at: string;
  };
};

export type ClientBrain = {
  brand_basics: {
    name: string;
    website: string;
    socials: string[];
    tone: string;
    differentiators: string[];
  };
  offer_details: {
    products_services: string[];
    pricing_optional: string;
    usps: string[];
  };
  audience: {
    demographics: string[];
    location: string[];
    intent: string[];
    problems: string[];
    objections: string[];
  };
  competitors: string[];
  constraints: {
    banned_claims: string[];
    legal_constraints: string[];
    taboo_topics: string[];
    dos: string[];
    donts: string[];
  };
  pillars: Array<{ name: string; examples: string[] }>;
  faq: Array<{ question: string; answer: string }>;
  assets_links: {
    key_urls: string[];
    guidelines_link: string;
    lead_magnet_optional: string;
  };
  goals: string[];
  metrics: string[];
  timeline: string;
  approvals: string;
  contacts: string[];
  raw_responses: Record<string, unknown>;
  followup_responses: Record<string, unknown>;
  inference_metadata: {
    source: string;
    generated_at: string;
  };
};

export const AGENCY_BRAIN_TEMPLATE: AgencyBrain = {
  identity: { name: "", niches: [], offers: [], geo: [], languages: [] },
  icp: { industries: [], size: [], personas: [], pains: [], objections: [] },
  voice_tone: { adjectives: [], banned_words: [], preferred_vocab: [], writing_rules: [] },
  strategy_defaults: { pillars: [], hook_styles: [], cta_styles: [], platform_formats: [] },
  safety_policy: { allowed: [], avoid: [], compliance_notes: [] },
  process_rules: { revisions: "", approvals: "", escalation_rules: "" },
  faq: [],
  gold_examples: [],
  raw_responses: {},
  followup_responses: {},
  inference_metadata: { source: "onboarding_v2", generated_at: "" },
};

export const CLIENT_BRAIN_TEMPLATE: ClientBrain = {
  brand_basics: { name: "", website: "", socials: [], tone: "", differentiators: [] },
  offer_details: { products_services: [], pricing_optional: "", usps: [] },
  audience: { demographics: [], location: [], intent: [], problems: [], objections: [] },
  competitors: [],
  constraints: { banned_claims: [], legal_constraints: [], taboo_topics: [], dos: [], donts: [] },
  pillars: [],
  faq: [],
  assets_links: { key_urls: [], guidelines_link: "", lead_magnet_optional: "" },
  goals: [],
  metrics: [],
  timeline: "",
  approvals: "",
  contacts: [],
  raw_responses: {},
  followup_responses: {},
  inference_metadata: { source: "onboarding_v2", generated_at: "" },
};

export const CLIENT_BRAIN_REQUIRED_FIELDS = [
  "brand_basics.name",
  "offer_details.products_services",
  "audience.problems",
  "pillars",
  "goals",
] as const;

export const CLIENT_BRAIN_REQUIRED_GROUPS = [
  {
    key: "constraints.banned_claims_or_taboo_topics",
    paths: ["constraints.banned_claims", "constraints.taboo_topics"],
  },
] as const;
