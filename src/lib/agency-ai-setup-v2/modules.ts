import type { AgencyOperatingModuleV2 } from "@/lib/strategy/v2/contracts";
import type { AgencyAiSetupMetaV2 } from "@/lib/agency-ai-setup-v2/readiness";

export type AgencyAiSetupModuleRequirementKey =
  | "rules"
  | "examples"
  | "anti_patterns"
  | "edge_cases"
  | "evidence_sources";

export interface AgencyAiSetupModuleRequirement {
  key: AgencyAiSetupModuleRequirementKey;
  label: string;
  minCount: number;
  description: string;
  actualCount?: number;
}

export const AGENCY_AI_SETUP_CORE_MODULES = [
  {
    key: "agency_identity",
    title: "Agency Identity",
    description: "Who the agency serves, what it does, and how it positions itself.",
    whyItMatters:
      "This becomes the baseline context for how Strategy AI should frame the agency before it makes recommendations.",
    goodExample:
      "We help boutique fitness studios turn short-form content into booked consultations through operator-grade organic systems.",
    weakExample:
      "We help businesses grow on social media.",
    proofRequirements: [
      { key: "rules", label: "Positioning rules", minCount: 2, description: "Rules that explain how the agency should be framed." },
      { key: "examples", label: "Approved identity examples", minCount: 1, description: "Example summaries that feel like the agency." },
    ],
  },
  {
    key: "service_catalog",
    title: "Service Catalog",
    description: "Core services the agency provides and how they are framed.",
    whyItMatters:
      "This tells the AI what services are real, how they should be described, and what should never be invented.",
    goodExample:
      "Done-for-you monthly content systems, performance creative production, and structured approval management.",
    weakExample:
      "We do content and marketing stuff.",
    proofRequirements: [
      { key: "rules", label: "Service framing rules", minCount: 2, description: "Rules for how services should be described and prioritized." },
      { key: "examples", label: "Approved service examples", minCount: 1, description: "At least one concrete example of good service framing." },
    ],
  },
  {
    key: "offer_strategy",
    title: "Offer Strategy",
    description: "Primary and secondary offers, priorities, and constraints.",
    whyItMatters:
      "This determines which offer Strategy AI should optimize around and what commercial constraints it must respect.",
    goodExample:
      "Primary offer: monthly retainer for local service lead-gen content systems. Secondary: launch sprint for new offer rollout.",
    weakExample:
      "We have a few offers depending on the client.",
    proofRequirements: [
      { key: "rules", label: "Offer priority rules", minCount: 2, description: "Rules that tell the AI how to prioritize and protect the offer strategy." },
      { key: "examples", label: "Approved offer examples", minCount: 1, description: "At least one example of how the offer should be positioned." },
      { key: "anti_patterns", label: "Offer anti-patterns", minCount: 1, description: "Examples of offer framing that should fail review." },
    ],
  },
  {
    key: "icp_segments",
    title: "ICP Segments",
    description: "Ideal client types, pains, jobs to be done, and fit boundaries.",
    whyItMatters:
      "Without clear ICP boundaries, the AI will drift into generic targeting and weak recommendations.",
    goodExample:
      "Multi-location cosmetic dental clinics that need premium local content and booked consultation volume, not broad awareness.",
    weakExample:
      "Healthcare businesses.",
    proofRequirements: [
      { key: "rules", label: "ICP rules", minCount: 2, description: "Rules that define who is high fit and who is not." },
      { key: "examples", label: "ICP examples", minCount: 1, description: "At least one clear ideal client example." },
      { key: "anti_patterns", label: "Low-fit examples", minCount: 1, description: "At least one example of a client segment the agency should avoid." },
    ],
  },
  {
    key: "quality_bar",
    title: "Quality Bar",
    description: "What high-quality output means and what should fail review.",
    whyItMatters:
      "This is one of the most important modules because it determines what the AI should reject before it reaches strategy, creator, or client-facing surfaces.",
    goodExample:
      "Recommendations must be commercially sharp, context-grounded, and operationally realistic. Reject fluff, hype, and unverifiable claims.",
    weakExample:
      "Be professional and high quality.",
    proofRequirements: [
      { key: "rules", label: "Quality rules", minCount: 3, description: "Specific rules for what the AI must optimize for." },
      { key: "examples", label: "Approved quality examples", minCount: 2, description: "Examples of outputs the agency would consider strong." },
      { key: "anti_patterns", label: "Rejected output patterns", minCount: 2, description: "Examples of outputs that should fail quality review." },
      { key: "evidence_sources", label: "Evidence sources", minCount: 1, description: "At least one source that supports the quality standard." },
    ],
  },
  {
    key: "approval_matrix",
    title: "Approval Matrix",
    description: "Who approves what and which outputs are blocked without review.",
    whyItMatters:
      "This controls how AI behavior stays governed instead of acting ahead of human approval rules.",
    goodExample:
      "Strategy recommendations require strategist approval, creator briefs require lead approval, and anything client-facing with compliance risk must escalate.",
    weakExample:
      "Things should usually be approved before going live.",
    proofRequirements: [
      { key: "rules", label: "Approval rules", minCount: 3, description: "Specific approval logic for strategy, creator, and high-risk outputs." },
      { key: "edge_cases", label: "Escalation edge cases", minCount: 1, description: "At least one edge case or escalation rule." },
      { key: "evidence_sources", label: "Approval evidence", minCount: 1, description: "At least one source or note proving the workflow is real." },
    ],
  },
] as const;

export type AgencyAiSetupCoreModuleKey = (typeof AGENCY_AI_SETUP_CORE_MODULES)[number]["key"];

export const STRATEGY_AI_MINIMUM_PROOF_MODULES: AgencyAiSetupCoreModuleKey[] = [
  "agency_identity",
  "offer_strategy",
  "quality_bar",
  "approval_matrix",
];

export function isAgencyAiSetupCoreModuleKey(value: string): value is AgencyAiSetupCoreModuleKey {
  return AGENCY_AI_SETUP_CORE_MODULES.some((module) => module.key === value);
}

export function getAgencyAiSetupModuleMeta(key: string) {
  return AGENCY_AI_SETUP_CORE_MODULES.find((module) => module.key === key) ?? null;
}

export function getAgencyAiSetupModuleItemCount(
  content: AgencyOperatingModuleV2,
  key: AgencyAiSetupModuleRequirementKey,
) {
  switch (key) {
    case "rules":
      return content.rules?.length ?? 0;
    case "examples":
      return content.examples?.length ?? 0;
    case "anti_patterns":
      return content.anti_patterns?.length ?? 0;
    case "edge_cases":
      return content.edge_cases?.length ?? 0;
    case "evidence_sources":
      return content.evidence_sources?.length ?? 0;
    default:
      return 0;
  }
}

export function assessAgencyAiSetupModuleContent(
  moduleKey: AgencyAiSetupCoreModuleKey,
  content: AgencyOperatingModuleV2,
) {
  const meta = getAgencyAiSetupModuleMeta(moduleKey);
  const requirements = (meta?.proofRequirements ?? []).map((requirement) => ({
    ...requirement,
    actualCount: getAgencyAiSetupModuleItemCount(content, requirement.key),
  }));
  const missingRequirements = requirements
    .filter((requirement) => requirement.actualCount < requirement.minCount);

  return {
    requirements,
    missingRequirements,
    readyForApproval: missingRequirements.length === 0,
  };
}

function textToRules(lines: string[]) {
  return lines.filter(Boolean).map((statement, index) => ({
    id: `rule_${index + 1}`,
    statement,
  }));
}

function textToSimpleItems(lines: string[], mode: "anti" | "example" | "edge") {
  return lines.filter(Boolean).map((line, index) => {
    if (mode === "anti") {
      return { id: `anti_${index + 1}`, statement: line };
    }
    if (mode === "example") {
      return { id: `example_${index + 1}`, title: `Example ${index + 1}`, summary: line };
    }
    return { id: `edge_${index + 1}`, condition: `Case ${index + 1}`, guidance: line };
  });
}

export function buildDefaultAgencyOperatingModuleV2(
  moduleKey: AgencyAiSetupCoreModuleKey,
  foundations?: AgencyAiSetupMetaV2["foundations"],
): AgencyOperatingModuleV2 {
  const title = getAgencyAiSetupModuleMeta(moduleKey)?.title ?? moduleKey;
  const summary = foundations?.agency_summary?.trim() || "Agency guidance pending structured definition.";
  const primaryOffer = foundations?.primary_offer?.trim() || "Primary offer";
  const primaryServices = foundations?.primary_services?.join(", ") || "Core service set";
  const icpSegments = foundations?.icp_segments?.join(", ") || "Target segments";

  const defaults: Record<AgencyAiSetupCoreModuleKey, Partial<AgencyOperatingModuleV2>> = {
    agency_identity: {
      definition: summary,
      rules: textToRules([
        `Position the agency around ${foundations?.market_position || "clear, outcome-oriented execution"}.`,
        `Focus on ${foundations?.niche_focus || "the agency's chosen niche"} and avoid generic agency language.`,
      ]),
      examples: textToSimpleItems([summary], "example") as any,
    },
    service_catalog: {
      definition: `Primary services: ${primaryServices}.`,
      rules: textToRules([
        `Default service framing should align with ${primaryServices}.`,
        "Do not invent service lines that are not approved by the agency.",
      ]),
      examples: textToSimpleItems([`Lead with: ${primaryServices}`], "example") as any,
    },
    offer_strategy: {
      definition: `Primary offer: ${primaryOffer}.`,
      rules: textToRules([
        `Optimize toward ${primaryOffer} unless the workflow explicitly says otherwise.`,
        "Surface offer constraints and avoid promising unapproved outcomes.",
      ]),
      examples: textToSimpleItems([`Use ${primaryOffer} as the main conversion anchor.`], "example") as any,
    },
    icp_segments: {
      definition: `Primary ICP segments: ${icpSegments}.`,
      rules: textToRules([
        `Prioritize these segments: ${icpSegments}.`,
        "Call out low-fit segments rather than stretching the targeting logic.",
      ]),
      examples: textToSimpleItems([`Ideal segments include ${icpSegments}.`], "example") as any,
    },
    quality_bar: {
      definition: "Outputs should be specific, commercially useful, and operationally realistic.",
      rules: textToRules([
        "Reject vague or generic recommendations.",
        "Prefer actionable outputs with one clear next step.",
        "Do not overclaim or imply guarantees without approved evidence.",
      ]),
      anti_patterns: textToSimpleItems(["Generic agency copy", "Unverifiable claims"], "anti") as any,
      examples: textToSimpleItems(["High-quality output explains tradeoffs and cites actual context."], "example") as any,
    },
    approval_matrix: {
      definition: "Strategy and creator outputs require explicit review before downstream use.",
      rules: textToRules([
        "Strategy recommendation must be approved before plan-driven workflows run.",
        "Strategy plan must be approved before creator workflows run.",
        "Escalate client-facing risk to human review.",
      ]),
      edge_cases: textToSimpleItems(["If compliance is unclear, block the action and request review."], "edge") as any,
    },
  };

  const selected = defaults[moduleKey] ?? {};

  return {
    module_key: moduleKey,
    title,
    definition: selected.definition ?? "Define the approved guidance for this module.",
    rules: (selected.rules as AgencyOperatingModuleV2["rules"]) ?? [],
    examples: (selected.examples as AgencyOperatingModuleV2["examples"]) ?? [],
    anti_patterns: (selected.anti_patterns as AgencyOperatingModuleV2["anti_patterns"]) ?? [],
    edge_cases: (selected.edge_cases as AgencyOperatingModuleV2["edge_cases"]) ?? [],
    downstream_usage: ["agency_ai_setup_v2", "strategy_engine_v2"],
    approval: {
      owner_role: "agency_owner",
      required: true,
      status: "draft",
    },
    evidence_sources: [],
    confidence: 35,
    last_reviewed_at: undefined,
  };
}
