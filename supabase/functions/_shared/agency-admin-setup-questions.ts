export type ValidationRule = {
  type?: "string" | "array" | "object";
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  errorMessages?: {
    minItems?: string;
    maxItems?: string;
    minLength?: string;
    maxLength?: string;
    pattern?: string;
    required?: string;
  };
};

export type QuestionDependency = {
  required_if?: Array<{
    field: string;
    includes?: string[];
    equals?: string | number | boolean;
    lessThan?: number;
    greaterThan?: number;
  }>;
  skip_if?: Array<{
    field: string;
    includes?: string[];
    equals?: string | number | boolean;
    lessThan?: number;
    greaterThan?: number;
  }>;
};

export type SetupQuestionOption = {
  id: string;
  label: string;
  value: string;
  description?: string;
};

export type SetupQuestion = {
  key: string;
  question_text: string;
  expects: "text" | "choice";
  inputType?: "text" | "multiselect" | "dropdown" | "tags";
  target_path: string;
  examples?: string[];
  suggestions?: Array<{ id: string; label: string; user_message: string }>;
  options?: SetupQuestionOption[];
  validation?: ValidationRule;
  dependencies?: QuestionDependency;
  skipAiExtraction?: boolean;  // For structured inputs
};

export const SETUP_QUESTIONS: SetupQuestion[] = [
  {
    key: "agency.primary_services",
    question_text: "What are your primary services? Select 3-6.",
    expects: "choice",
    inputType: "multiselect",
    target_path: "setup_profile_v1.agency.primary_services",
    skipAiExtraction: true,
    options: [
      { id: "smm", label: "Social Media Management", value: "Social media management", description: "Monthly social media management retainer" },
      { id: "content", label: "Content Creation", value: "Content creation", description: "Reels, Posts, Stories, Videos" },
      { id: "ads", label: "Paid Ads", value: "Paid ads management", description: "Meta Ads, Google Ads, TikTok Ads" },
      { id: "lead_gen", label: "Lead Generation", value: "Lead generation", description: "DM outreach, booking systems" },
      { id: "ugc", label: "UGC Sourcing", value: "UGC sourcing + editing", description: "User-generated content curation" },
      { id: "strategy", label: "Strategy Consulting", value: "Strategy consulting", description: "Social media strategy and planning" },
      { id: "design", label: "Graphic Design", value: "Graphic design", description: "Brand design, graphics, visuals" },
      { id: "video", label: "Video Production", value: "Video production", description: "Professional video creation" },
    ],
    validation: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      errorMessages: {
        minItems: "Please select at least 3 services to help me understand your core offerings.",
        maxItems: "Please select no more than 6 services to keep your positioning focused.",
        required: "I need to know your primary services to set up your agency profile.",
      },
    },
    examples: [
      "Social media management",
      "Content creation (Reels + Posts + Stories)",
      "Paid ads management (Meta / Google)",
    ],
    suggestions: [
      { id: "smm", label: "SMM + Content + Ads", user_message: "Social media management, Content creation, Paid ads management." },
      { id: "content", label: "Content-focused", user_message: "Content creation, UGC sourcing, Graphic design." },
      { id: "ads", label: "Performance-focused", user_message: "Paid ads, Lead generation, Strategy consulting." },
    ],
  },
  {
    key: "agency.niche_industries",
    question_text: "Which niches/industries do you focus on? Select 1-3.",
    expects: "choice",
    inputType: "multiselect",
    target_path: "setup_profile_v1.agency.niche_industries",
    skipAiExtraction: true,
    options: [
      { id: "realestate", label: "Real Estate", value: "Real estate", description: "Agents, brokers, property management" },
      { id: "ecommerce", label: "E-commerce", value: "Ecommerce", description: "Online stores, product brands" },
      { id: "local_services", label: "Local Services", value: "Local services", description: "Restaurants, salons, home services" },
      { id: "coaches", label: "Coaches & Consultants", value: "Coaches/consultants", description: "Business coaches, life coaches, consultants" },
      { id: "saas", label: "SaaS", value: "SaaS", description: "Software companies, tech startups" },
      { id: "fitness", label: "Fitness & Wellness", value: "Fitness", description: "Gyms, trainers, wellness brands" },
      { id: "healthcare", label: "Healthcare", value: "Healthcare", description: "Medical practices, clinics, dentists" },
      { id: "finance", label: "Finance & Insurance", value: "Finance", description: "Financial advisors, insurance agencies" },
      { id: "hospitality", label: "Hospitality", value: "Hospitality", description: "Hotels, restaurants, tourism" },
      { id: "other", label: "Other", value: "Other", description: "Describe your niche" },
    ],
    validation: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      errorMessages: {
        minItems: "Please select at least 1 niche to help me understand your target market.",
        maxItems: "Please select no more than 3 niches to maintain your positioning clarity.",
        required: "I need to know your target niches to tailor your agency brain.",
      },
    },
    examples: ["Real estate", "Ecommerce", "Coaches/consultants"],
    suggestions: [
      { id: "local", label: "Local businesses", user_message: "Local services, Real estate, Fitness." },
      { id: "ecom", label: "E-commerce + SaaS", user_message: "Ecommerce, SaaS." },
      { id: "coaches", label: "Coaches + Consultants", user_message: "Coaches/consultants, Finance." },
    ],
  },
  {
    key: "agency.target_client_profile",
    question_text: "Describe your ideal client size and budget range.",
    expects: "text",
    target_path: "setup_profile_v1.agency.target_client_profile",
    validation: {
      type: "string",
      minLength: 10,
      maxLength: 200,
      errorMessages: {
        minLength: "Please provide more detail about your ideal client (at least 10 characters).",
        maxLength: "Please keep your description concise (under 200 characters).",
        required: "I need to understand your ideal client to tailor recommendations.",
      },
    },
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
    validation: {
      type: "string",
      minLength: 15,
      maxLength: 150,
      errorMessages: {
        minLength: "Please describe the outcome in at least 15 characters.",
        maxLength: "Please keep your outcome description under 150 characters.",
        required: "I need to know the core outcome you deliver to clients.",
      },
    },
    examples: ["We generate consistent qualified leads via organic + paid social."],
  },
  {
    key: "agency.deliverables_standard",
    question_text: "What are your standard deliverables each month? (bullets)",
    expects: "text",
    target_path: "setup_profile_v1.agency.deliverables_standard",
    examples: ["12 posts, 8 short-form videos, monthly report", "2 ad creatives per week"],
    dependencies: {
      required_if: [
        {
          field: "agency.primary_services",
          includes: ["Social media management", "Content creation"],
        },
      ],
    },
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
    expects: "choice",
    inputType: "tags",
    target_path: "setup_profile_v1.brand.voice_adjectives",
    skipAiExtraction: true,
    options: [
      { id: "bold", label: "Bold", value: "Bold", description: "Confident, assertive, direct" },
      { id: "friendly", label: "Friendly", value: "Friendly", description: "Warm, approachable, helpful" },
      { id: "professional", label: "Professional", value: "Professional", description: "Polished, formal, expert" },
      { id: "premium", label: "Premium", value: "Premium", description: "High-end, sophisticated, exclusive" },
      { id: "creative", label: "Creative", value: "Creative", description: "Innovative, artistic, imaginative" },
      { id: "data_driven", label: "Data-Driven", value: "Data-driven", description: "Analytical, metrics-focused" },
      { id: "conversational", label: "Conversational", value: "Conversational", description: "Casual, relatable, down-to-earth" },
      { id: "authoritative", label: "Authoritative", value: "Authoritative", description: "Expert, credible, knowledgeable" },
      { id: "playful", label: "Playful", value: "Playful", description: "Fun, lighthearted, energetic" },
      { id: "empathetic", label: "Empathetic", value: "Empathetic", description: "Understanding, supportive, caring" },
    ],
    validation: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      errorMessages: {
        minItems: "Please select exactly 3 adjectives to define your brand voice.",
        maxItems: "Please select exactly 3 adjectives to keep your voice consistent.",
        required: "I need to know your brand voice to communicate like you.",
      },
    },
    examples: ["Bold, direct, friendly", "Premium, calm, expert"],
    suggestions: [
      { id: "bold", label: "Bold + Friendly", user_message: "Bold, Friendly, Professional." },
      { id: "premium", label: "Premium + Expert", user_message: "Premium, Authoritative, Data-driven." },
      { id: "creative", label: "Creative + Playful", user_message: "Creative, Playful, Conversational." },
    ],
  },
  {
    key: "brand.dos_donts",
    question_text: "List brand do's and don'ts for responses.",
    expects: "text",
    target_path: "setup_profile_v1.brand.dos_donts",
    examples: ["Do: be concise. Don't: make guarantees."],
    dependencies: {
      skip_if: [
        {
          field: "agency.primary_services",
          includes: ["Paid ads management"],
        },
      ],
    },
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

/**
 * Get the next question to ask, considering dependencies and skipping rules
 * @param answeredKeys - Set of question keys that have been answered
 * @param answeredValues - Map of question keys to their answered values (for dependency evaluation)
 * @returns Next question to ask, or null if all questions are answered/skipped
 */
export function getNextQuestion(
  answeredKeys: Set<string>,
  answeredValues?: Map<string, unknown>,
): SetupQuestion | null {
  // If no answeredValues provided, fall back to simple logic (backward compatible)
  if (!answeredValues) {
    return SETUP_QUESTIONS.find((q) => !answeredKeys.has(q.key)) ?? null;
  }

  // Find next unanswered question that should be shown based on dependencies
  for (const question of SETUP_QUESTIONS) {
    if (answeredKeys.has(question.key)) {
      continue; // Already answered, skip
    }

    const evaluation = evaluateDependencies(question, answeredValues);
    if (evaluation.shouldShow) {
      return question; // Found next question to ask
    }
    // If shouldShow is false, continue to next question (skip this one)
  }

  return null; // All questions answered or skipped
}

export function getMissingKeys(answeredKeys: Set<string>) {
  return SETUP_QUESTIONS.filter((q) => !answeredKeys.has(q.key)).map((q) => q.key);
}

export function computeProgress(answeredKeys: Set<string>) {
  if (SETUP_QUESTIONS.length === 0) return 0;
  const ratio = answeredKeys.size / SETUP_QUESTIONS.length;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * Compute progress percentage accounting for skipped questions (Phase 2)
 * @param answeredKeys - Set of answered question keys
 * @param answeredValues - Map of answered values (for dependency evaluation)
 * @returns Progress percentage (0-100)
 */
export function computeSmartProgress(
  answeredKeys: Set<string>,
  answeredValues: Map<string, unknown>,
): number {
  if (SETUP_QUESTIONS.length === 0) return 0;

  let totalRelevant = 0;
  let answered = 0;

  for (const question of SETUP_QUESTIONS) {
    if (answeredKeys.has(question.key)) {
      // Question was answered
      totalRelevant++;
      answered++;
      continue;
    }

    // Check if question should be shown
    const evaluation = evaluateDependencies(question, answeredValues);
    if (evaluation.shouldShow) {
      totalRelevant++; // Question is relevant but not answered yet
    }
    // If shouldShow is false, question is skipped and doesn't count toward total
  }

  if (totalRelevant === 0) return 100; // All questions skipped or no questions

  const ratio = answered / totalRelevant;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * Evaluate if a question should be shown based on its dependencies
 * @param question - The question to evaluate
 * @param answeredValues - Map of question keys to their answered values
 * @returns { shouldShow: boolean, reason?: string }
 */
export function evaluateDependencies(
  question: SetupQuestion,
  answeredValues: Map<string, unknown>,
): { shouldShow: boolean; reason?: string } {
  if (!question.dependencies) {
    return { shouldShow: true };
  }

  const { required_if, skip_if } = question.dependencies;

  // Check skip_if conditions first (higher priority)
  if (skip_if && skip_if.length > 0) {
    for (const condition of skip_if) {
      const fieldValue = answeredValues.get(condition.field);

      // Check includes condition (for arrays)
      if (condition.includes && Array.isArray(fieldValue)) {
        const hasMatch = condition.includes.some((val) => fieldValue.includes(val));
        if (hasMatch) {
          return {
            shouldShow: false,
            reason: `Skipped because you selected "${condition.includes.join(" or ")}" for ${condition.field}`,
          };
        }
      }

      // Check equals condition
      if (condition.equals !== undefined && fieldValue === condition.equals) {
        return {
          shouldShow: false,
          reason: `Skipped because ${condition.field} equals "${condition.equals}"`,
        };
      }

      // Check lessThan condition
      if (condition.lessThan !== undefined && typeof fieldValue === "number" && fieldValue < condition.lessThan) {
        return {
          shouldShow: false,
          reason: `Skipped because ${condition.field} is less than ${condition.lessThan}`,
        };
      }

      // Check greaterThan condition
      if (
        condition.greaterThan !== undefined &&
        typeof fieldValue === "number" &&
        fieldValue > condition.greaterThan
      ) {
        return {
          shouldShow: false,
          reason: `Skipped because ${condition.field} is greater than ${condition.greaterThan}`,
        };
      }
    }
  }

  // Check required_if conditions
  if (required_if && required_if.length > 0) {
    for (const condition of required_if) {
      const fieldValue = answeredValues.get(condition.field);

      // Check includes condition (for arrays)
      if (condition.includes && Array.isArray(fieldValue)) {
        const hasMatch = condition.includes.some((val) => fieldValue.includes(val));
        if (hasMatch) {
          return { shouldShow: true }; // At least one required_if condition is met
        }
      }

      // Check equals condition
      if (condition.equals !== undefined && fieldValue === condition.equals) {
        return { shouldShow: true };
      }

      // Check lessThan condition
      if (condition.lessThan !== undefined && typeof fieldValue === "number" && fieldValue < condition.lessThan) {
        return { shouldShow: true };
      }

      // Check greaterThan condition
      if (
        condition.greaterThan !== undefined &&
        typeof fieldValue === "number" &&
        fieldValue > condition.greaterThan
      ) {
        return { shouldShow: true };
      }
    }

    // None of the required_if conditions were met
    return {
      shouldShow: false,
      reason: `Skipped because required conditions not met for ${required_if[0]?.field}`,
    };
  }

  // No dependencies matched, show the question
  return { shouldShow: true };
}
