// ============================================================================
// Onboarding Readiness Scoring
// Calculates the Strategy Readiness Meter (0-100) with hard blocker validation
// ============================================================================

import type {
  OnboardingProfile,
  OnboardingBlocker,
  ReadinessBreakdown,
  SocialChannel,
} from '@/types/onboarding';

/**
 * Field weights for readiness scoring
 * Total: 100 points
 */
const FIELD_WEIGHTS: Record<string, number> = {
  // Section A: Business + Offer (25 points)
  q1_business_name: 5,
  q2_website: 5,
  q3_market_scope: 3,
  q4_languages: 2,
  q5_offer_type: 3,
  q6_offer_name: 4,
  q6_price_range: 1, // Combined min/max
  q6_main_cta: 2,

  // Section B: Ideal Customer + Outcome (35 points)
  q7_business_model: 5,
  q8_ideal_customer: 10,
  q9_pain_points: 8,
  q10_desired_outcome: 9,
  q11_sales_cycle: 3,

  // Section C: Differentiation + Proof (20 points)
  q12_competitors: 5,
  q13_differentiators: 8,
  q14_proof_level: 2,
  q15_proof_points: 5,

  // Section D: Channels + Cadence (20 points)
  q16_enabled_channels: 8,
  q17_primary_goal: 4,
  q18_cadence: 8,
};

/**
 * Hard blockers - must be filled to complete onboarding
 */
const HARD_BLOCKERS: Array<{
  field: string;
  check: (profile: Partial<OnboardingProfile>) => boolean;
  message: string;
}> = [
  {
    field: 'q6_offer_name',
    check: (p) => !!p.q6_offer_name?.trim(),
    message: 'Primary offer name is required',
  },
  {
    field: 'q6_main_cta',
    check: (p) => !!p.q6_main_cta?.trim(),
    message: 'Main CTA is required',
  },
  {
    field: 'q8_ideal_customer',
    check: (p) => !!p.q8_ideal_customer?.trim(),
    message: 'Ideal customer is required',
  },
  {
    field: 'q10_desired_outcome',
    check: (p) => !!p.q10_desired_outcome?.trim(),
    message: 'Desired outcome is required',
  },
  {
    field: 'q16_enabled_channels',
    check: (p) => (p.q16_enabled_channels?.length ?? 0) > 0,
    message: 'At least one channel must be enabled',
  },
  {
    field: 'q18_cadence',
    check: (p) => {
      const channels = p.q16_enabled_channels ?? [];
      const cadence = p.q18_cadence ?? {};
      return channels.every((ch) => (cadence[ch as SocialChannel] ?? 0) > 0);
    },
    message: 'Each enabled channel must have a posting cadence',
  },
];

/**
 * Assumption penalty per ai_assumed field
 */
const ASSUMPTION_PENALTY = 2;

/**
 * Check if a field is filled
 */
function isFieldFilled(profile: Partial<OnboardingProfile>, field: string): boolean {
  switch (field) {
    case 'q1_business_name':
      return !!profile.q1_business_name?.trim();
    case 'q2_website':
      return !!profile.q2_website?.trim();
    case 'q3_market_scope':
      return !!profile.q3_market_scope;
    case 'q4_languages':
      return (profile.q4_languages?.length ?? 0) > 0;
    case 'q5_offer_type':
      return !!profile.q5_offer_type;
    case 'q6_offer_name':
      return !!profile.q6_offer_name?.trim();
    case 'q6_price_range':
      return profile.q6_price_min != null || profile.q6_price_max != null;
    case 'q6_main_cta':
      return !!profile.q6_main_cta?.trim();
    case 'q7_business_model':
      return !!profile.q7_business_model;
    case 'q8_ideal_customer':
      return !!profile.q8_ideal_customer?.trim();
    case 'q9_pain_points':
      return (profile.q9_pain_points?.length ?? 0) >= 3;
    case 'q10_desired_outcome':
      return !!profile.q10_desired_outcome?.trim();
    case 'q11_sales_cycle':
      return !!profile.q11_sales_cycle;
    case 'q12_competitors':
      return (profile.q12_competitors?.length ?? 0) > 0;
    case 'q13_differentiators':
      return (profile.q13_differentiators?.length ?? 0) >= 2;
    case 'q14_proof_level':
      return !!profile.q14_proof_level;
    case 'q15_proof_points': {
      const level = profile.q14_proof_level;
      const points = profile.q15_proof_points?.length ?? 0;
      if (level === 'none') return true;
      if (level === 'some') return points >= 1;
      if (level === 'strong') return points >= 3;
      return true;
    }
    case 'q16_enabled_channels':
      return (profile.q16_enabled_channels?.length ?? 0) > 0;
    case 'q17_primary_goal':
      return !!profile.q17_primary_goal;
    case 'q18_cadence': {
      const channels = profile.q16_enabled_channels ?? [];
      const cadence = profile.q18_cadence ?? {};
      return channels.length > 0 && channels.every((ch) => (cadence[ch as SocialChannel] ?? 0) > 0);
    }
    default:
      return false;
  }
}

/**
 * Count AI assumptions in profile
 */
function countAssumptions(profile: Partial<OnboardingProfile>): number {
  const provenanceFields = [
    profile.q1_provenance,
    profile.q2_provenance,
    profile.q3_provenance,
    profile.q4_provenance,
    profile.q5_provenance,
    profile.q6_provenance,
    profile.q7_provenance,
    profile.q8_provenance,
    profile.q9_provenance,
    profile.q10_provenance,
    profile.q11_provenance,
    profile.q12_provenance,
    profile.q13_provenance,
    profile.q14_provenance,
    profile.q15_provenance,
    profile.q16_provenance,
    profile.q17_provenance,
    profile.q18_provenance,
  ];

  return provenanceFields.filter((p) => p === 'ai_assumed').length;
}

/**
 * Get all blockers for a profile
 */
export function getBlockers(profile: Partial<OnboardingProfile>): OnboardingBlocker[] {
  return HARD_BLOCKERS.filter((blocker) => !blocker.check(profile)).map((blocker) => ({
    field: blocker.field,
    message: blocker.message,
  }));
}

/**
 * Check if all hard blockers are cleared
 */
export function areBlockersCleared(profile: Partial<OnboardingProfile>): boolean {
  return HARD_BLOCKERS.every((blocker) => blocker.check(profile));
}

/**
 * Calculate readiness score with detailed breakdown
 */
export function calculateReadiness(profile: Partial<OnboardingProfile>): ReadinessBreakdown {
  let score = 0;
  let maxScore = 0;

  // Section scores
  const sectionScores = {
    A: { score: 0, max: 0 },
    B: { score: 0, max: 0 },
    C: { score: 0, max: 0 },
    D: { score: 0, max: 0 },
  };

  // Calculate scores per field
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    maxScore += weight;

    // Determine section
    let section: 'A' | 'B' | 'C' | 'D' = 'A';
    if (field.startsWith('q7') || field.startsWith('q8') || field.startsWith('q9') ||
        field.startsWith('q10') || field.startsWith('q11')) {
      section = 'B';
    } else if (field.startsWith('q12') || field.startsWith('q13') ||
               field.startsWith('q14') || field.startsWith('q15')) {
      section = 'C';
    } else if (field.startsWith('q16') || field.startsWith('q17') || field.startsWith('q18')) {
      section = 'D';
    }

    sectionScores[section].max += weight;

    if (isFieldFilled(profile, field)) {
      score += weight;
      sectionScores[section].score += weight;
    }
  }

  // Calculate assumption penalty
  const assumptionCount = countAssumptions(profile);
  const assumptionPenalty = assumptionCount * ASSUMPTION_PENALTY;

  // Calculate percentage
  const basePercent = Math.round((score / maxScore) * 100);
  const finalPercent = Math.max(0, Math.min(100, basePercent - assumptionPenalty));

  return {
    score,
    maxScore,
    percentage: finalPercent,
    hardBlockersCleared: areBlockersCleared(profile),
    assumptionCount,
    assumptionPenalty,
    sectionScores,
  };
}

/**
 * Get readiness level label
 */
export function getReadinessLevel(percentage: number): {
  label: string;
  color: 'red' | 'yellow' | 'green';
  description: string;
} {
  if (percentage < 40) {
    return {
      label: 'Not ready',
      color: 'red',
      description: 'Complete more fields to generate a strategy',
    };
  }
  if (percentage < 70) {
    return {
      label: 'Almost ready',
      color: 'yellow',
      description: 'A few more answers will improve your strategy',
    };
  }
  if (percentage < 90) {
    return {
      label: 'Ready',
      color: 'green',
      description: 'You can generate a good strategy',
    };
  }
  return {
    label: 'Excellent',
    color: 'green',
    description: 'All key information collected',
  };
}

/**
 * Calculate readiness for client self-serve flow (Q1-Q12 only)
 */
export function calculateClientFlowReadiness(profile: Partial<OnboardingProfile>): number {
  const clientFields = [
    'q1_business_name',
    'q2_website',
    'q3_market_scope',
    'q4_languages',
    'q5_offer_type',
    'q6_offer_name',
    'q6_main_cta',
    'q7_business_model',
    'q8_ideal_customer',
    'q9_pain_points',
    'q10_desired_outcome',
    'q11_sales_cycle',
    'q12_competitors',
  ];

  let filled = 0;
  for (const field of clientFields) {
    if (isFieldFilled(profile, field)) {
      filled++;
    }
  }

  return Math.round((filled / clientFields.length) * 100);
}

/**
 * Validate proof points based on proof level
 */
export function validateProofPoints(
  proofLevel: string | null | undefined,
  proofPoints: unknown[] | null | undefined
): { valid: boolean; message?: string } {
  const level = proofLevel ?? 'none';
  const count = (proofPoints as unknown[])?.length ?? 0;

  if (level === 'none') {
    return { valid: true };
  }
  if (level === 'some' && count < 1) {
    return { valid: false, message: 'Add at least 1 proof point for "Some" proof level' };
  }
  if (level === 'strong' && count < 3) {
    return { valid: false, message: 'Add at least 3 proof points for "Strong" proof level' };
  }

  return { valid: true };
}

/**
 * Validate cadence for all enabled channels
 */
export function validateCadence(
  enabledChannels: string[] | null | undefined,
  cadence: Record<string, number> | null | undefined
): { valid: boolean; missingChannels: string[] } {
  const channels = enabledChannels ?? [];
  const cadenceMap = cadence ?? {};

  const missingChannels = channels.filter(
    (ch) => !cadenceMap[ch as SocialChannel] || cadenceMap[ch as SocialChannel] < 1
  );

  return {
    valid: missingChannels.length === 0,
    missingChannels,
  };
}
