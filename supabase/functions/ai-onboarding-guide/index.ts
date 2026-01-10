import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { ai } from "../../../src/ai/router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import {
  buildOnboardingAudiencePrompt,
  buildOnboardingDifferentiatorsPrompt,
  buildOnboardingOffersPrompt,
} from "../../../src/ai/prompts/onboardingGuide.ts";

const FN_VERSION = "1.0.0";

type InputType = "single_select" | "multi_select" | "chips" | "short_text" | "url" | "contact_card" | "textarea";

interface Option {
  id: string;
  label: string;
  hint?: string;
}

interface Constraints {
  required: boolean;
  min?: number;
  max?: number;
  pattern?: string;
}

interface StepSpec {
  step_id: string;
  assistant_message: string;
  input_type: InputType;
  options?: Option[];
  constraints?: Constraints;
  validation_errors?: string[];
  recap_so_far?: string;
  progress_percent: number;
  can_lock: boolean;
}

interface Answers {
  [key: string]: unknown;
  brand?: string;
  website?: string;
  niche?: string;
  offers?: string[];
  audience?: string[];
  differentiators?: string[];
  tone?: string[];
  tone_example?: string;
  platforms?: string[];
  primary_platform?: string;
  goals?: string[];
  kpis?: string[];
  constraints?: string[];
  approval_cadence?: string;
  approver_contact?: string;
  banned_claims?: string[];
  taboo_topics?: string[];
  brief?: {
    confidence?: number;
    summary?: Record<string, unknown>;
    followup?: {
      pending?: boolean;
      for_step_id?: string;
      question?: string;
      answer?: string;
    };
  };
  competitors?: string[];
  pillars?: string[];
  cta_styles?: string[];
  assets?: string[];
  pricing?: string;
  timeline?: string;
}

const REQUIRED_STEPS = [
  "brand_basics",
  "niche",
  "offers",
  "audience",
  "differentiators",
  "tone_voice",
  "platforms",
  "goals_kpis",
  "constraints_approvals",
  "pillars",
  "safety_topics",
];

const OPTIONAL_STEPS = [
  "competitors",
  "cta_styles",
  "assets",
  "pricing",
  "timeline",
];

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function shouldAskBriefFollowup(currentStepId: string | null, answers: Answers) {
  if (!currentStepId) return false;
  if (currentStepId === "brief_followup") return false;
  const followup = answers.brief?.followup;
  if (!followup?.pending) return false;
  if (followup.for_step_id !== currentStepId) return false;
  if (!followup.question) return false;
  if (followup.answer && followup.answer.trim().length > 0) return false;
  return true;
}

function getNextLinearStepId(currentStepId: string | null, skippedSteps: string[] = []): string {
  if (!currentStepId) return "brand_basics";

  const currentIndex = REQUIRED_STEPS.indexOf(currentStepId);
  if (currentIndex >= 0 && currentIndex < REQUIRED_STEPS.length - 1) {
    return REQUIRED_STEPS[currentIndex + 1];
  }

  if (currentStepId === REQUIRED_STEPS[REQUIRED_STEPS.length - 1]) {
    // Just completed last core step
    return "review_required";
  }

  if (currentStepId === "review_required") {
    // User chose to enhance or finish
    return OPTIONAL_STEPS[0];
  }

  const optionalIndex = OPTIONAL_STEPS.indexOf(currentStepId);
  if (optionalIndex >= 0 && optionalIndex < OPTIONAL_STEPS.length - 1) {
    return OPTIONAL_STEPS[optionalIndex + 1];
  }

  // Before showing final_review, check if there are skipped steps
  if (skippedSteps.length > 0) {
    // Return the first skipped step
    return skippedSteps[0];
  }

  return "final_review";
}

function getNextStepId(currentStepId: string | null, answers: Answers, completedRequired: boolean, skippedSteps: string[] = []): string {
  if (!currentStepId) return "brand_basics";

  if (currentStepId === "brief_followup") {
    const base = answers.brief?.followup?.for_step_id ?? null;
    return getNextLinearStepId(base, skippedSteps);
  }

  if (shouldAskBriefFollowup(currentStepId, answers)) {
    return "brief_followup";
  }

  return getNextLinearStepId(currentStepId, skippedSteps);
}

function calculateProgress(stepId: string): number {
  if (stepId === "brief_followup") return 50;
  const reqIndex = REQUIRED_STEPS.indexOf(stepId);
  if (reqIndex >= 0) {
    return Math.round(((reqIndex + 1) / REQUIRED_STEPS.length) * 100);
  }
  return 100;
}

function canLock(stepId: string, answers: Answers): boolean {
  if (stepId !== "review_required" && stepId !== "final_review") return false;

  // Check all required fields
  const hasBasics = !!answers.brand && !!answers.website;
  const hasNiche = !!answers.niche;
  const hasOffers = (answers.offers?.length ?? 0) >= 1;
  const hasAudience = (answers.audience?.length ?? 0) >= 1;
  const hasDiff = (answers.differentiators?.length ?? 0) >= 2;
  const hasTone = (answers.tone?.length ?? 0) >= 3;
  const hasPlatforms = (answers.platforms?.length ?? 0) >= 1;
  const hasGoals = (answers.goals?.length ?? 0) >= 1;
  const hasKpis = (answers.kpis?.length ?? 0) >= 1;
  const hasConstraints = (answers.constraints?.length ?? 0) >= 1 || answers.approval_cadence;

  return hasBasics && hasNiche && hasOffers && hasAudience && hasDiff &&
         hasTone && hasPlatforms && hasGoals && hasKpis && hasConstraints;
}

async function generateOptionsWithAI(
  stepId: string,
  answers: Answers,
  openaiKey: string
): Promise<Option[]> {
  // For deterministic results, use cached/static options for most steps
  // Only use AI for context-specific suggestions (offers, audience, differentiators)

  const staticOptions: Record<string, Option[]> = {
    niche: [
      { id: "ecommerce", label: "E-commerce / Online Retail" },
      { id: "saas", label: "SaaS / Software" },
      { id: "coaching", label: "Coaching / Consulting" },
      { id: "healthcare", label: "Healthcare / Wellness" },
      { id: "realestate", label: "Real Estate" },
      { id: "fitness", label: "Fitness / Gym" },
      { id: "restaurant", label: "Restaurant / Food Service" },
      { id: "finance", label: "Finance / Insurance" },
      { id: "legal", label: "Legal Services" },
      { id: "home", label: "Home Services" },
      { id: "beauty", label: "Beauty / Salon" },
      { id: "other", label: "Other (specify later)" }
    ],
    tone_traits: [
      { id: "professional", label: "Professional" },
      { id: "friendly", label: "Friendly" },
      { id: "authoritative", label: "Authoritative" },
      { id: "playful", label: "Playful" },
      { id: "empathetic", label: "Empathetic" },
      { id: "bold", label: "Bold" },
      { id: "educational", label: "Educational" },
      { id: "inspirational", label: "Inspirational" }
    ],
    tone_example: [
      { id: "apple", label: "Apple (simple, elegant)" },
      { id: "nike", label: "Nike (motivational, bold)" },
      { id: "mailchimp", label: "Mailchimp (friendly, quirky)" },
      { id: "hubspot", label: "HubSpot (educational, professional)" }
    ],
    platforms: [
      { id: "instagram", label: "Instagram" },
      { id: "facebook", label: "Facebook" },
      { id: "linkedin", label: "LinkedIn" },
      { id: "tiktok", label: "TikTok" },
      { id: "youtube", label: "YouTube" },
      { id: "twitter", label: "Twitter/X" }
    ],
    goals: [
      { id: "awareness", label: "Increase brand awareness" },
      { id: "leads", label: "Generate qualified leads" },
      { id: "engagement", label: "Boost community engagement" },
      { id: "sales", label: "Drive direct sales" },
      { id: "authority", label: "Establish thought leadership" },
      { id: "retention", label: "Improve customer retention" }
    ],
    kpis: [
      { id: "followers", label: "Follower growth %" },
      { id: "engagement_rate", label: "Engagement rate %" },
      { id: "reach", label: "Total reach" },
      { id: "leads_count", label: "Lead count" },
      { id: "conversion_rate", label: "Conversion rate %" },
      { id: "revenue", label: "Revenue from social" }
    ],
    constraints_options: [
      { id: "no_political", label: "No political content" },
      { id: "no_religion", label: "No religious content" },
      { id: "no_competitors", label: "Don't mention competitors" },
      { id: "no_pricing", label: "Don't disclose pricing publicly" },
      { id: "compliance", label: "Must follow industry compliance rules" },
      { id: "none", label: "No specific constraints" }
    ],
    approval_cadence: [
      { id: "every_post", label: "Every post" },
      { id: "weekly_batch", label: "Weekly batches" },
      { id: "monthly_batch", label: "Monthly batches" },
      { id: "autonomous", label: "Autonomous (review quarterly)" }
    ]
  };

  if (stepId === "niche") return staticOptions.niche;
  if (stepId === "tone_voice") {
    return staticOptions.tone_traits;
  }
  if (stepId === "platforms") return staticOptions.platforms;
  if (stepId === "goals_kpis") {
    // Combine goals (pick 1+) and KPIs (pick 1-3)
    return [
      ...staticOptions.goals,
      { id: "divider_kpis", label: "--- KPIs to Track (pick 1-3) ---" },
      ...staticOptions.kpis
    ];
  }
  if (stepId === "constraints_approvals") {
    // Combine content constraints and approval cadence
    return [
      ...staticOptions.constraints_options,
      { id: "divider_approval", label: "--- Approval Process (pick 1) ---" },
      ...staticOptions.approval_cadence
    ];
  }

  // AI-generated options for context-specific steps
  if (stepId === "offers" && answers.website) {
    return await generateOffersWithAI(answers.website, answers.niche || "", openaiKey);
  }

  if (stepId === "audience" && answers.niche) {
    return await generateAudienceWithAI(answers.niche, answers.offers || [], openaiKey);
  }

  if (stepId === "differentiators" && answers.brand) {
    return await generateDifferentiatorsWithAI(answers.brand, answers.niche || "", openaiKey);
  }

  return [];
}

async function generateOffersWithAI(website: string, niche: string, openaiKey: string): Promise<Option[]> {
  try {
    const aiResult = await ai.run({
      taskType: TaskType.EXTRACT_STRUCTURED,
      messages: buildOnboardingOffersPrompt({ website, niche }),
      context: { environment: "prod" },
    });
    const parsed = Array.isArray(aiResult.output) ? aiResult.output : [];

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 8);
    }
    return getDefaultOffers(niche);
  } catch (error) {
    console.error("Error generating offers:", error);
    return getDefaultOffers(niche);
  }
}

function getDefaultOffers(niche: string): Option[] {
  return [
    { id: "service1", label: "Social media management" },
    { id: "service2", label: "Content creation" },
    { id: "service3", label: "Paid advertising" },
    { id: "service4", label: "Strategy consulting" },
    { id: "service5", label: "Community management" },
    { id: "service6", label: "Influencer partnerships" },
    { id: "service7", label: "Analytics & reporting" },
    { id: "service8", label: "Brand development" }
  ];
}

async function generateAudienceWithAI(niche: string, offers: string[], openaiKey: string): Promise<Option[]> {
  try {
    const aiResult = await ai.run({
      taskType: TaskType.EXTRACT_STRUCTURED,
      messages: buildOnboardingAudiencePrompt({ niche, offers }),
      context: { environment: "prod" },
    });
    const parsed = Array.isArray(aiResult.output) ? aiResult.output : [];

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 5);
    }
    return getDefaultAudience();
  } catch (error) {
    console.error("Error generating audience:", error);
    return getDefaultAudience();
  }
}

function getDefaultAudience(): Option[] {
  return [
    { id: "persona1", label: "Small business owners (5-50 employees)" },
    { id: "persona2", label: "Marketing managers at mid-size companies" },
    { id: "persona3", label: "Entrepreneurs & solopreneurs" },
    { id: "persona4", label: "B2B decision makers" },
    { id: "persona5", label: "E-commerce brand owners" }
  ];
}

async function generateDifferentiatorsWithAI(brand: string, niche: string, openaiKey: string): Promise<Option[]> {
  try {
    const aiResult = await ai.run({
      taskType: TaskType.EXTRACT_STRUCTURED,
      messages: buildOnboardingDifferentiatorsPrompt({ brand, niche }),
      context: { environment: "prod" },
    });
    const parsed = Array.isArray(aiResult.output) ? aiResult.output : [];

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 6);
    }
    return getDefaultDifferentiators();
  } catch (error) {
    console.error("Error generating differentiators:", error);
    return getDefaultDifferentiators();
  }
}

function getDefaultDifferentiators(): Option[] {
  return [
    { id: "diff1", label: "Premium quality and craftsmanship" },
    { id: "diff2", label: "Exceptional customer service" },
    { id: "diff3", label: "Best pricing in the market" },
    { id: "diff4", label: "Fastest delivery times" },
    { id: "diff5", label: "Proven track record with major brands" },
    { id: "diff6", label: "Cutting-edge technology and innovation" }
  ];
}

function validateStep(stepId: string, answers: Answers, userInput: unknown): string[] {
  const errors: string[] = [];

  if (stepId === "brand_basics") {
    const input = userInput as { brand?: string; website?: string };
    if (!input.brand || input.brand.trim().length < 2) {
      errors.push("Brand name must be at least 2 characters");
    }
    if (!input.website || !validateUrl(input.website)) {
      errors.push("Please enter a valid website URL (e.g., https://example.com)");
    }
  }

  if (stepId === "offers") {
    const selected = userInput as string[];
    if (!selected || selected.length < 1 || selected.length > 3) {
      errors.push("Please select 1-3 offers");
    }
  }

  if (stepId === "audience") {
    const selected = userInput as string[];
    if (!selected || selected.length < 1 || selected.length > 2) {
      errors.push("Please select 1-2 target audiences");
    }
  }

  if (stepId === "differentiators") {
    const selected = userInput as string[];
    if (!selected || selected.length < 2 || selected.length > 4) {
      errors.push("Please select 2-4 differentiators");
    }
  }

  if (stepId === "tone_voice") {
    const input = userInput as { tone?: string[]; tone_example?: string };
    if (!input.tone || input.tone.length !== 3) {
      errors.push("Please select exactly 3 tone traits");
    }
  }

  if (stepId === "platforms") {
    const input = userInput as { platforms?: string[]; primary_platform?: string };
    if (!input.platforms || input.platforms.length < 1) {
      errors.push("Please select at least 1 platform");
    }
    if (!input.primary_platform) {
      errors.push("Please select a primary platform");
    }
  }

  if (stepId === "goals_kpis") {
    const input = userInput as { goals?: string[]; kpis?: string[] };
    if (!input.goals || input.goals.length < 1) {
      errors.push("Please select at least 1 goal");
    }
    if (!input.kpis || input.kpis.length < 1 || input.kpis.length > 3) {
      errors.push("Please select 1-3 KPIs");
    }
  }

  if (stepId === "constraints_approvals") {
    const input = userInput as { constraints?: string[]; approval_cadence?: string };
    // Constraints are optional, but approval cadence is required
    if (!input.approval_cadence) {
      errors.push("Please select an approval process");
    }
  }

  if (stepId === "pillars") {
    const list = Array.isArray(userInput) ? userInput.map(String).filter(Boolean) : [];
    if (list.length > 0 && (list.length < 3 || list.length > 6)) {
      errors.push("Please provide 3-6 pillars, or skip this step");
    }
  }

  if (stepId === "brief_followup") {
    if (typeof userInput !== "string" || userInput.trim().length < 2) {
      errors.push("Please answer the follow-up question");
    }
  }

  return errors;
}

function buildStepSpec(
  stepId: string,
  answers: Answers,
  openaiKey: string,
  options?: Option[]
): StepSpec {
  const progress = calculateProgress(stepId);
  const can_lock = canLock(stepId, answers);

  const followupQuestion =
    answers.brief?.followup?.question ??
    "One quick question to help us tailor the strategy: what should we know?";

  const specs: Record<string, Omit<StepSpec, "progress_percent" | "can_lock">> = {
    brand_basics: {
      step_id: "brand_basics",
      assistant_message: "Let's start with the basics. What's your client's brand name and website?",
      input_type: "short_text",
      constraints: { required: true, min: 2 }
    },
    niche: {
      step_id: "niche",
      assistant_message: "Great! Now, which industry or niche best describes your client?",
      input_type: "single_select",
      options: options || [],
      constraints: { required: true }
    },
    offers: {
      step_id: "offers",
      assistant_message: "Perfect. I've analyzed their business. Which of these offerings should we focus on? (Select 1-3)",
      input_type: "multi_select",
      options: options || [],
      constraints: { required: true, min: 1, max: 3 }
    },
    audience: {
      step_id: "audience",
      assistant_message: "Got it. Who is the primary target audience? (Select 1-2 personas)",
      input_type: "multi_select",
      options: options || [],
      constraints: { required: true, min: 1, max: 2 }
    },
    differentiators: {
      step_id: "differentiators",
      assistant_message: "What makes this brand stand out from competitors? (Select 2-4 key differentiators)",
      input_type: "chips",
      options: options || [],
      constraints: { required: true, min: 2, max: 4 }
    },
    tone_voice: {
      step_id: "tone_voice",
      assistant_message: "How should this client's brand voice sound? Select exactly 3 tone traits that describe their personality.",
      input_type: "chips",
      options: options || [],
      constraints: { required: true, min: 3, max: 3 }
    },
    platforms: {
      step_id: "platforms",
      assistant_message: "Which social platforms will we focus on? Select all that apply, then choose the primary one.",
      input_type: "chips",
      options: options || [],
      constraints: { required: true, min: 1 }
    },
    goals_kpis: {
      step_id: "goals_kpis",
      assistant_message: "What are the key goals for the next 90 days? Select at least 1 goal. Then pick 1-3 KPIs to track progress.",
      input_type: "chips",
      options: options || [],
      constraints: { required: true, min: 2, max: 9 }
    },
    constraints_approvals: {
      step_id: "constraints_approvals",
      assistant_message: "Almost done! Any content constraints we should know about? Then set the approval process.",
      input_type: "chips",
      options: options || [],
      constraints: { required: false }
    },
    pillars: {
      step_id: "pillars",
      assistant_message:
        "Pillars time. Add 3-6 content pillars (comma/newline separated). If you're not sure, you can skip and we'll infer a safe default.",
      input_type: "textarea",
      constraints: { required: false },
    },
    safety_topics: {
      step_id: "safety_topics",
      assistant_message:
        "Any banned claims or taboo topics? List what we must avoid (comma/newline separated). You can skip if none.",
      input_type: "textarea",
      constraints: { required: false },
    },
    brief_followup: {
      step_id: "brief_followup",
      assistant_message: followupQuestion,
      input_type: "textarea",
      constraints: { required: true },
    },
    review_required: {
      step_id: "review_required",
      assistant_message: `Excellent! You've completed all required fields. ${buildRecap(answers)} Ready to lock this in, or enhance with optional details?`,
      input_type: "single_select",
      options: [
        { id: "lock", label: "Lock & Finish (Brain is ready)" },
        { id: "enhance", label: "Enhance Strategy Depth (5 optional steps)" }
      ],
      constraints: { required: true }
    },
    competitors: {
      step_id: "competitors",
      assistant_message: "Who are the top competitors or alternatives? (comma/newline separated, optional)",
      input_type: "textarea",
      constraints: { required: false },
    },
    cta_styles: {
      step_id: "cta_styles",
      assistant_message: "What CTAs should we use? (comma/newline separated, optional)",
      input_type: "textarea",
      constraints: { required: false },
    },
    assets: {
      step_id: "assets",
      assistant_message: "Share key links/assets we should use (URLs or notes, comma/newline separated, optional).",
      input_type: "textarea",
      constraints: { required: false },
    },
    pricing: {
      step_id: "pricing",
      assistant_message: "Anything about pricing we should know? (optional)",
      input_type: "textarea",
      constraints: { required: false },
    },
    timeline: {
      step_id: "timeline",
      assistant_message: "Any timeline constraints or deadlines? (optional)",
      input_type: "textarea",
      constraints: { required: false },
    },
    final_review: {
      step_id: "final_review",
      assistant_message:
        "Review complete. Ready to lock this in? (We'll still keep safe fallbacks for anything skipped.)",
      input_type: "single_select",
      options: [{ id: "lock", label: "Lock & Finish (Brain is ready)" }],
      constraints: { required: true },
    },
  };

  const spec = specs[stepId] || specs.brand_basics;

  return {
    ...spec,
    progress_percent: progress,
    can_lock
  };
}

function buildRecap(answers: Answers): string {
  const parts: string[] = [];
  if (answers.brand) parts.push(`Brand: ${answers.brand}`);
  if (answers.niche) parts.push(`Niche: ${answers.niche}`);
  if (answers.offers && answers.offers.length > 0) {
    parts.push(`Offers: ${answers.offers.length} selected`);
  }
  return parts.join(" | ");
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(req) });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed", v: FN_VERSION }, 405, corsHeaders(req));
    }

    const guardResponse = getEndpointGuardResponse("ai-onboarding-guide", corsHeaders(req));
    if (guardResponse) return guardResponse;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header", v: FN_VERSION }, 401, corsHeaders(req));
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("CRITICAL: OPENAI_API_KEY not set");
      return jsonResponse(
        { error: "AI service unavailable (missing API key). Contact support.", v: FN_VERSION },
        503,
        corsHeaders(req)
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized", v: FN_VERSION }, 401, corsHeaders(req));
    }

    const body = await req.json().catch(() => ({}));
    const agencyId = body.agency_id as string | undefined;
    const clientId = body.client_id as string | undefined;
    const brainId = body.brain_id as string | undefined;
    const currentStepId = body.step_id as string | null;
    const answers = (body.answers || {}) as Answers;
    const userInput = body.user_input;
    const skippedSteps = (body.skipped_steps || []) as string[];

    if (!agencyId || !clientId) {
      return jsonResponse({ error: "agency_id and client_id required", v: FN_VERSION }, 400, corsHeaders(req));
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", user.id)
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (!membership) {
      return jsonResponse({ error: "Forbidden", v: FN_VERSION }, 403, corsHeaders(req));
    }

    // Validate user input if provided (skip validation if userInput is null for skip action)
    let validationErrors: string[] = [];
    if (currentStepId && userInput !== undefined && userInput !== null) {
      validationErrors = validateStep(currentStepId, answers, userInput);
      if (validationErrors.length > 0) {
        // Return current step with errors, don't advance
        const options = await generateOptionsWithAI(currentStepId, answers, openaiKey);
        const spec = buildStepSpec(currentStepId, answers, openaiKey, options);
        spec.validation_errors = validationErrors;
        return jsonResponse(spec, 200, corsHeaders(req));
      }
    }

    // Determine next step
    const nextStepId = userInput !== undefined
      ? getNextStepId(currentStepId, answers, false, skippedSteps)
      : (currentStepId || "brand_basics");

    // Generate options for next step
    const options = await generateOptionsWithAI(nextStepId, answers, openaiKey);
    const stepSpec = buildStepSpec(nextStepId, answers, openaiKey, options);

    return jsonResponse(stepSpec, 200, corsHeaders(req));
  } catch (error) {
    // Catch any uncaught errors and return with CORS headers
    console.error("Uncaught error in ai-onboarding-guide:", error);
    return jsonResponse(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        v: FN_VERSION
      },
      500,
      corsHeaders(req)
    );
  }
});
