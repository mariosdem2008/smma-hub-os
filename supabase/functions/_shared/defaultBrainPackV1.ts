export type AgencyTemplateFields = {
  agency_name: string;
  agency_website: string;
  agency_niche: string;
};

export type TemplateBrainDocument<M extends string = string> = {
  module: M;
  title: string;
  content_json: Record<string, unknown>;
};

export type BootstrapTemplateContent = {
  agency_name: string;
  niche: string;
  website: string;
  positioning: string;
  services: string[];
  ideal_client_profile: string;
  pain_points: string[];
  unique_value_proposition: string;
  target_industries: string[];
};

export type RepPolicyTemplateContent = {
  ai_name: string;
  persona: string;
  response_sla: string;
  can_do: string[];
  cannot_do: string[];
  escalation_triggers: string[];
  never_say: string[];
  response_templates: string[];
  tone_guidelines: string;
};

export type QualityBarTemplateContent = {
  review_criteria: Array<{
    criterion: string;
    weight: string;
    description: string;
  }>;
  minimum_score: string;
  critical_criteria: string[];
  non_negotiables: string[];
  revision_policy: {
    max_rounds: string;
    turnaround: string;
  };
  escalation_triggers: Array<{
    trigger: string;
    escalate_to: string;
    action: string;
  }>;
  qa_steps: string[];
};

type DefaultPackDoc =
  | { module: "bootstrap"; title: string; content_json: BootstrapTemplateContent }
  | { module: "rep_policy"; title: string; content_json: RepPolicyTemplateContent }
  | { module: "quality_bar"; title: string; content_json: QualityBarTemplateContent };

const PLACEHOLDER_MAP: Record<keyof AgencyTemplateFields, string> = {
  agency_name: "{{agency_name}}",
  agency_website: "{{agency_website}}",
  agency_niche: "{{agency_niche}}",
};

function applyStringTemplate(value: string, agencyFields: AgencyTemplateFields): string {
  let result = value;
  (Object.keys(PLACEHOLDER_MAP) as Array<keyof AgencyTemplateFields>).forEach((fieldKey) => {
    const placeholder = PLACEHOLDER_MAP[fieldKey];
    const replacement = agencyFields[fieldKey] ?? "";
    result = result.split(placeholder).join(replacement);
  });
  return result;
}

function renderTemplateValue(value: unknown, agencyFields: AgencyTemplateFields): unknown {
  if (typeof value === "string") return applyStringTemplate(value, agencyFields);
  if (Array.isArray(value)) return value.map((item) => renderTemplateValue(item, agencyFields));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    Object.keys(record).forEach((key) => {
      output[key] = renderTemplateValue(record[key], agencyFields);
    });
    return output;
  }
  return value;
}

export function renderTemplate<T>(template: T, agencyFields: AgencyTemplateFields): T {
  return renderTemplateValue(template, agencyFields) as T;
}

export const DEFAULT_BRAIN_PACK_V1: ReadonlyArray<DefaultPackDoc> = [
  {
    module: "bootstrap",
    title: "Bootstrap Profile (Default Brain Pack v1)",
    content_json: {
      agency_name: "{{agency_name}}",
      niche: "{{agency_niche}}",
      website: "{{agency_website}}",
      positioning:
        "We help clients clarify their message and execute consistent marketing and sales operations. We do not promise specific results; we focus on process, quality, and measurable iteration.",
      services: ["(Add your primary services)", "(Add your secondary services)"],
      ideal_client_profile:
        "Describe the clients you serve best (industry, size, decision-maker, budget range, and constraints). Avoid guarantees; focus on who you can help and why.",
      pain_points: ["(Add top client pain points)", "(Add common objections or blockers)"],
      unique_value_proposition:
        "In one paragraph, explain what differentiates {{agency_name}} (process, expertise, speed, communication, quality bar). Avoid hype and outcome guarantees.",
      target_industries: ["(Add target industries)", "(Optional: add verticals you have experience with)"],
    },
  },
  {
    module: "rep_policy",
    title: "Rep Policy (Default Brain Pack v1)",
    content_json: {
      ai_name: "{{agency_name}} Assistant",
      persona:
        "You are a helpful agency representative. Be concise, practical, and transparent. If information is missing, ask clarifying questions. Do not invent facts, metrics, testimonials, or client outcomes.",
      response_sla: "within_4_hours",
      can_do: [
        "Summarize and reformat existing materials provided by the agency",
        "Draft outlines, checklists, and first-pass copy with placeholders and assumptions clearly labeled",
        "Ask clarifying questions when requirements are ambiguous",
        "Propose multiple options with pros/cons and a recommended next step",
      ],
      cannot_do: [
        "Guarantee results, timelines, or performance outcomes",
        "Make legal, financial, medical, or compliance claims",
        "State client-specific facts without explicit source material",
        "Commit pricing, discounts, or contractual terms without human approval",
      ],
      escalation_triggers: [
        "Requests for guarantees, aggressive claims, or unverifiable numbers",
        "Any request involving legal/compliance/privacy decisions",
        "Requests for pricing, discounts, refunds, or contractual commitments",
        "Sensitive brand risk or crisis situations",
      ],
      never_say: [
        "We guarantee results",
        "This will definitely work for you",
        "We are the #1 agency",
        "We generated $X for clients (unless verified and provided)",
      ],
      response_templates: [
        "Thanks for reaching out ƒ?” I can help. To make sure this is accurate, can you confirm: (1) the goal, (2) the offer, and (3) the target audience?",
        "I can draft a first pass. Iƒ?Tll label assumptions and leave placeholders where details are missing.",
        "I canƒ?Tt confirm that without a source. If you share the exact numbers or proof, Iƒ?Tll incorporate them safely.",
      ],
      tone_guidelines:
        "Professional, direct, and helpful. Prefer clear structure (bullets, steps). Avoid hype, pressure tactics, or guaranteed-outcome language.",
    },
  },
  {
    module: "quality_bar",
    title: "Quality Bar (Default Brain Pack v1)",
    content_json: {
      review_criteria: [
        { criterion: "Accuracy", weight: "25", description: "No invented facts, metrics, claims, or testimonials." },
        { criterion: "Clarity", weight: "20", description: "Clear structure, plain language, and specific next steps." },
        { criterion: "Brand safety", weight: "20", description: "No guarantees; no prohibited claims; no sensitive content." },
        { criterion: "Relevance", weight: "20", description: "Matches the stated goal, audience, and offer." },
        { criterion: "Actionability", weight: "15", description: "Includes concrete steps, examples, or a checklist where appropriate." },
      ],
      minimum_score: "80",
      critical_criteria: ["Accuracy", "Brand safety"],
      non_negotiables: [
        "No guarantees of outcomes or timelines",
        "No unverified numbers, rankings, or testimonials",
        "No legal/compliance advice presented as authoritative",
        "Clearly mark assumptions and placeholders",
      ],
      revision_policy: { max_rounds: "3", turnaround: "24 hours" },
      escalation_triggers: [
        { trigger: "Legal/compliance risk", escalate_to: "Agency Admin", action: "Request human review before use." },
        { trigger: "Unverified claims requested", escalate_to: "Agency Admin", action: "Ask for sources or remove claim." },
        { trigger: "Brand crisis / sensitive topic", escalate_to: "Agency Admin", action: "Pause and request guidance." },
      ],
      qa_steps: [
        "Check for guarantees, absolute claims, and unverified numbers",
        "Confirm the goal, audience, and offer are explicitly stated",
        "Ensure assumptions/placeholders are clearly labeled",
        "Validate calls-to-action are appropriate and non-deceptive",
        "Spellcheck and format for readability",
      ],
    },
  },
] as const;

export function renderDefaultBrainPackV1(agencyFields: Partial<AgencyTemplateFields>): Array<DefaultPackDoc> {
  const normalized: AgencyTemplateFields = {
    agency_name: agencyFields.agency_name ?? "",
    agency_website: agencyFields.agency_website ?? "",
    agency_niche: agencyFields.agency_niche ?? "",
  };

  return DEFAULT_BRAIN_PACK_V1.map((doc) => ({
    module: doc.module,
    title: renderTemplate(doc.title, normalized),
    content_json: renderTemplate(doc.content_json, normalized),
  }));
}

