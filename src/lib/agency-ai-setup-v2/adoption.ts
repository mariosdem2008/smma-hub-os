import type { AgencyOperatingModuleV2 } from "@/lib/strategy/v2/contracts";
import { buildDefaultAgencyOperatingModuleV2, type AgencyAiSetupCoreModuleKey } from "@/lib/agency-ai-setup-v2/modules";
import type { AgencyAiSetupMetaV2 } from "@/lib/agency-ai-setup-v2/readiness";

type ApprovedDocSummary = {
  id: string;
  title: string;
  module?: string | null;
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

function toEvidenceSources(docs: ApprovedDocSummary[]) {
  return docs.slice(0, 5).map((doc) => ({
    type: "approved_brain_document",
    ref_id: doc.id,
    label: doc.title,
  }));
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

  if (moduleKey === "agency_identity") {
    return {
      ...base,
      definition:
        foundations.agency_summary?.trim() ||
        base.definition,
      rules: toRules([
        foundations.market_position ? `Frame the agency as ${foundations.market_position}.` : null,
        foundations.niche_focus ? `Keep the positioning specific to ${foundations.niche_focus}.` : null,
        foundations.service_model ? `Assume the delivery model is ${foundations.service_model}.` : null,
      ]),
      examples: toExamples([
        foundations.agency_summary || "",
        foundations.primary_offer ? `Lead with the primary offer: ${foundations.primary_offer}.` : "",
      ]),
      anti_patterns: toAntiPatterns([
        "Do not describe the agency as a generic full-service provider unless that is explicitly true.",
      ]),
      evidence_sources: toEvidenceSources(approvedDocs),
      confidence: Math.max(base.confidence, approvedDocs.length ? 55 : 45),
    };
  }

  if (moduleKey === "service_catalog") {
    return {
      ...base,
      definition:
        foundations.primary_services?.length
          ? `Primary services: ${foundations.primary_services.join(", ")}.`
          : base.definition,
      rules: toRules([
        foundations.primary_services?.length ? `Prioritize ${foundations.primary_services.join(", ")} in service framing.` : null,
        foundations.secondary_offers?.length ? `Only mention secondary offers when relevant: ${foundations.secondary_offers.join(", ")}.` : null,
        "Do not invent service lines that are not explicitly approved by the agency.",
      ]),
      examples: toExamples([
        foundations.primary_services?.length ? `Approved service framing starts with ${foundations.primary_services.join(", ")}.` : "",
      ]),
      anti_patterns: toAntiPatterns([
        "Avoid vague service language like marketing support, digital help, or growth services without specifics.",
      ]),
      evidence_sources: toEvidenceSources(approvedDocs),
      confidence: Math.max(base.confidence, approvedDocs.length ? 55 : 45),
    };
  }

  if (moduleKey === "offer_strategy") {
    return {
      ...base,
      definition:
        foundations.primary_offer?.trim()
          ? `Primary offer: ${foundations.primary_offer}.`
          : base.definition,
      rules: toRules([
        foundations.primary_offer ? `Optimize recommendations around ${foundations.primary_offer}.` : null,
        foundations.secondary_offers?.length ? `Treat ${foundations.secondary_offers.join(", ")} as secondary unless the context clearly calls for them.` : null,
        "Never position an unapproved offer as the commercial priority.",
      ]),
      examples: toExamples([
        foundations.primary_offer ? `Lead with ${foundations.primary_offer} as the main commercial path.` : "",
      ]),
      anti_patterns: toAntiPatterns([
        "Do not present every offer as equally important.",
      ]),
      evidence_sources: toEvidenceSources(approvedDocs),
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
      ]),
      examples: toExamples([
        foundations.icp_segments?.length ? `A high-fit client looks like ${foundations.icp_segments[0]}.` : "",
      ]),
      anti_patterns: toAntiPatterns([
        "Avoid broad market labels like healthcare, ecommerce, or local business without segment detail.",
      ]),
      evidence_sources: toEvidenceSources(approvedDocs),
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
      ]),
      anti_patterns: toAntiPatterns([
        ...(guardrails.banned_claims ?? []).map((item) => `Never allow: ${item}`),
        "Do not approve fluff, hype, or filler wording.",
      ]),
      edge_cases: toEdgeCases([
        ...(guardrails.escalation_triggers ?? []).map((item) => `Escalate when ${item}.`),
      ]),
      evidence_sources: toEvidenceSources(approvedDocs),
      confidence: Math.max(base.confidence, approvedDocs.length || guardrails.quality_review_standard ? 65 : 45),
    };
  }

  return {
    ...base,
    definition:
      workflow.approval_classes?.length
        ? "Approval logic and workflow checkpoints for governed AI execution."
        : base.definition,
    rules: toRules([
      ...(workflow.approval_classes ?? []).map((item) => `Approval class: ${item}`),
      ...(workflow.lifecycle_stages ?? []).slice(0, 3).map((item) => `Lifecycle stage in scope: ${item}`),
      ...(guardrails.client_facing_restrictions ?? []).map((item) => `Blocked without review: ${item}`),
    ]),
    edge_cases: toEdgeCases([
      ...(workflow.escalation_rules ?? []).map((item) => item),
      ...(guardrails.escalation_triggers ?? []).map((item) => `Escalate when ${item}.`),
    ]),
    evidence_sources: toEvidenceSources(approvedDocs),
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
