import type { AgencyOperatingModuleV2 } from "@/lib/strategy/v2/contracts";
import { buildDefaultAgencyOperatingModuleV2, type AgencyAiSetupCoreModuleKey } from "@/lib/agency-ai-setup-v2/modules";
import type { AgencyAiSetupMetaV2, DerivedAgencyReadiness } from "@/lib/agency-ai-setup-v2/readiness";
import type { AgencyAiSetupAgentClass } from "@/lib/agency-ai-setup-v2/config";
import type { AgencyAiSetupSimulationV2Record } from "@/hooks/useAgencyAiSetupV2";
import { STRATEGY_AI_MINIMUM_PROOF_MODULES } from "@/lib/agency-ai-setup-v2/modules";

type ApprovedDocSummary = {
  id: string;
  title: string;
  module?: string | null;
};

type AgencyProfileSummary = {
  name?: string | null;
  niche?: string | null;
  description?: string | null;
  services?: string[] | null;
};

export type StrategyAiImportPreview = {
  summary: string;
  draftLines: string[];
  evidenceNotes: string[];
  gaps: string[];
  nextAction: string;
};

export type AgencyAiSetupStrategyTemplateKey =
  | "general_service"
  | "local_service"
  | "ecommerce"
  | "info_product"
  | "regulated";

export type AgencyAiSetupStrategyTemplate = {
  key: AgencyAiSetupStrategyTemplateKey;
  title: string;
  summary: string;
  bestFor: string;
  firstFocus: string;
  draft_content: {
    agency_summary: string;
    niche_focus: string;
    service_model: string;
    market_position: string;
    primary_services: string[];
    primary_offer: string;
    secondary_offers: string[];
    icp_segments: string[];
    guardrails: {
      quality_review_standard: string;
      creative_rules: string[];
      banned_claims: string[];
      required_disclaimers: string[];
      escalation_triggers: string[];
    };
  };
  foundations: {
    agencySummary: string;
    nicheFocus: string;
    serviceModel: string;
    marketPosition: string;
    primaryServices: string;
    primaryOffer: string;
    secondaryOffers: string;
    icpSegments: string;
  };
};

function compact(value: Array<string | null | undefined>) {
  return value.map((item) => item?.trim()).filter(Boolean) as string[];
}

function uniqueStrings(value: string[]) {
  return Array.from(new Set(value.filter(Boolean)));
}

function toRules(lines: string[]) {
  return uniqueStrings(lines).map((statement, index) => ({
    id: `rule_${index + 1}`,
    statement,
  }));
}

function toExamples(lines: string[]) {
  return uniqueStrings(lines).map((summary, index) => ({
    id: `example_${index + 1}`,
    title: `Example ${index + 1}`,
    summary,
  }));
}

function toAntiPatterns(lines: string[]) {
  return uniqueStrings(lines).map((statement, index) => ({
    id: `anti_${index + 1}`,
    statement,
  }));
}

function toEdgeCases(lines: string[]) {
  return uniqueStrings(lines).map((guidance, index) => ({
    id: `edge_${index + 1}`,
    condition: `Case ${index + 1}`,
    guidance,
  }));
}

function toEvidenceSources(docs: ApprovedDocSummary[], fallbackLabels: string[] = []) {
  const approvedSources = docs.slice(0, 5).map((doc) => ({
    type: "approved_brain_document" as const,
    ref_id: doc.id,
    label: doc.title,
  }));
  const fallbackSources = uniqueStrings(fallbackLabels)
    .slice(0, 5)
    .map((label, index) => ({
      type: "manual_note" as const,
      ref_id: `seed_${index + 1}`,
      label,
    }));

  return [...approvedSources, ...fallbackSources].slice(0, 5);
}

function titleCase(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function mergeUniqueStrings(primary: string[] = [], secondary: string[] = []) {
  return uniqueStrings([...primary, ...secondary].map((item) => item.trim()).filter(Boolean));
}

function enrichDraftText(base: string, additions: string[]) {
  const joinedAdditions = compact(additions);
  if (!joinedAdditions.length) return base.trim();
  return [base.trim(), joinedAdditions.join(" ")].filter(Boolean).join(" ").trim();
}

export function buildSuggestedAgencyOperatingModuleDraft(
  moduleKey: AgencyAiSetupCoreModuleKey,
  meta: AgencyAiSetupMetaV2,
  approvedDocs: ApprovedDocSummary[] = [],
): AgencyOperatingModuleV2 {
  const base = buildDefaultAgencyOperatingModuleV2(moduleKey, meta.foundations);
  const foundations = meta.foundations ?? {};
  const guardrails = meta.guardrails ?? {};
  const workflow = meta.workflow ?? {};
  const sharedEvidence = compact([
    meta.imports?.imported_at ? "Imported agency profile context was accepted during guided setup." : null,
    foundations.agency_summary ? `Agency summary reviewed: ${foundations.agency_summary}` : null,
    foundations.primary_offer ? `Primary offer confirmed: ${foundations.primary_offer}` : null,
    guardrails.quality_review_standard ? "Quality review standard was imported into guardrails." : null,
    guardrails.client_facing_restrictions?.length ? "Client-facing restrictions were imported into guardrails." : null,
    workflow.approval_classes?.length ? `Approval classes confirmed: ${workflow.approval_classes.join(", ")}.` : null,
  ]);

  if (moduleKey === "agency_identity") {
    const definition = compact([
      foundations.agency_summary,
      foundations.market_position ? `Position the agency as ${foundations.market_position}.` : null,
      foundations.niche_focus ? `Stay focused on ${foundations.niche_focus}.` : null,
    ]).join(" ");
    return {
      ...base,
      definition: definition || base.definition,
      rules: toRules([
        foundations.market_position ? `Frame the agency as ${foundations.market_position}.` : null,
        foundations.niche_focus ? `Keep the positioning specific to ${foundations.niche_focus}.` : null,
        foundations.service_model ? `Assume the delivery model is ${foundations.service_model}.` : null,
        foundations.primary_offer ? `Anchor agency framing around the main offer: ${foundations.primary_offer}.` : null,
      ]),
      examples: toExamples([
        foundations.agency_summary || "",
        foundations.primary_offer ? `Lead with the primary offer: ${foundations.primary_offer}.` : "",
      ]),
      anti_patterns: toAntiPatterns([
        "Do not describe the agency as a generic full-service provider unless that is explicitly true.",
      ]),
      evidence_sources: toEvidenceSources(approvedDocs, sharedEvidence),
      confidence: Math.max(base.confidence, approvedDocs.length ? 55 : 45),
    };
  }

  if (moduleKey === "service_catalog") {
    const primaryServices = foundations.primary_services?.length ? foundations.primary_services.join(", ") : null;
    return {
      ...base,
      definition: compact([
        primaryServices ? `Primary services: ${primaryServices}.` : null,
        foundations.service_model ? `Current delivery model: ${foundations.service_model}.` : null,
      ]).join(" ") || base.definition,
      rules: toRules([
        primaryServices ? `Prioritize ${primaryServices} in service framing.` : null,
        foundations.secondary_offers?.length ? `Only mention secondary offers when relevant: ${foundations.secondary_offers.join(", ")}.` : null,
        "Do not invent service lines that are not explicitly approved by the agency.",
        foundations.niche_focus ? `Keep service framing aligned to ${foundations.niche_focus}.` : null,
      ]),
      examples: toExamples([
        primaryServices ? `Approved service framing starts with ${primaryServices}.` : "",
        foundations.primary_offer ? `Connect the service set back to ${foundations.primary_offer}.` : "",
      ]),
      anti_patterns: toAntiPatterns([
        "Avoid vague service language like marketing support, digital help, or growth services without specifics.",
      ]),
      evidence_sources: toEvidenceSources(approvedDocs, sharedEvidence),
      confidence: Math.max(base.confidence, approvedDocs.length ? 55 : 45),
    };
  }

  if (moduleKey === "offer_strategy") {
    const definition = compact([
      foundations.primary_offer ? `Primary offer: ${foundations.primary_offer}.` : null,
      foundations.secondary_offers?.length ? `Secondary offers: ${foundations.secondary_offers.join(", ")}.` : null,
      foundations.service_model ? `Delivery model: ${foundations.service_model}.` : null,
    ]).join(" ");
    return {
      ...base,
      definition: definition || base.definition,
      rules: toRules([
        foundations.primary_offer ? `Optimize recommendations around ${foundations.primary_offer}.` : null,
        foundations.secondary_offers?.length ? `Treat ${foundations.secondary_offers.join(", ")} as secondary unless the context clearly calls for them.` : null,
        "Never position an unapproved offer as the commercial priority.",
        foundations.market_position ? `Position the offer through the agency advantage: ${foundations.market_position}.` : null,
        foundations.niche_focus ? `Qualify fit against ${foundations.niche_focus} before recommending the offer.` : null,
      ]),
      examples: toExamples([
        foundations.primary_offer ? `Lead with ${foundations.primary_offer} as the main commercial path.` : "",
        foundations.icp_segments?.[0]
          ? `For ${foundations.icp_segments[0]}, frame the offer as the clearest path to the desired result.`
          : "",
      ]),
      anti_patterns: toAntiPatterns([
        "Do not present every offer as equally important.",
      ]),
      evidence_sources: toEvidenceSources(approvedDocs, sharedEvidence),
      confidence: Math.max(base.confidence, approvedDocs.length ? 60 : 45),
    };
  }

  if (moduleKey === "icp_segments") {
    return {
      ...base,
      definition:
        foundations.icp_segments?.length
          ? `Ideal client segments: ${foundations.icp_segments.join(", ")}.`
          : base.definition,
      rules: toRules([
        foundations.icp_segments?.length ? `Prefer these ICP segments: ${foundations.icp_segments.join(", ")}.` : null,
        foundations.niche_focus ? `Stay aligned with the niche focus: ${foundations.niche_focus}.` : null,
        "Call out low-fit audiences instead of stretching the targeting logic to everyone.",
        foundations.primary_offer ? `Only recommend ${foundations.primary_offer} where the ICP and offer fit are obvious.` : null,
      ]),
      examples: toExamples([
        foundations.icp_segments?.length ? `A high-fit client looks like ${foundations.icp_segments[0]}.` : "",
      ]),
      anti_patterns: toAntiPatterns([
        "Avoid broad market labels like healthcare, ecommerce, or local business without segment detail.",
      ]),
      evidence_sources: toEvidenceSources(approvedDocs, sharedEvidence),
      confidence: Math.max(base.confidence, approvedDocs.length ? 55 : 45),
    };
  }

  if (moduleKey === "quality_bar") {
    return {
      ...base,
      definition:
        guardrails.quality_review_standard?.trim()
          ? guardrails.quality_review_standard
          : base.definition,
      rules: toRules([
        guardrails.quality_review_standard || null,
        ...(guardrails.creative_rules ?? []).map((item) => `Creative rule: ${item}`),
        "Reject outputs that feel generic, vague, or commercially weak.",
      ]),
      examples: toExamples([
        guardrails.quality_review_standard
          ? `A strong output meets this standard: ${guardrails.quality_review_standard}`
          : "",
        foundations.market_position
          ? `Strong work should sound like a ${foundations.market_position} rather than a generic agency.`
          : "",
      ]),
      anti_patterns: toAntiPatterns([
        ...(guardrails.banned_claims ?? []).map((item) => `Never allow: ${item}`),
        "Do not approve fluff, hype, or filler wording.",
      ]),
      edge_cases: toEdgeCases([
        ...(guardrails.escalation_triggers ?? []).map((item) => `Escalate when ${item}.`),
      ]),
      evidence_sources: toEvidenceSources(approvedDocs, [
        ...sharedEvidence,
        guardrails.quality_review_standard
          ? `Quality bar is grounded in this review standard: ${guardrails.quality_review_standard}`
          : null,
      ].filter(Boolean) as string[]),
      confidence: Math.max(base.confidence, approvedDocs.length || guardrails.quality_review_standard ? 65 : 45),
    };
  }

  return {
    ...base,
    definition:
      compact([
        workflow.approval_classes?.length ? "Approval logic and workflow checkpoints for governed AI execution." : null,
        workflow.lifecycle_stages?.length ? `Key stages: ${workflow.lifecycle_stages.slice(0, 3).join(", ")}.` : null,
      ]).join(" ") || base.definition,
    rules: toRules([
      "Strategy recommendations must be reviewed by a human before any downstream action.",
      ...(workflow.approval_classes ?? []).map((item) => `Approval class: ${item}`),
      ...(workflow.lifecycle_stages ?? []).slice(0, 3).map((item) => `Lifecycle stage in scope: ${item}`),
      ...(guardrails.client_facing_restrictions ?? []).map((item) => `Blocked without review: ${item}`),
    ]),
    edge_cases: toEdgeCases([
      ...(workflow.escalation_rules ?? []).map((item) => item),
      ...(guardrails.escalation_triggers ?? []).map((item) => `Escalate when ${item}.`),
    ]),
    examples: toExamples([
      workflow.approval_classes?.[0]
        ? `A governed output follows the ${workflow.approval_classes[0]} approval class before it moves forward.`
        : "",
      workflow.lifecycle_stages?.[0]
        ? `The workflow starts at ${workflow.lifecycle_stages[0]} and only advances after review.`
        : "",
    ]),
    evidence_sources: toEvidenceSources(approvedDocs, [
      ...sharedEvidence,
      "Client-facing outputs are blocked until a human review is complete.",
    ]),
    confidence: Math.max(base.confidence, approvedDocs.length || workflow.approval_classes?.length ? 60 : 45),
  };
}

export function strengthenSetupTextarea(current: string, starter: string, guidance: string) {
  const trimmed = current.trim();
  if (!trimmed) return starter;
  if (trimmed.length >= 140) return trimmed;
  return `${trimmed} ${guidance}`.trim();
}

export function strengthenSetupList(current: string, fallbackItems: string[]) {
  const existing = current
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return uniqueStrings([...existing, ...fallbackItems]).join(", ");
}

export function buildStrategyAiImportPreview(input: {
  agencyName?: string | null;
  niche?: string | null;
  approvedDocs?: ApprovedDocSummary[];
}) {
  const approvedDocs = input.approvedDocs ?? [];
  const summary = input.niche?.trim()
    ? `Strategy AI can draft a first positioning baseline for ${input.agencyName || "your agency"} around ${input.niche}.`
    : `Strategy AI can draft a first internal strategy baseline for ${input.agencyName || "your agency"} from the evidence already in the workspace.`;

  const draftLines = compact([
    input.niche ? `Lead with the agency's core niche: ${input.niche}.` : "Lead with the agency's clearest niche and buyer fit.",
    approvedDocs.length ? `Use ${approvedDocs.length} approved brain document${approvedDocs.length === 1 ? "" : "s"} as the first proof base.` : null,
    approvedDocs[0]?.module ? `Start module drafting from the strongest existing evidence in ${approvedDocs[0].module}.` : null,
  ]);

  const evidenceNotes = compact([
    input.agencyName ? `${input.agencyName} profile data will seed identity and positioning drafts.` : null,
    approvedDocs.length ? `Approved documents will seed rules, examples, and anti-patterns instead of forcing blank setup.` : null,
  ]);

  const gaps = compact([
    !input.niche ? "Your niche positioning still needs confirmation or tightening." : null,
    !approvedDocs.length ? "No approved brain documents are available yet, so early drafts will stay thin." : null,
  ]);

  return {
    summary,
    draftLines,
    evidenceNotes,
    gaps,
    nextAction: "Import this context, then review the foundations draft before touching the full module system.",
  } satisfies StrategyAiImportPreview;
}

export function applyTemplateDraftToMeta(
  currentMeta: AgencyAiSetupMetaV2,
  templateKey: string,
  agencyProfile: AgencyProfileSummary | null,
  approvedDocs: ApprovedDocSummary[],
): AgencyAiSetupMetaV2 {
  const template = getAgencyAiSetupStrategyTemplate(templateKey as AgencyAiSetupStrategyTemplateKey);
  const foundationSeed = template.draft_content;
  const existingFoundations = currentMeta.foundations ?? {};
  const existingGuardrails = currentMeta.guardrails ?? {};
  const profileDescription =
    agencyProfile?.description?.trim() ||
    (agencyProfile?.name
      ? `${agencyProfile.name} uses Strategy AI as a governed operating layer for sharper strategy recommendations and internal team support.`
      : null);
  const docTitles = approvedDocs.map((doc) => doc.title).filter(Boolean);
  const docModules = approvedDocs
    .map((doc) => doc.module)
    .filter(Boolean)
    .map((module) => titleCase(String(module)));

  return {
    ...currentMeta,
    guided_strategy_template_key: template.key,
    foundations: {
      ...existingFoundations,
      agency_summary: enrichDraftText(
        existingFoundations.agency_summary?.trim() || profileDescription || foundationSeed.agency_summary,
        docTitles.length ? [`Approved context already exists in ${docTitles.slice(0, 2).join(" and ")}.`] : [],
      ),
      niche_focus: existingFoundations.niche_focus?.trim() || agencyProfile?.niche?.trim() || foundationSeed.niche_focus,
      service_model: enrichDraftText(
        existingFoundations.service_model?.trim() || foundationSeed.service_model,
        docModules.length ? [`Existing documentation also touches ${docModules.slice(0, 2).join(" and ")}.`] : [],
      ),
      market_position: enrichDraftText(
        existingFoundations.market_position?.trim() || foundationSeed.market_position,
        agencyProfile?.name ? [`This should still sound recognizably like ${agencyProfile.name}.`] : [],
      ),
      primary_services: mergeUniqueStrings(
        existingFoundations.primary_services,
        agencyProfile?.services?.length ? agencyProfile.services : foundationSeed.primary_services,
      ),
      primary_offer: existingFoundations.primary_offer?.trim() || foundationSeed.primary_offer,
      secondary_offers: mergeUniqueStrings(existingFoundations.secondary_offers, foundationSeed.secondary_offers),
      icp_segments: mergeUniqueStrings(existingFoundations.icp_segments, foundationSeed.icp_segments),
    },
    guardrails: {
      ...existingGuardrails,
      quality_review_standard:
        existingGuardrails.quality_review_standard?.trim() || foundationSeed.guardrails.quality_review_standard,
      creative_rules: mergeUniqueStrings(existingGuardrails.creative_rules, foundationSeed.guardrails.creative_rules),
      banned_claims: mergeUniqueStrings(existingGuardrails.banned_claims, foundationSeed.guardrails.banned_claims),
      required_disclaimers: mergeUniqueStrings(
        existingGuardrails.required_disclaimers,
        foundationSeed.guardrails.required_disclaimers,
      ),
      escalation_triggers: mergeUniqueStrings(
        existingGuardrails.escalation_triggers,
        foundationSeed.guardrails.escalation_triggers,
      ),
      client_facing_restrictions: mergeUniqueStrings(existingGuardrails.client_facing_restrictions, [
        "Do not publish anything client-facing without human review.",
        "Escalate risky claims, pricing promises, and compliance-sensitive output.",
      ]),
    },
  };
}

export interface AgencyAiSetupCheckpointSnapshot {
  milestoneLabel: string;
  reliableNow: string;
  stillWeak: string;
  nextAction: string;
  updatedNote: string;
}

export type AgencyAiSetupCheckpointStageKey = "imports" | "foundations" | "modules" | "guardrails" | "workflow";

export const AGENCY_AI_SETUP_STRATEGY_TEMPLATES: AgencyAiSetupStrategyTemplate[] = [
  {
    key: "general_service",
    title: "General Service Agency",
    summary: "Best for agencies serving service businesses without a narrow vertical yet.",
    bestFor: "Broad but still service-led agencies that need a clean first Strategy AI baseline fast.",
    firstFocus: "Clarify who you serve, which offer matters most, and what generic positioning to avoid.",
    draft_content: {
      agency_summary:
        "We are a full-service digital marketing agency that helps B2B and B2C service businesses grow through strategic content marketing, paid media, email marketing, and conversion optimization. Our clients range from professional services firms to SaaS companies to healthcare practices. We focus on building marketing systems that generate qualified pipeline, not just traffic.",
      niche_focus:
        "Service-based businesses that sell expertise, not products. Our sweet spot is companies with $1M-$20M revenue that have outgrown DIY marketing but are not yet ready for a full in-house team.",
      service_model:
        "Project-based and retainer engagements. Projects include brand strategy, website builds, and campaign launches. Retainers cover ongoing content, paid media management, email, and monthly strategy calls. Average retainer is $3,000-$8,000/month with quarterly strategy reviews.",
      market_position:
        "We differentiate through strategy depth. Every engagement starts with a documented marketing strategy before any execution begins. We attract clients who have been burned by agencies that jumped straight to tactics without understanding the business.",
      primary_services: [
        "Marketing strategy and planning",
        "Content marketing (blog, social, video)",
        "Paid media (Google, Meta, LinkedIn)",
        "Email marketing and automation",
        "Website design and conversion optimization",
      ],
      primary_offer:
        "Growth Retainer: monthly marketing execution with dedicated strategist, content calendar, paid media management, and performance dashboard.",
      secondary_offers: [
        "Strategy Sprint: 2-week deep-dive into positioning, ICP, and channel plan",
        "Website Relaunch: full redesign with conversion-optimized messaging and structure",
      ],
      icp_segments: [
        "B2B professional services firm, $2M-$15M revenue, 10-50 employees, has a sales team but marketing is ad hoc, wants a repeatable pipeline generation system",
        "Growing SaaS or tech-enabled service, $1M-$5M ARR, marketing is founder-led, needs to build a marketing function without hiring a full team",
      ],
      guardrails: {
        quality_review_standard:
          "All content must demonstrate understanding of the client's industry and audience. No filler paragraphs. Every piece must have a clear purpose in the funnel. Data claims must link to sources. CTAs must be specific to the content context, not generic.",
        creative_rules: [
          "Lead with the audience's problem, not the client's product",
          "Use industry-specific terminology appropriate to the client's audience",
          "Every blog post must have a documented SEO target keyword",
          "Social posts must be adapted per platform, not cross-posted identically",
          "Video scripts must have a hook in the first 5 seconds",
        ],
        banned_claims: [
          "Guaranteed ROI or revenue increase",
          "We are the #1 agency in [category]",
          "#1 ranked for [keyword] (unless current and verifiable)",
          "Results in 30 days (unless scoped to a specific deliverable)",
          "Award-winning (unless award and year specified)",
        ],
        required_disclaimers: [
          "Past results do not guarantee future performance",
          "Timeline estimates are based on typical engagements and may vary",
        ],
        escalation_triggers: [
          "Client requests claims about competitors that cannot be verified",
          "Content topic involves regulated industry claims (health, finance, legal)",
          "Client wants to publish without review cycle completion",
          "Budget change exceeds 25% of agreed scope",
        ],
      },
    },
    foundations: {
      agencySummary:
        "We help service-based businesses turn social media into structured demand generation through strategy, creative direction, and consistent execution.",
      nicheFocus: "Service-based businesses that need operator-grade social media systems",
      serviceModel: "Done-for-you retainer with strategy, approvals, and monthly execution",
      marketPosition:
        "Operator-led specialist agency focused on commercially useful strategy and consistent execution rather than generic content output.",
      primaryServices: "social media strategy, content planning, creative direction, monthly management",
      primaryOffer: "Monthly social media growth system",
      secondaryOffers: "strategy intensives, reporting and optimization, launch support",
      icpSegments: "local service brands, multi-location service businesses, premium small businesses",
    },
  },
  {
    key: "local_service",
    title: "Local Service Growth",
    summary: "For agencies helping local and multi-location service businesses generate leads.",
    bestFor: "Dentists, med spas, clinics, gyms, home services, legal, and other local operators.",
    firstFocus: "Lead quality, bookings, geographic targeting, and proof-based local positioning.",
    draft_content: {
      agency_summary:
        "We are a local service marketing agency that helps home service businesses generate consistent local leads through Google Business Profile optimization, local SEO, paid search, and reputation management. Our clients are typically owner-operators or small teams serving a defined metro area. We focus on measurable lead volume, cost-per-lead efficiency, and review generation as primary success metrics.",
      niche_focus:
        "Home services and local trades businesses operating in defined metro areas. Our ideal clients have been in business 2+ years, serve residential customers, and want to grow from word-of-mouth to a predictable marketing system.",
      service_model:
        "Monthly retainer model with 3 tiers. All tiers include Google Business Profile management and monthly reporting. Mid-tier adds local SEO and review management. Top tier adds paid search management and landing pages. Typical engagement is 6-12 months with 90-day initial commitment.",
      market_position:
        "We compete on local specialization and lead transparency. Unlike generalist agencies, we only work with home service businesses, which means our playbooks, ad templates, and reporting are pre-built for this vertical. Every lead is tracked and attributed so the client knows exactly what they're paying for.",
      primary_services: [
        "Google Business Profile optimization and management",
        "Local SEO and map pack ranking",
        "Google Ads (local search campaigns)",
        "Review generation and reputation management",
        "Monthly performance reporting",
      ],
      primary_offer:
        "Local Lead Engine: monthly retainer that combines GBP optimization, local SEO, and paid search to deliver 30-50+ trackable local leads per month.",
      secondary_offers: [
        "Reputation Rescue: review response + generation sprint for businesses under 4.0 stars",
        "Local Launch Pack: one-time setup for new businesses entering a market",
      ],
      icp_segments: [
        "Owner-operated home service business, $500K-$3M revenue, 1-15 employees, serving residential customers in one metro area, currently relying on referrals and want predictable lead flow",
        "Multi-location home service company, $2M-$10M revenue, 3-5 locations, wants consistent lead generation across all locations with centralized reporting",
      ],
      guardrails: {
        quality_review_standard:
          "All content must reference the specific service area and service type. No generic 'we are the best' claims. Every ad and landing page must have a clear call-to-action with phone number and form. Review responses must be professional, acknowledge the feedback, and never argue with the reviewer.",
        creative_rules: [
          "Always include city or metro name in headlines and meta titles",
          "Use specific service names, never generic 'home services'",
          "Include real response time or availability claims only if verified",
          "Photos must be real job photos or team photos, never stock images",
          "All landing pages must load in under 3 seconds",
        ],
        banned_claims: [
          "Guaranteed #1 ranking on Google",
          "Cheapest service in [city]",
          "Emergency service available 24/7 (unless verified)",
          "Licensed and insured (unless license number provided)",
          "Satisfaction guaranteed or money back (unless client policy confirms)",
        ],
        required_disclaimers: [
          "Results vary by market and competition level",
          "Lead volume estimates based on comparable campaigns, not guaranteed",
        ],
        escalation_triggers: [
          "Client requests content that claims professional licensing without proof",
          "Campaign is spending more than 20% over agreed monthly budget",
          "Client asks to publish negative content about a competitor",
          "Review response involves a legal complaint or threat",
        ],
      },
    },
    foundations: {
      agencySummary:
        "We help local service businesses turn social content and local authority positioning into booked consultations and inbound demand.",
      nicheFocus: "Local and multi-location service businesses",
      serviceModel: "Done-for-you local growth retainer with approvals and monthly execution",
      marketPosition:
        "Lead-generation-focused specialist agency for local service brands that need commercially useful social strategy, not vanity content.",
      primaryServices: "local social strategy, content planning, short-form production, monthly management",
      primaryOffer: "Monthly local demand-generation system",
      secondaryOffers: "offer refinement, launch campaigns, reporting and optimization",
      icpSegments: "dentists, med spas, boutique fitness studios, home service businesses",
    },
  },
  {
    key: "ecommerce",
    title: "Ecommerce Brand Growth",
    summary: "For agencies driving product discovery, conversions, and repeat demand for ecommerce brands.",
    bestFor: "DTC, lifestyle, beauty, apparel, and product-led brands with ongoing content and offer cycles.",
    firstFocus: "Offer hierarchy, campaign hooks, product proof, and conversion-aware content strategy.",
    draft_content: {
      agency_summary:
        "We are an ecommerce marketing agency that helps DTC and online retail brands scale revenue through paid social, Google Shopping, email and SMS marketing, and conversion rate optimization. Our clients sell physical products through Shopify, WooCommerce, or custom storefronts. We optimize the full funnel from first click to repeat purchase.",
      niche_focus:
        "Direct-to-consumer and online retail brands doing $500K-$20M in annual online revenue. We work best with brands that have product-market fit and want to scale efficiently, not brands still searching for their first customers.",
      service_model:
        "Performance-based retainers with transparent ROAS reporting. All retainers include paid media management, creative strategy, and monthly performance reviews. Higher tiers add email and SMS flows, landing page optimization, and creative production. Typical engagement is month-to-month after 90-day onboarding period.",
      market_position:
        "We compete on full-funnel accountability. We manage paid acquisition, retention, and conversion optimization together because optimizing one channel in isolation leaves money on the table. Clients get one dashboard showing true customer acquisition cost and lifetime value.",
      primary_services: [
        "Paid social advertising (Meta, TikTok, Pinterest)",
        "Google Shopping and Performance Max campaigns",
        "Email and SMS marketing (Klaviyo, Attentive)",
        "Conversion rate optimization and A/B testing",
        "Creative strategy and ad creative production",
      ],
      primary_offer:
        "Growth Engine: full-funnel management covering paid acquisition, email or SMS retention, and CRO with unified ROAS reporting and creative refresh cycles.",
      secondary_offers: [
        "Launch Sprint: 4-week campaign setup for new product launches or seasonal pushes",
        "Retention Rescue: email or SMS audit and rebuild for brands with low repeat purchase rates",
      ],
      icp_segments: [
        "DTC brand, $1M-$10M annual revenue, strong product but plateauing growth, currently running Meta ads in-house with declining ROAS, wants professional media buying and full-funnel strategy",
        "Online retail brand, $3M-$20M annual revenue, selling on Shopify, needs to reduce CAC and increase repeat purchase rate through email or SMS and better landing pages",
      ],
      guardrails: {
        quality_review_standard:
          "All ad creative must be scroll-stopping in the first 1-2 seconds. Product claims must match the actual product page. Price and promotion accuracy is mandatory. Email and SMS must respect sending frequency limits and include easy unsubscribe. Landing pages must match ad messaging exactly.",
        creative_rules: [
          "Ad creative must show the product in use, not just product shots",
          "UGC-style ads must disclose if the creator was compensated",
          "Promotional pricing must match what's on the product page at time of publish",
          "Email subject lines must not use deceptive urgency",
          "All A/B tests must run long enough to avoid premature winner calls",
        ],
        banned_claims: [
          "Best-selling product (unless verified sales data supports it)",
          "Clinically proven (unless clinical study exists and is cited)",
          "Limited stock / Almost sold out (unless inventory system confirms)",
          "Free shipping (unless it applies to the specific offer)",
          "Before/after results (unless real and with consent)",
        ],
        required_disclaimers: [
          "Ad spend results vary by product, audience, and market conditions",
          "Testimonials reflect individual results and are not typical",
        ],
        escalation_triggers: [
          "ROAS drops below agreed minimum threshold for 7+ consecutive days",
          "Client requests health, safety, or efficacy claims without documentation",
          "Promotion dates or pricing don't match what's live on the store",
          "Client wants to exceed agreed SMS frequency limits",
          "Creative uses customer content without verified permission",
        ],
      },
    },
    foundations: {
      agencySummary:
        "We help ecommerce brands turn product stories, campaigns, and creative systems into stronger conversion and repeat demand.",
      nicheFocus: "Ecommerce and DTC brands",
      serviceModel: "Retained strategy and creative execution for ongoing campaigns and growth",
      marketPosition:
        "Conversion-aware ecommerce strategy partner focused on campaign usefulness, product proof, and repeatable creative systems.",
      primaryServices: "campaign strategy, content systems, creative direction, monthly channel management",
      primaryOffer: "Ongoing ecommerce content and campaign growth system",
      secondaryOffers: "launch support, creative testing, retention campaigns",
      icpSegments: "DTC brands, lifestyle ecommerce, premium product brands",
    },
  },
  {
    key: "info_product",
    title: "Info Product And Coaching",
    summary: "For agencies helping experts, coaches, and education brands turn content into pipeline.",
    bestFor: "Coaches, consultants, course creators, experts, communities, and info-product offers.",
    firstFocus: "Authority positioning, conversion path clarity, and offer-led content sequencing.",
    draft_content: {
      agency_summary:
        "We are a digital marketing agency that helps course creators, coaches, and info-product businesses generate leads and sales through content funnels, paid advertising, email sequences, and webinar or launch campaigns. Our clients monetize their expertise through online courses, group programs, memberships, and high-ticket coaching. We specialize in the full launch cycle from audience building to conversion.",
      niche_focus:
        "Online educators, coaches, and info-product creators earning $200K-$5M annually. We work best with creators who have a proven offer and existing audience, and want to systematize their marketing instead of launching from scratch every time.",
      service_model:
        "Launch-based and evergreen retainer models. Launch clients get full campaign management for 6-8 week launch windows. Evergreen clients get ongoing funnel management, ad spend optimization, and email nurture sequences. All clients get weekly performance calls during active campaigns.",
      market_position:
        "We understand the creator economy launch model. Unlike generalist agencies, we know how to structure webinar funnels, challenge campaigns, and application funnels because that is all we do. Our clients choose us because we speak their language and have benchmarks from many similar launches.",
      primary_services: [
        "Launch campaign management (webinar, challenge, application funnels)",
        "Paid advertising for lead generation (Meta, YouTube, TikTok)",
        "Email sequence copywriting and automation",
        "Landing page and sales page optimization",
        "Evergreen funnel management and optimization",
      ],
      primary_offer:
        "Launch Partner: full-service launch management covering ad creative, landing pages, email sequences, webinar support, and cart-open campaigns.",
      secondary_offers: [
        "Evergreen Engine: ongoing funnel management that generates leads and sales between launches",
        "Audience Builder: 90-day paid traffic campaign to grow email list and warm audience for the next launch",
      ],
      icp_segments: [
        "Established course creator, $500K-$3M annual revenue, has a flagship course or program, launches 2-4 times per year, wants to increase launch revenue and reduce personal involvement in campaign execution",
        "High-ticket coach, $200K-$2M annual revenue, sells through application funnels, wants a steady flow of qualified applications without running ads themselves",
      ],
      guardrails: {
        quality_review_standard:
          "All marketing must accurately represent the program content and expected outcomes. Testimonials must be real and include context. Scarcity and urgency must be genuine. Webinar content must deliver real value, not just a sales pitch. Email sequences must respect unsubscribe and frequency rules.",
        creative_rules: [
          "Income or result claims must include specific context and disclaimer",
          "Testimonials must be from real students or clients with verifiable identity",
          "Scarcity must be genuine",
          "Webinar ads must accurately describe what attendees will learn",
          "Sales pages must clearly state what is and is not included in the offer",
        ],
        banned_claims: [
          "Make $X in Y days (unless verifiable and with disclaimer)",
          "Guaranteed results or money-back (unless refund policy is real and cited)",
          "No experience needed (if the program actually requires prerequisites)",
          "This is the last time we're offering this (if you plan to offer it again)",
          "Spots are almost gone (unless enrollment cap is real and verified)",
        ],
        required_disclaimers: [
          "Results vary and depend on individual effort and circumstances",
          "Testimonials represent individual experiences and are not typical results",
          "Income claims are not guarantees of earnings",
        ],
        escalation_triggers: [
          "Client wants to use income claims without documentation",
          "Testimonial cannot be verified",
          "Client requests fake scarcity for a non-limited offer",
          "FTC or platform compliance concern about earnings claims",
          "Client wants to extend a deadline marketed as final",
        ],
      },
    },
    foundations: {
      agencySummary:
        "We help coaches, consultants, and education brands turn authority content into booked calls, applications, and offer demand.",
      nicheFocus: "Experts, coaches, consultants, and education brands",
      serviceModel: "Strategy-led retainer with approvals, content planning, and ongoing execution",
      marketPosition:
        "Authority-to-pipeline specialist focused on content that drives trust, intent, and sales conversations instead of generic engagement.",
      primaryServices: "authority strategy, content planning, offer positioning, monthly execution",
      primaryOffer: "Ongoing authority content and pipeline system",
      secondaryOffers: "launch campaigns, offer messaging intensives, funnel alignment",
      icpSegments: "coaches, consultants, course creators, info-product brands",
    },
  },
  {
    key: "regulated",
    title: "Regulated Or High-Risk Messaging",
    summary: "For agencies where claims, approvals, and safe language are central to strategy quality.",
    bestFor: "Healthcare, finance, legal, compliance-heavy wellness, and high-risk categories.",
    firstFocus: "Approval rules, safe claims boundaries, escalation, and proof-backed messaging.",
    draft_content: {
      agency_summary:
        "We are a specialized marketing agency that serves businesses in regulated industries such as healthcare, financial services, legal, and insurance. We help these businesses grow while maintaining strict compliance with industry advertising regulations. Every piece of content goes through a compliance review process before publication.",
      niche_focus:
        "Businesses in healthcare, financial services, and legal that face advertising restrictions generalist agencies do not understand and need compliance built into the process.",
      service_model:
        "Compliance-first retainer model. Every engagement includes a compliance audit of existing marketing materials as the first deliverable. Ongoing retainers include content creation, paid media, and mandatory compliance review cycles. All content is reviewed against industry-specific checklists before client approval.",
      market_position:
        "We are the agency that regulated businesses trust because we build compliance into the process, not bolt it on at the end. Our team uses compliance-trained review standards so clients can grow without compliance risk.",
      primary_services: [
        "Compliance-audited content marketing",
        "Paid media with regulatory-compliant ad copy",
        "Website design meeting accessibility and compliance standards",
        "Email marketing with opt-in and consent management",
        "Reputation management and compliant review solicitation",
      ],
      primary_offer:
        "Compliant Growth Retainer: monthly marketing execution with built-in compliance review for every deliverable, regulatory monitoring, and quarterly compliance audits.",
      secondary_offers: [
        "Compliance Audit: one-time review of all existing marketing materials against current regulations",
        "Regulated Launch: compliant campaign build for new practice locations or service lines",
      ],
      icp_segments: [
        "Healthcare practice, $1M-$10M revenue, wants to grow patient volume through marketing but needs an agency that handles compliance proactively",
        "Financial advisor or RIA, $500K-$5M revenue, wants digital lead generation but needs all content to pass compliance review",
      ],
      guardrails: {
        quality_review_standard:
          "Every piece of content must pass a documented compliance checklist for the client's specific industry and jurisdiction before entering the approval queue. No content is published without both creative review and compliance review sign-off. Claims must be supported by cited sources.",
        creative_rules: [
          "All healthcare content must be reviewed for HIPAA-sensitive language",
          "Financial content must not constitute investment advice unless the client is licensed to give it",
          "Legal content must include jurisdiction-specific disclaimers",
          "Before/after photos require documented patient or client consent",
          "All claims must cite specific, verifiable sources",
        ],
        banned_claims: [
          "Guaranteed outcomes for any medical, legal, or financial service",
          "Specific investment returns or financial projections",
          "Best doctor/lawyer/advisor in [area] (unless based on verified award)",
          "Patient testimonials that imply guaranteed outcomes",
          "Free consultation (if there are limitations not clearly stated)",
        ],
        required_disclaimers: [
          "This is not medical, legal, or financial advice. Consult a qualified professional.",
          "Results vary by individual circumstances",
          "Past performance does not guarantee future results",
          "Attorney advertising. Prior results do not guarantee similar outcomes.",
        ],
        escalation_triggers: [
          "Any content that could be interpreted as medical, legal, or financial advice",
          "Client requests testimonial usage that may violate industry regulations",
          "New regulation affects current campaign content",
          "Client requests content about a service they are not licensed to provide",
          "Any content involving minors, protected health information, or financial data",
        ],
      },
    },
    foundations: {
      agencySummary:
        "We help regulated and compliance-sensitive brands build useful social strategy without crossing approval, claims, or risk boundaries.",
      nicheFocus: "Regulated and compliance-sensitive brands",
      serviceModel: "Approval-led strategy and execution retainer with tighter review controls",
      marketPosition:
        "Governed strategy partner for brands that need commercially useful content and campaigns without unsafe claims or process drift.",
      primaryServices: "strategy development, governed content planning, approval workflows, monthly execution",
      primaryOffer: "Governed social strategy and execution system",
      secondaryOffers: "compliance review support, launch controls, reporting and optimization",
      icpSegments: "healthcare brands, financial services, legal and regulated professional services",
    },
  },
];

export function getAgencyAiSetupStrategyTemplate(
  key: AgencyAiSetupStrategyTemplateKey | null | undefined,
) {
  if (!key) return AGENCY_AI_SETUP_STRATEGY_TEMPLATES[0];
  return AGENCY_AI_SETUP_STRATEGY_TEMPLATES.find((template) => template.key === key) ?? AGENCY_AI_SETUP_STRATEGY_TEMPLATES[0];
}

export function buildAgencyAiSetupImportsCheckpoint(
  template: AgencyAiSetupStrategyTemplate,
  preview: StrategyAiImportPreview,
): AgencyAiSetupCheckpointSnapshot {
  return {
    milestoneLabel: `Latest checkpoint: ${template.title} draft baseline`,
    reliableNow: preview.summary,
    stillWeak: preview.gaps[0] ?? "Imports alone are not enough yet. Foundations still need a human review pass before Strategy AI can be trusted internally.",
    nextAction: "Open foundations next and tighten the Strategy AI baseline one decision at a time.",
    updatedNote: `Updated from the latest ${template.title.toLowerCase()} import pass.`,
  };
}

export function buildAgencyAiSetupModulesCheckpoint(input: {
  approvedMinimumCount: number;
  totalMinimumCount: number;
  nextModuleTitle?: string | null;
}): AgencyAiSetupCheckpointSnapshot {
  const done = input.approvedMinimumCount >= input.totalMinimumCount;
  return {
    milestoneLabel: done ? "Latest checkpoint: Minimum proof complete" : "Latest checkpoint: Minimum proof in progress",
    reliableNow: done
      ? "The minimum Strategy AI proof modules are approved, so the first preview loop can focus on trust and useful output quality."
      : `${input.approvedMinimumCount}/${input.totalMinimumCount} minimum Strategy AI proof modules are approved.`,
    stillWeak: done
      ? "Strategy AI still needs preview feedback and certification before operational trust."
      : `${input.nextModuleTitle ?? "The next required module"} still needs proof before the minimum Strategy AI path is trustworthy.`,
    nextAction: done
      ? "Run the first Strategy AI preview and fix the weakest proof gap it surfaces."
      : `Open ${input.nextModuleTitle ?? "the next required module"} and complete the missing proof before expanding into advanced modules.`,
    updatedNote: "Updated from the latest minimum Strategy AI proof review.",
  };
}

export function buildFoundationFieldCoaching(input: {
  fieldLabel: string;
  currentValue: string;
  starterValue: string;
  minLength?: number;
  focus: string;
}) {
  const minLength = input.minLength ?? 90;
  const trimmed = input.currentValue.trim();
  const missing = trimmed.length === 0;
  const thin = trimmed.length > 0 && trimmed.length < minLength;

  return {
    status: missing ? "missing" : thin ? "thin" : "usable",
    headline: missing
      ? `${input.fieldLabel} is still missing`
      : thin
        ? `${input.fieldLabel} is still too generic`
        : `${input.fieldLabel} is usable`,
    guidance: missing
      ? `Start from the ${input.focus.toLowerCase()} template draft, then tighten it so it sounds like the real agency.`
      : thin
        ? `Make this more specific to the agency by naming the buyer, offer, and commercial outcome more directly.`
        : `This is strong enough for a working draft. Improve it only if the next preview still feels generic.`,
    strengthenCopy: strengthenSetupTextarea(
      trimmed,
      input.starterValue,
      `Make the ${input.fieldLabel.toLowerCase()} more specific to ${input.focus.toLowerCase()} and avoid generic agency language.`,
    ),
  };
}

export function buildGuardrailFieldCoaching(input: {
  fieldLabel: string;
  currentValue: string;
  starterValue: string;
  minItems?: number;
  focus: string;
}) {
  const minItems = input.minItems ?? 3;
  const existingItems = input.currentValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const missing = existingItems.length === 0;
  const thin = existingItems.length > 0 && existingItems.length < minItems;

  return {
    status: missing ? "missing" : thin ? "thin" : "usable",
    headline: missing
      ? `${input.fieldLabel} still needs real examples`
      : thin
        ? `${input.fieldLabel} is still too thin`
        : `${input.fieldLabel} is usable`,
    guidance: missing
      ? `Start with the ${input.focus.toLowerCase()} starter draft, then replace generic items with the exact rules your team would enforce in review.`
      : thin
        ? `Add more concrete examples so ${input.fieldLabel.toLowerCase()} can guide the AI without guessing.`
        : `This is strong enough for a first trusted draft. Add more only if the next preview still fails on safety or specificity.`,
    strengthenCopy: strengthenSetupList(input.currentValue, input.starterValue.split(", ")),
  };
}

export function buildWorkflowFieldCoaching(input: {
  fieldLabel: string;
  currentValue: string;
  starterValue: string;
  minItems?: number;
  focus: string;
}) {
  const minItems = input.minItems ?? 3;
  const existingItems = input.currentValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const missing = existingItems.length === 0;
  const thin = existingItems.length > 0 && existingItems.length < minItems;

  return {
    status: missing ? "missing" : thin ? "thin" : "usable",
    headline: missing
      ? `${input.fieldLabel} is still missing`
      : thin
        ? `${input.fieldLabel} needs clearer operator detail`
        : `${input.fieldLabel} is usable`,
    guidance: missing
      ? `Start from the ${input.focus.toLowerCase()} starter workflow, then rewrite it to match the actual stages and approvals your team uses.`
      : thin
        ? `Add more real workflow detail so the AI knows who approves, what pauses, and what escalates next.`
        : `This is strong enough for a first operator draft. Tighten it only if the next preview still shows sequencing or approval drift.`,
    strengthenCopy: strengthenSetupList(input.currentValue, input.starterValue.split(", ")),
  };
}

export function buildModuleProofCoaching(input: {
  missingRequirements: Array<{
    label: string;
    minCount: number;
    actualCount: number;
    description: string;
  }>;
  suggestedDraft: AgencyOperatingModuleV2;
}) {
  const nextMissing = input.missingRequirements[0] ?? null;
  const ruleSuggestion = input.suggestedDraft.rules?.slice(0, 2).map((item) => item.statement) ?? [];
  const exampleSuggestion = input.suggestedDraft.examples?.slice(0, 2).map((item) => item.summary) ?? [];
  const evidenceSuggestion =
    input.suggestedDraft.evidence_sources?.slice(0, 2).map((item) => item.label) ?? [];

  return {
    nextMissing,
    headline: nextMissing
      ? `${nextMissing.label} is the next proof gap to fix`
      : "This module has the minimum proof for trusted review",
    guidance: nextMissing
      ? `${nextMissing.description} Add enough proof to reach ${nextMissing.minCount}, then move the module through review.`
      : "The proof floor is met. Focus on whether the content actually sounds like the agency before approving it.",
    ruleSuggestion,
    exampleSuggestion,
    evidenceSuggestion,
  };
}

export function shouldRouteAgencyToGuidedStart(meta: AgencyAiSetupMetaV2 | undefined | null, currentStage?: string | null) {
  const importsStarted = Boolean(meta?.imports?.imported_at);
  const foundationsStarted = Boolean(meta?.foundations?.updated_at);

  if (!importsStarted) return true;

  if (!foundationsStarted) {
    return !currentStage || ["overview", "imports", "foundations"].includes(currentStage);
  }

  return false;
}

export type AgencyAiSetupGuidedStep = {
  key: string;
  title: string;
  description: string;
  path: string;
  matches: (pathname: string) => boolean;
};

export const AGENCY_AI_SETUP_GUIDED_STEPS: AgencyAiSetupGuidedStep[] = [
  {
    key: "imports",
    title: "Import Your Context",
    description: "Use existing evidence first.",
    path: "/agency/ai-setup/imports",
    matches: (pathname) => pathname === "/agency/ai-setup/imports" || pathname === "/agency/ai-setup/start",
  },
  {
    key: "foundations",
    title: "Review Your Foundations",
    description: "Tighten the strategic baseline.",
    path: "/agency/ai-setup/foundations",
    matches: (pathname) => pathname === "/agency/ai-setup/foundations",
  },
  {
    key: "modules",
    title: "Approve Key Modules",
    description: "Approve the minimum Strategy AI proof.",
    path: "/agency/ai-setup/modules",
    matches: (pathname) =>
      pathname === "/agency/ai-setup/modules" || pathname.startsWith("/agency/ai-setup/modules/"),
  },
  {
    key: "guardrails",
    title: "Set Your Guardrails",
    description: "Review the rules Strategy AI must never break.",
    path: "/agency/ai-setup/guardrails",
    matches: (pathname) => pathname === "/agency/ai-setup/guardrails",
  },
  {
    key: "activate",
    title: "Activate Strategy AI",
    description: "Run the first trust check and turn it on.",
    path: "/agency/ai-setup/activate",
    matches: (pathname) =>
      pathname === "/agency/ai-setup/activate" ||
      pathname === "/agency/ai-setup/activation" ||
      pathname === "/agency/ai-setup/readiness" ||
      pathname === "/agency/ai-setup/readiness/preview/strategy",
  },
];

export function isAgencyAiSetupGuidedStage(pathname: string) {
  return AGENCY_AI_SETUP_GUIDED_STEPS.some((step) => step.matches(pathname));
}

export function getAgencyAiSetupGuidedStepIndex(pathname: string) {
  return AGENCY_AI_SETUP_GUIDED_STEPS.findIndex((step) => step.matches(pathname));
}

type ModuleStatusLike = {
  status?: string | null;
};

export function getNextGuidedStrategySetupPath(
  meta: AgencyAiSetupMetaV2 | undefined | null,
  latestModulesByKey?: Map<string, ModuleStatusLike> | null,
) {
  if (!meta?.imports?.imported_at) return "/agency/ai-setup/imports";
  if (!meta?.foundations?.updated_at) return "/agency/ai-setup/foundations";

  const minimumApprovedCount = STRATEGY_AI_MINIMUM_PROOF_MODULES.filter(
    (moduleKey) => latestModulesByKey?.get(moduleKey)?.status === "approved",
  ).length;

  if (minimumApprovedCount >= STRATEGY_AI_MINIMUM_PROOF_MODULES.length) {
    if (!meta?.guardrails?.updated_at) return "/agency/ai-setup/guardrails";
    return "/agency/ai-setup/activate";
  }

  return "/agency/ai-setup/modules";
}

export function shouldUseGuidedStrategyPreview(input: {
  agentClass: AgencyAiSetupAgentClass;
  unlockState?: string | null;
  activationMode?: string | null;
  hasRequiredStrategyCertification?: boolean;
  forceAdvanced?: boolean;
}) {
  if (input.forceAdvanced) return false;
  if (input.agentClass !== "strategy") return false;
  if (input.unlockState === "operational" && input.hasRequiredStrategyCertification) return false;
  if (input.activationMode === "operational" && input.hasRequiredStrategyCertification) return false;
  return true;
}

function getCheckpointTitle(agentClass: AgencyAiSetupAgentClass) {
  if (agentClass === "strategy") return "Strategy AI";
  if (agentClass === "creator") return "Creator AI";
  if (agentClass === "operator") return "Operator AI";
  if (agentClass === "analyst") return "Analyst AI";
  return "Client-facing AI";
}

export function buildCheckpointSnapshot(
  agentClass: AgencyAiSetupAgentClass,
  derived: DerivedAgencyReadiness,
  simulation: AgencyAiSetupSimulationV2Record | null,
): AgencyAiSetupCheckpointSnapshot {
  const unlock = derived.unlocks.find((item) => item.agent_class === agentClass);
  const title = getCheckpointTitle(agentClass);
  const summary =
    (simulation?.output_snapshot_json?.summary as string | undefined) ??
    `${title} moved to ${derived.overall_label.toLowerCase()} after the latest setup save.`;
  const findings = Array.isArray(simulation?.output_snapshot_json?.findings)
    ? (simulation?.output_snapshot_json?.findings as string[])
    : [];
  const recommendedNextAction =
    (simulation?.output_snapshot_json?.recommended_next_action as string | undefined) ??
    null;
  const blockedReasons = unlock?.blocked_reasons ?? [];

  return {
    milestoneLabel: unlock?.unlock_state === "operational" ? "Trusted for rollout" : `Latest checkpoint: ${derived.overall_label}`,
    reliableNow: summary,
    stillWeak:
      findings[0] ??
      blockedReasons[0] ??
      derived.critical_blockers[0] ??
      `No explicit blocker was found, but ${title.toLowerCase()} still needs stronger proof before wider activation.`,
    nextAction:
      recommendedNextAction ??
      blockedReasons[0] ??
      `Open the ${title.toLowerCase()} readiness preview and tighten the weakest setup evidence next.`,
    updatedNote: `Updated from the latest ${title.toLowerCase()} coaching pass.`,
  };
}
