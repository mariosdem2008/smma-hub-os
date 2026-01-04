// ============================================================================
// Client Onboarding V4 TypeScript Types
// ============================================================================

/**
 * Provenance tracking for answer sources
 */
export type AnswerProvenance =
  | 'user_selected'   // User clicked AI chip
  | 'user_typed'      // User entered custom text
  | 'ai_assumed'      // User clicked "Not sure"
  | 'ai_scanned'      // Auto-filled from website scan
  | 'ai_prefilled';   // User clicked "Accept All" on scan

/**
 * Flow types for onboarding
 */
export type OnboardingFlowType =
  | 'agency_led'         // Full 18 questions
  | 'client_self_serve'  // Q1-Q12 subset
  | 'agency_completion'; // Agency completes Q13-Q18

/**
 * Market scope options
 */
export type MarketScope = 'local' | 'national' | 'international';

/**
 * Offer type options
 */
export type OfferType = 'service' | 'product' | 'subscription' | 'app' | 'other';

/**
 * Business model options
 */
export type BusinessModel = 'b2b' | 'b2c' | 'both';

/**
 * Sales cycle options
 */
export type SalesCycle = 'same_day' | '1_7_days' | '1_4_weeks' | '1_3_months' | '3_plus_months';

/**
 * Proof level options
 */
export type ProofLevel = 'none' | 'some' | 'strong';

/**
 * Primary channel goal options
 */
export type ChannelGoal = 'discovery' | 'trust' | 'leads' | 'community' | 'sales';

/**
 * Enabled channel options
 */
export type SocialChannel =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'youtube_shorts'
  | 'linkedin'
  | 'facebook'
  | 'google_business_profile'
  | 'pinterest'
  | 'x';

/**
 * CTA options
 */
export type CTAOption = 'book_call' | 'dm_keyword' | 'buy_now' | 'visit_store' | 'other';

/**
 * SMMA onboarding fields
 */
export type IndustryNiche =
  | 'restaurant_cafe'
  | 'gym_fitness_studio'
  | 'beauty_salon_barber'
  | 'clinic_medical'
  | 'real_estate'
  | 'education_tutors'
  | 'home_services'
  | 'ecommerce_dtc'
  | 'b2b_service'
  | 'saas_tech'
  | 'other';

export type PrimaryGoal =
  | 'more_bookings'
  | 'more_leads'
  | 'more_dms'
  | 'more_online_sales'
  | 'more_foot_traffic'
  | 'more_trust';

export type ConversionPath =
  | 'book_call'
  | 'book_appointment'
  | 'dm_keyword'
  | 'whatsapp'
  | 'website_checkout'
  | 'visit_store';

export type OfferSlot =
  | 'best_seller'
  | 'starter_offer'
  | 'premium_offer'
  | 'bundle_package'
  | 'membership_subscription'
  | 'seasonal_promo'
  | 'other';

export type OfferPromise =
  | 'fast'
  | 'premium'
  | 'affordable'
  | 'guaranteed'
  | 'personalized'
  | 'luxury'
  | 'results_focused'
  | 'other';

export interface OnboardingOffer {
  type: OfferSlot;
  name: string;
  price_min?: number | null;
  price_max?: number | null;
  promise?: OfferPromise | string | null;
}

export type AudienceType = 'local_consumers' | 'ecommerce_consumers' | 'b2b_decision_makers' | 'mixed';

export type MainObjection =
  | 'price_too_high'
  | 'not_sure_it_works'
  | 'no_time'
  | 'tried_before'
  | 'dont_trust_online'
  | 'needs_partner_approval'
  | 'other';

export type BrandVoice =
  | 'professional'
  | 'friendly'
  | 'luxury'
  | 'bold'
  | 'playful'
  | 'educational'
  | 'clinical'
  | 'direct'
  | 'witty';

export type ContentStyle =
  | 'founder_led'
  | 'educational_tips'
  | 'before_after'
  | 'social_proof'
  | 'trend_based'
  | 'storytelling';

export type OnCameraAvailability = 'owner' | 'team' | 'faceless' | 'not_sure';

export type AssetAvailability =
  | 'brand_kit'
  | 'photos'
  | 'videos'
  | 'testimonials'
  | 'case_studies'
  | 'menu_price_list'
  | 'product_catalog';

export type ProofType =
  | 'reviews'
  | 'testimonials'
  | 'before_after'
  | 'results_numbers'
  | 'press_features'
  | 'none';

export type CadencePreset = 'light' | 'standard' | 'aggressive' | 'custom';

export type ResponseHandling = 'owner' | 'team' | 'agency' | 'nobody_yet';

/**
 * Competitor entry
 */
export interface Competitor {
  name: string;
  handle?: string;
  url?: string;
}

/**
 * Proof point entry
 */
export interface ProofPoint {
  claim: string;
  evidence: string;
  confidence: 1 | 2 | 3 | 4 | 5;
}

/**
 * Cadence per platform
 */
export type CadenceMap = Partial<Record<SocialChannel, number>>;

/**
 * AI Scan result structure
 */
export interface AIScanResult {
  extracted: {
    niche?: string;
    business_model?: BusinessModel;
    audience?: string[];
    competitors?: Competitor[];
    offers?: string[];
    differentiators?: string[];
    pain_points?: string[];
    cta?: string;
  };
  confidence: number;
  source_urls: string[];
  cached_at: string;
}

/**
 * V5 scan result structure
 */
export interface V5ScanResult {
  industry_niche?: IndustryNiche;
  offer_ideas?: string[];
  primary_customer?: string[];
  pain_points?: string[];
  proof_cues?: string[];
  recommended_platforms?: SocialChannel[];
  conversion_path?: ConversionPath;
  offer_name?: string;
  primary_cta?: string;
  icp_suggestions?: string[];
  differentiators?: string[];
  confidence?: number;
  source_urls?: string[];
}

/**
 * V5 onboarding metadata
 */
export type OnboardingV5Mode = 'quick' | 'deep';

export interface OnboardingV5Meta {
  mode?: OnboardingV5Mode;
  progress?: {
    active_section?: string;
    completed_sections?: string[];
    percent_complete?: number;
    updated_at?: string;
  };
  icp_secondary?: string;
  last_scan?: {
    timestamp?: string;
    scanned_at?: string;
    confidence?: number;
    applied_fields_count?: number;
  };
}

/**
 * Blocker entry for readiness tracking
 */
export interface OnboardingBlocker {
  field: string;
  message: string;
}

/**
 * Main onboarding profile interface
 */
export interface OnboardingProfile {
  id: string;
  client_id: string;
  agency_id: string;

  // Flow tracking
  flow_type: OnboardingFlowType;
  current_step: number;
  completed_at: string | null;

  // Section A: Business + Offer (Q1-Q6)
  q1_business_name: string | null;
  q1_provenance: AnswerProvenance | null;

  q2_website: string | null;
  q2_social_links: string[] | null;
  q2_provenance: AnswerProvenance | null;

  q3_market_scope: MarketScope | null;
  q3_country: string | null;
  q3_city: string | null;
  q3_provenance: AnswerProvenance | null;

  q4_languages: string[] | null;
  q4_provenance: AnswerProvenance | null;

  q5_offer_type: OfferType | null;
  q5_provenance: AnswerProvenance | null;

  q6_offer_name: string | null;
  q6_price_min: number | null;
  q6_price_max: number | null;
  q6_main_cta: string | null;
  q6_provenance: AnswerProvenance | null;

  // Section B: Ideal Customer + Outcome (Q7-Q11)
  q7_business_model: BusinessModel | null;
  q7_provenance: AnswerProvenance | null;

  q8_ideal_customer: string | null;
  q8_provenance: AnswerProvenance | null;

  q9_pain_points: string[] | null;
  q9_provenance: AnswerProvenance | null;

  q10_desired_outcome: string | null;
  q10_provenance: AnswerProvenance | null;

  q11_sales_cycle: SalesCycle | null;
  q11_provenance: AnswerProvenance | null;

  // Section C: Differentiation + Proof (Q12-Q15)
  q12_competitors: Competitor[] | null;
  q12_provenance: AnswerProvenance | null;

  q13_differentiators: string[] | null;
  q13_provenance: AnswerProvenance | null;

  q14_proof_level: ProofLevel | null;
  q14_provenance: AnswerProvenance | null;

  q15_proof_points: ProofPoint[] | null;
  q15_provenance: AnswerProvenance | null;

  // Section D: Channels + Cadence (Q16-Q18)
  q16_enabled_channels: SocialChannel[] | null;
  q16_provenance: AnswerProvenance | null;

  q17_primary_goal: ChannelGoal | null;
  q17_provenance: AnswerProvenance | null;

  q18_cadence: CadenceMap | null;
  q18_provenance: AnswerProvenance | null;

  // ========================================================================
  // SMMA-specific fields
  // ========================================================================
  industry_niche: IndustryNiche | null;
  primary_goal: PrimaryGoal | null;
  conversion_path: ConversionPath | null;
  conversion_link: string | null;
  offers: OnboardingOffer[] | null;
  audience_type: AudienceType | null;
  primary_customer: string | null;
  main_objection: MainObjection | null;
  brand_voice: BrandVoice[] | null;
  content_style: ContentStyle[] | null;
  on_camera_availability: OnCameraAvailability | null;
  available_assets: AssetAvailability[] | null;
  proof_types: ProofType[] | null;
  competitor_link: string | null;
  platforms: SocialChannel[] | null;
  formats: string[] | null;
  cadence_preset: CadencePreset | null;
  cadence_per_platform: CadenceMap | null;
  response_handling: ResponseHandling | null;

  // AI Scan
  ai_scan_result: AIScanResult | null;
  ai_scan_at: string | null;
  ai_scan_accepted: boolean;

  // Readiness
  readiness_score: number;
  blockers: OnboardingBlocker[];

  // Metadata
  v5_meta: OnboardingV5Meta | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Partial profile for updates
 */
export type OnboardingProfileUpdate = Partial<Omit<OnboardingProfile, 'id' | 'client_id' | 'agency_id' | 'created_at' | 'created_by'>>;

/**
 * Profile status response from RPC
 */
export interface OnboardingProfileStatus {
  exists: boolean;
  completed: boolean;
  flow_type: OnboardingFlowType | null;
  current_step: number;
  readiness_score: number;
  blockers: OnboardingBlocker[];
  completed_at: string | null;
  assumption_count: number;
  ai_scan_accepted: boolean;
}

/**
 * Step configuration
 */
export interface OnboardingStepConfig {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  section: 'A' | 'B' | 'C' | 'D' | 'scan' | 'review';
  inputType: 'text' | 'url' | 'single_select' | 'multi_select' | 'chips' | 'table' | 'slider' | 'compound';
  aiSuggestions: boolean;
  isHardBlocker: boolean;
  validation: StepValidation;
  clientFlowIncluded: boolean; // Whether this step is in the client self-serve flow
}

/**
 * Step validation rules
 */
export interface StepValidation {
  required: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  pattern?: RegExp;
  custom?: (value: unknown, profile: Partial<OnboardingProfile>) => string | null;
}

/**
 * AI suggestion for a step
 */
export interface AISuggestion {
  id: string;
  label: string;
  confidence: number;
}

/**
 * AI suggestion response
 */
export interface AISuggestionResponse {
  suggestions: AISuggestion[];
  fallback_enabled: boolean;
}

/**
 * Readiness score breakdown
 */
export interface ReadinessBreakdown {
  score: number;
  maxScore: number;
  percentage: number;
  hardBlockersCleared: boolean;
  assumptionCount: number;
  assumptionPenalty: number;
  sectionScores: {
    A: { score: number; max: number };
    B: { score: number; max: number };
    C: { score: number; max: number };
    D: { score: number; max: number };
  };
}

// ============================================================================
// Step Definitions
// ============================================================================

/**
 * All onboarding steps in order
 */
export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  // Q1: Business Name
  {
    id: 'q1_business_name',
    stepNumber: 1,
    title: "What's the business name?",
    description: 'Enter the official business or brand name',
    section: 'A',
    inputType: 'text',
    aiSuggestions: false,
    isHardBlocker: false,
    validation: { required: true, minLength: 2 },
    clientFlowIncluded: true,
  },
  // Q2: Website + Socials
  {
    id: 'q2_website_socials',
    stepNumber: 2,
    title: 'Enter the website and top social profiles',
    description: 'Website is required, social profiles are optional',
    section: 'A',
    inputType: 'compound',
    aiSuggestions: false,
    isHardBlocker: false,
    validation: { required: true },
    clientFlowIncluded: true,
  },
  // AI Scan
  {
    id: 'ai_scan',
    stepNumber: 3,
    title: "We scanned the business - here's what we found",
    description: 'Review and accept or edit the AI-extracted information',
    section: 'scan',
    inputType: 'compound',
    aiSuggestions: true,
    isHardBlocker: false,
    validation: { required: false },
    clientFlowIncluded: true,
  },
  // Q3: Market Scope
  {
    id: 'q3_market_scope',
    stepNumber: 4,
    title: "What's the market scope?",
    description: 'Define the geographic reach of the business',
    section: 'A',
    inputType: 'single_select',
    aiSuggestions: false,
    isHardBlocker: false,
    validation: { required: true },
    clientFlowIncluded: true,
  },
  // Q4: Languages
  {
    id: 'q4_languages',
    stepNumber: 5,
    title: 'What language(s) should content be in?',
    description: 'Select all languages for content creation',
    section: 'A',
    inputType: 'chips',
    aiSuggestions: false,
    isHardBlocker: false,
    validation: { required: true, min: 1 },
    clientFlowIncluded: true,
  },
  // Q5: Offer Type
  {
    id: 'q5_offer_type',
    stepNumber: 6,
    title: 'What type of offer is this?',
    description: 'Select the primary offer category',
    section: 'A',
    inputType: 'single_select',
    aiSuggestions: false,
    isHardBlocker: false,
    validation: { required: true },
    clientFlowIncluded: true,
  },
  // Q6: Offer Details
  {
    id: 'q6_offer_details',
    stepNumber: 7,
    title: 'Tell us about the main offer',
    description: 'Provide offer name, price range, and call-to-action',
    section: 'A',
    inputType: 'compound',
    aiSuggestions: false,
    isHardBlocker: true, // offer_name and main_cta are hard blockers
    validation: { required: true },
    clientFlowIncluded: true,
  },
  // Q7: Business Model
  {
    id: 'q7_business_model',
    stepNumber: 8,
    title: 'Who does this business sell to?',
    description: 'Select the primary customer type',
    section: 'B',
    inputType: 'single_select',
    aiSuggestions: false,
    isHardBlocker: false,
    validation: { required: true },
    clientFlowIncluded: true,
  },
  // Q8: Ideal Customer
  {
    id: 'q8_ideal_customer',
    stepNumber: 9,
    title: 'Who is the ideal customer?',
    description: 'Select or describe the target customer persona',
    section: 'B',
    inputType: 'chips',
    aiSuggestions: true,
    isHardBlocker: true,
    validation: { required: true },
    clientFlowIncluded: true,
  },
  // Q9: Pain Points
  {
    id: 'q9_pain_points',
    stepNumber: 10,
    title: 'What are the top pain points?',
    description: 'Select exactly 3 pain points the customer faces',
    section: 'B',
    inputType: 'chips',
    aiSuggestions: true,
    isHardBlocker: false,
    validation: { required: true, min: 3, max: 3 },
    clientFlowIncluded: true,
  },
  // Q10: Desired Outcome
  {
    id: 'q10_desired_outcome',
    stepNumber: 11,
    title: "What's the #1 outcome customers want?",
    description: 'Select the primary transformation or result',
    section: 'B',
    inputType: 'chips',
    aiSuggestions: true,
    isHardBlocker: true,
    validation: { required: true },
    clientFlowIncluded: true,
  },
  // Q11: Sales Cycle
  {
    id: 'q11_sales_cycle',
    stepNumber: 12,
    title: 'How long is the typical sales cycle?',
    description: 'Estimate the time from first contact to purchase',
    section: 'B',
    inputType: 'single_select',
    aiSuggestions: false,
    isHardBlocker: false,
    validation: { required: true },
    clientFlowIncluded: true,
  },
  // Q12: Competitors
  {
    id: 'q12_competitors',
    stepNumber: 13,
    title: 'Who are the main competitors?',
    description: 'List up to 3 key competitors or alternatives',
    section: 'C',
    inputType: 'compound',
    aiSuggestions: true,
    isHardBlocker: false,
    validation: { required: false, max: 3 },
    clientFlowIncluded: true, // Last step in client flow
  },
  // Q13: Differentiators (Agency only from here)
  {
    id: 'q13_differentiators',
    stepNumber: 14,
    title: 'What makes this business different?',
    description: 'Select 2-4 key competitive advantages',
    section: 'C',
    inputType: 'chips',
    aiSuggestions: true,
    isHardBlocker: false,
    validation: { required: true, min: 2, max: 4 },
    clientFlowIncluded: false,
  },
  // Q14: Proof Level
  {
    id: 'q14_proof_level',
    stepNumber: 15,
    title: 'How much proof/evidence is available?',
    description: 'Rate the availability of testimonials, case studies, data',
    section: 'C',
    inputType: 'single_select',
    aiSuggestions: false,
    isHardBlocker: false,
    validation: { required: true },
    clientFlowIncluded: false,
  },
  // Q15: Proof Points
  {
    id: 'q15_proof_points',
    stepNumber: 16,
    title: 'Add proof points for claims',
    description: 'Document evidence for marketing claims',
    section: 'C',
    inputType: 'table',
    aiSuggestions: false,
    isHardBlocker: false,
    validation: { required: false }, // Min rows based on Q14
    clientFlowIncluded: false,
  },
  // Q16: Enabled Channels
  {
    id: 'q16_enabled_channels',
    stepNumber: 17,
    title: 'Which social platforms will be active?',
    description: 'Select all platforms for content distribution',
    section: 'D',
    inputType: 'chips',
    aiSuggestions: false,
    isHardBlocker: true,
    validation: { required: true, min: 1 },
    clientFlowIncluded: false,
  },
  // Q17: Primary Goal
  {
    id: 'q17_primary_goal',
    stepNumber: 18,
    title: "What's the primary goal for social content?",
    description: 'Define the main objective across all channels',
    section: 'D',
    inputType: 'single_select',
    aiSuggestions: false,
    isHardBlocker: false,
    validation: { required: true },
    clientFlowIncluded: false,
  },
  // Q18: Cadence
  {
    id: 'q18_cadence',
    stepNumber: 19,
    title: 'How often should we post per platform?',
    description: 'Set posting frequency for each enabled channel',
    section: 'D',
    inputType: 'slider',
    aiSuggestions: false,
    isHardBlocker: true, // Each enabled channel must have cadence > 0
    validation: { required: true },
    clientFlowIncluded: false,
  },
  // Review
  {
    id: 'review',
    stepNumber: 20,
    title: 'Review & Generate Strategy',
    description: 'Review all answers and generate your strategy',
    section: 'review',
    inputType: 'compound',
    aiSuggestions: false,
    isHardBlocker: false,
    validation: { required: false },
    clientFlowIncluded: false, // Client sees partial review at step 14
  },
];

/**
 * Get steps for a specific flow type
 */
export function getStepsForFlow(flowType: OnboardingFlowType): OnboardingStepConfig[] {
  if (flowType === 'client_self_serve') {
    return ONBOARDING_STEPS.filter(step => step.clientFlowIncluded);
  }
  if (flowType === 'agency_completion') {
    return ONBOARDING_STEPS.filter(step => !step.clientFlowIncluded);
  }
  return ONBOARDING_STEPS;
}

/**
 * Get total step count for a flow type
 */
export function getTotalSteps(flowType: OnboardingFlowType): number {
  return getStepsForFlow(flowType).length;
}

/**
 * Get step by ID
 */
export function getStepById(stepId: string): OnboardingStepConfig | undefined {
  return ONBOARDING_STEPS.find(step => step.id === stepId);
}

/**
 * Get step by number for a flow type
 */
export function getStepByNumber(stepNumber: number, flowType: OnboardingFlowType): OnboardingStepConfig | undefined {
  const steps = getStepsForFlow(flowType);
  return steps[stepNumber - 1];
}

// ============================================================================
// Static Options
// ============================================================================

export const MARKET_SCOPE_OPTIONS = [
  { id: 'local', label: 'Local', description: 'City or regional focus' },
  { id: 'national', label: 'National', description: 'Country-wide reach' },
  { id: 'international', label: 'International', description: 'Multiple countries' },
] as const;

export const OFFER_TYPE_OPTIONS = [
  { id: 'service', label: 'Service', description: 'Professional or consulting services' },
  { id: 'product', label: 'Product', description: 'Physical or digital products' },
  { id: 'subscription', label: 'Subscription', description: 'Recurring membership or SaaS' },
  { id: 'app', label: 'App', description: 'Mobile or web application' },
  { id: 'other', label: 'Other', description: 'Something else' },
] as const;

export const BUSINESS_MODEL_OPTIONS = [
  { id: 'b2b', label: 'B2B', description: 'Selling to businesses' },
  { id: 'b2c', label: 'B2C', description: 'Selling to consumers' },
  { id: 'both', label: 'Both', description: 'Mixed B2B and B2C' },
] as const;

export const SALES_CYCLE_OPTIONS = [
  { id: 'same_day', label: 'Same day', description: 'Impulse or quick decisions' },
  { id: '1_7_days', label: '1-7 days', description: 'Short consideration period' },
  { id: '1_4_weeks', label: '1-4 weeks', description: 'Medium consideration' },
  { id: '1_3_months', label: '1-3 months', description: 'Long sales cycle' },
  { id: '3_plus_months', label: '3+ months', description: 'Enterprise or complex sales' },
] as const;

export const PROOF_LEVEL_OPTIONS = [
  { id: 'none', label: 'None', description: 'No testimonials or case studies yet', minRows: 0 },
  { id: 'some', label: 'Some', description: 'A few testimonials or results', minRows: 1 },
  { id: 'strong', label: 'Strong', description: 'Many case studies and data points', minRows: 3 },
] as const;

export const CHANNEL_GOAL_OPTIONS = [
  { id: 'discovery', label: 'Discovery', description: 'Increase brand awareness and reach' },
  { id: 'trust', label: 'Trust', description: 'Build credibility and authority' },
  { id: 'leads', label: 'Leads', description: 'Generate inquiries and signups' },
  { id: 'community', label: 'Community', description: 'Engage and grow audience' },
  { id: 'sales', label: 'Sales', description: 'Drive direct conversions' },
] as const;

// Alias for backward compatibility
export const PRIMARY_GOAL_OPTIONS = CHANNEL_GOAL_OPTIONS;

export const CHANNEL_OPTIONS = [
  { id: 'instagram', label: 'Instagram', icon: 'instagram' },
  { id: 'tiktok', label: 'TikTok', icon: 'tiktok' },
  { id: 'youtube', label: 'YouTube', icon: 'youtube' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', icon: 'youtube' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
  { id: 'facebook', label: 'Facebook', icon: 'facebook' },
  { id: 'google_business_profile', label: 'Google Business Profile', icon: 'google' },
  { id: 'pinterest', label: 'Pinterest', icon: 'pinterest' },
  { id: 'x', label: 'X', icon: 'x' },
] as const;

export const CTA_OPTIONS = [
  { id: 'book_call', label: 'Book a call', description: 'Schedule a consultation' },
  { id: 'dm_keyword', label: 'DM keyword', description: 'Send a message with a keyword' },
  { id: 'buy_now', label: 'Buy now', description: 'Direct purchase' },
  { id: 'visit_store', label: 'Visit store', description: 'Go to website or physical location' },
  { id: 'other', label: 'Other', description: 'Custom call-to-action' },
] as const;

export const INDUSTRY_NICHE_OPTIONS = [
  { id: 'restaurant_cafe', label: 'Restaurant / Cafe' },
  { id: 'gym_fitness_studio', label: 'Gym / Fitness studio' },
  { id: 'beauty_salon_barber', label: 'Beauty salon / Barber' },
  { id: 'clinic_medical', label: 'Clinic / Dentist / Medical' },
  { id: 'real_estate', label: 'Real estate' },
  { id: 'education_tutors', label: 'Education / Tutors' },
  { id: 'home_services', label: 'Home services (plumber, solar, etc.)' },
  { id: 'ecommerce_dtc', label: 'Ecommerce / DTC brand' },
  { id: 'b2b_service', label: 'B2B service (law, accounting, consulting)' },
  { id: 'saas_tech', label: 'SaaS / Tech' },
  { id: 'other', label: 'Other' },
] as const;

export const ONBOARDING_PRIMARY_GOAL_OPTIONS = [
  { id: 'more_bookings', label: 'More bookings/appointments' },
  { id: 'more_leads', label: 'More leads (forms/calls)' },
  { id: 'more_dms', label: 'More DMs' },
  { id: 'more_online_sales', label: 'More online sales' },
  { id: 'more_foot_traffic', label: 'More foot traffic' },
  { id: 'more_trust', label: 'More trust/authority' },
] as const;

export const CONVERSION_PATH_OPTIONS = [
  { id: 'book_call', label: 'Book a call' },
  { id: 'book_appointment', label: 'Book appointment' },
  { id: 'dm_keyword', label: 'DM keyword' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'website_checkout', label: 'Website checkout' },
  { id: 'visit_store', label: 'Visit store' },
] as const;

export const OFFER_SLOT_OPTIONS = [
  { id: 'best_seller', label: 'Best seller / signature service' },
  { id: 'starter_offer', label: 'Starter / entry offer' },
  { id: 'premium_offer', label: 'Premium / transformation offer' },
  { id: 'bundle_package', label: 'Bundle / package' },
  { id: 'membership_subscription', label: 'Membership / subscription' },
  { id: 'seasonal_promo', label: 'Seasonal promo' },
  { id: 'other', label: 'Other...' },
] as const;

export const OFFER_PROMISE_OPTIONS = [
  { id: 'fast', label: 'Fast' },
  { id: 'premium', label: 'Premium' },
  { id: 'affordable', label: 'Affordable' },
  { id: 'guaranteed', label: 'Guaranteed' },
  { id: 'personalized', label: 'Personalized' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'results_focused', label: 'Results-focused' },
  { id: 'other', label: 'Other...' },
] as const;

export const AUDIENCE_TYPE_OPTIONS = [
  { id: 'local_consumers', label: 'Local consumers' },
  { id: 'ecommerce_consumers', label: 'Ecommerce consumers' },
  { id: 'b2b_decision_makers', label: 'B2B decision makers' },
  { id: 'mixed', label: 'Mixed' },
] as const;

export const MAIN_OBJECTION_OPTIONS = [
  { id: 'price_too_high', label: 'Price too high' },
  { id: 'not_sure_it_works', label: 'Not sure it works' },
  { id: 'no_time', label: 'No time' },
  { id: 'tried_before', label: 'Tried before / skeptical' },
  { id: 'dont_trust_online', label: "Don't trust brands online" },
  { id: 'needs_partner_approval', label: 'Needs spouse/partner approval' },
  { id: 'other', label: 'Other' },
] as const;

export const SMMA_PAIN_POINT_OPTIONS = [
  { id: 'not_enough_customers', label: 'Not enough customers/leads' },
  { id: 'low_trust', label: 'Low trust / weak reputation' },
  { id: 'inconsistent_content', label: 'Inconsistent content' },
  { id: 'low_engagement', label: 'Low engagement' },
  { id: 'dont_stand_out', label: "Don't stand out locally" },
  { id: 'weak_offers', label: "Weak offers / promos don't convert" },
  { id: 'no_assets', label: 'No content assets (photos/video)' },
  { id: 'no_on_camera', label: 'No one wants to be on camera' },
  { id: 'slow_response', label: 'Slow response time to DMs/leads' },
  { id: 'bad_reviews', label: 'Bad reviews / not enough reviews' },
  { id: 'seasonal_drops', label: 'Seasonal demand drops' },
  { id: 'other', label: 'Other' },
] as const;

export const BRAND_VOICE_OPTIONS = [
  { id: 'professional', label: 'Professional' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'bold', label: 'Bold' },
  { id: 'playful', label: 'Playful' },
  { id: 'educational', label: 'Educational' },
  { id: 'clinical', label: 'Clinical' },
  { id: 'direct', label: 'Direct' },
  { id: 'witty', label: 'Witty' },
] as const;

export const CONTENT_STYLE_OPTIONS = [
  { id: 'founder_led', label: 'Founder/personality-led' },
  { id: 'educational_tips', label: 'Educational tips' },
  { id: 'before_after', label: 'Before/after' },
  { id: 'social_proof', label: 'Social proof-heavy' },
  { id: 'trend_based', label: 'Trend-based' },
  { id: 'storytelling', label: 'Storytelling' },
] as const;

export const ON_CAMERA_OPTIONS = [
  { id: 'owner', label: 'Yes (owner)' },
  { id: 'team', label: 'Yes (team)' },
  { id: 'faceless', label: 'No (faceless only)' },
  { id: 'not_sure', label: 'Not sure' },
] as const;

export const ASSET_OPTIONS = [
  { id: 'brand_kit', label: 'Logo/brand kit' },
  { id: 'photos', label: 'Photos' },
  { id: 'videos', label: 'Videos/B-roll' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'case_studies', label: 'Case studies' },
  { id: 'menu_price_list', label: 'Menu/price list' },
  { id: 'product_catalog', label: 'Product catalog' },
] as const;

export const PROOF_TYPE_OPTIONS = [
  { id: 'reviews', label: 'Reviews' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'before_after', label: 'Before/after' },
  { id: 'results_numbers', label: 'Results numbers' },
  { id: 'press_features', label: 'Press/features' },
  { id: 'none', label: 'None yet' },
] as const;

export const PLATFORM_OPTIONS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'google_business_profile', label: 'Google Business Profile' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'x', label: 'X' },
] as const;

export const FORMAT_OPTIONS = [
  { id: 'short_video', label: 'Short video' },
  { id: 'carousels', label: 'Carousels' },
  { id: 'static_posts', label: 'Static posts' },
  { id: 'stories', label: 'Stories' },
  { id: 'lives', label: 'Lives' },
] as const;

export const CADENCE_PRESET_OPTIONS = [
  { id: 'light', label: 'Light (3/wk)' },
  { id: 'standard', label: 'Standard (5/wk)' },
  { id: 'aggressive', label: 'Aggressive (7-10/wk)' },
  { id: 'custom', label: 'Custom' },
] as const;

export const RESPONSE_HANDLING_OPTIONS = [
  { id: 'owner', label: 'Owner' },
  { id: 'team', label: 'Team' },
  { id: 'agency', label: 'Agency' },
  { id: 'nobody_yet', label: 'Nobody yet' },
] as const;

export const LANGUAGE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'el', label: 'Greek' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'it', label: 'Italian' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'other', label: 'Other' },
] as const;
