import type { V2ReadinessState } from "./contracts";

export function allowsDiagnosisFromReadiness(readinessState: V2ReadinessState) {
  return readinessState !== "insufficient";
}

export function allowsRecommendationFromReadiness(readinessState: V2ReadinessState) {
  return readinessState === "strategy_ready_with_caveats" || readinessState === "strategy_ready" || readinessState === "execution_ready";
}

export function getReadinessDeepLinkStage(readinessState: V2ReadinessState) {
  if (readinessState === "insufficient") return "essential_intake";
  if (readinessState === "diagnosis_ready") return "progressive_enrichment";
  return "operations_setup";
}

export function buildFallbackTrace(agentKey: string, fallbackReason?: string | null) {
  return {
    used_fallback: Boolean(fallbackReason),
    fallback_reason: fallbackReason ?? null,
    output_mode: fallbackReason ? "deterministic_fallback" : "model_output",
    agent_key: agentKey,
  };
}
