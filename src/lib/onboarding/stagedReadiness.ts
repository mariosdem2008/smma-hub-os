import type { OnboardingJourneyState } from "@/lib/onboarding/progress";

export interface StagedReadinessSnapshot {
  state?: OnboardingJourneyState;
  essential_intake?: { percent?: number; missing?: string[] };
  operations_setup?: { percent?: number; missing?: string[] };
  progressive_enrichment?: { percent?: number; missing?: string[] };
}

export interface WorkspaceStatusBadge {
  label: string;
  tone: "ready" | "warning" | "degraded";
  detail: string;
}

const FIELD_LABELS: Record<string, string> = {
  ops_primary_contact: "Primary contact",
  ops_main_approver: "Main approver",
  ops_preferred_comms: "Preferred communication",
  ops_launch_window: "Launch window",
  ops_access_status: "Access readiness",
  ops_missing_assets: "Missing assets",
  q4_languages: "Operating languages",
  formats: "Content formats",
  cadence_requirement: "Cadence",
  on_camera_availability: "On-camera availability",
  response_handling: "Response handling",
  audience_type: "Audience type",
  main_objection: "Main objection",
  q9_pain_points: "Pain points",
  brand_voice: "Brand voice",
  content_style: "Content style",
  proof_types: "Proof",
  competitor_link: "Competitor context",
  q13_differentiators: "Differentiators",
};

export function formatOnboardingFieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

export function getOpenItemCount(items?: string[]) {
  return Array.isArray(items) ? items.length : 0;
}

export function buildWorkspaceStatusBadge(args: {
  stagedReadiness: StagedReadinessSnapshot | null;
  strategyGenerating: boolean;
  showRightPanel: boolean;
}): WorkspaceStatusBadge {
  const { stagedReadiness, strategyGenerating, showRightPanel } = args;
  const state = stagedReadiness?.state;
  const opsMissingCount = getOpenItemCount(stagedReadiness?.operations_setup?.missing);
  const enrichmentMissingCount = getOpenItemCount(stagedReadiness?.progressive_enrichment?.missing);

  if (strategyGenerating) {
    return {
      label: "Strategy generation in progress",
      tone: "warning",
      detail: "Initial intake is complete. The first strategy document is still being prepared.",
    };
  }

  if (state === "draft_started") {
    return {
      label: "Initial setup required",
      tone: "warning",
      detail: "Complete the essential intake before strategy and execution tools can run reliably.",
    };
  }

  if (state === "setup_usable") {
    return {
      label: "Execution setup incomplete",
      tone: "warning",
      detail:
        opsMissingCount > 0
          ? `${opsMissingCount} setup item${opsMissingCount === 1 ? "" : "s"} still block clean execution.`
          : "Essential intake is complete, but execution setup still needs review.",
    };
  }

  if (state === "execution_ready" && enrichmentMissingCount > 0) {
    return {
      label: "Execution ready",
      tone: showRightPanel ? "ready" : "degraded",
      detail: showRightPanel
        ? `${enrichmentMissingCount} profile item${enrichmentMissingCount === 1 ? "" : "s"} can still improve strategy quality.`
        : "Client setup is ready, but the assistant panel is disabled by feature flag.",
    };
  }

  return {
    label: showRightPanel ? "AI ready" : "AI degraded",
    tone: showRightPanel ? "ready" : "degraded",
    detail: showRightPanel
      ? "Client setup, execution setup, and strategy profile are aligned."
      : "Client setup is complete, but the assistant panel is disabled by feature flag.",
  };
}
