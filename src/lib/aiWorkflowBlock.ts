import type { AiAssistantError } from "@/hooks/useAiAssistant";

export type AiWorkflowBlockState = {
  title: string;
  message: string;
  note?: string;
  deepLink?: string;
  requiredMode?: string;
  hasAgencySession: boolean;
  missing?: string[];
};

function formatModeLabel(mode?: string) {
  return mode ? mode.replace(/_/g, " ") : null;
}

export function buildActivationBlockState(args: {
  message: string;
  deepLink?: string;
  requiredMode?: string;
  unlockState?: string;
  activationMode?: string;
  missingCertificationScenarios?: string[];
  hasAgencySession: boolean;
}): AiWorkflowBlockState {
  const requiredModeLabel = formatModeLabel(args.requiredMode);
  const activationModeLabel = formatModeLabel(args.activationMode);
  const missingCertification = (args.missingCertificationScenarios?.length ?? 0) > 0;
  const blockedByReadiness = !args.unlockState || args.unlockState === "blocked";

  if (missingCertification) {
    return {
      title: "Certification required",
      message: "This AI workflow cannot be used live until the agency certifies this agent behavior.",
      note: "The current setup is missing the required certification for this workflow.",
      deepLink: args.deepLink,
      requiredMode: args.requiredMode,
      hasAgencySession: args.hasAgencySession,
    };
  }

  if (blockedByReadiness) {
    return {
      title: "Setup not ready",
      message: "This AI workflow is still blocked by setup requirements.",
      note: "The agency has not completed the readiness requirements for this workflow yet.",
      deepLink: args.deepLink,
      requiredMode: args.requiredMode,
      hasAgencySession: args.hasAgencySession,
    };
  }

  return {
    title: "Activation required",
    message: args.message,
    note:
      activationModeLabel && requiredModeLabel
        ? `Current rollout mode: ${activationModeLabel}. Required: ${requiredModeLabel}.`
        : undefined,
    deepLink: args.deepLink,
    requiredMode: args.requiredMode,
    hasAgencySession: args.hasAgencySession,
  };
}

export function buildAiSetupRequiredBlockState(args: {
  missing?: string[];
  deepLink?: string;
  hasAgencySession: boolean;
}): AiWorkflowBlockState {
  return {
    title: "AI setup required",
    message: "Complete AI setup before using this workflow.",
    note:
      Array.isArray(args.missing) && args.missing.length > 0
        ? `Missing: ${args.missing.slice(0, 6).join(", ")}`
        : "The required setup inputs are still incomplete.",
    deepLink: args.deepLink,
    hasAgencySession: args.hasAgencySession,
    missing: args.missing,
  };
}

export function buildAssistantBlockStateFromError(error: AiAssistantError, hasAgencySession: boolean): AiWorkflowBlockState | null {
  if (error.code === "AI_SETUP_REQUIRED") {
    return buildAiSetupRequiredBlockState({
      missing: error.missing,
      deepLink: "/agency/ai-setup",
      hasAgencySession,
    });
  }

  if (error.code === "AGENT_ACTIVATION_REQUIRED") {
    return buildActivationBlockState({
      message: error.message,
      deepLink: error.deepLink,
      requiredMode: error.requiredMode,
      unlockState: error.unlockState,
      activationMode: error.activationMode,
      missingCertificationScenarios: error.missingCertificationScenarios,
      hasAgencySession,
    });
  }

  return null;
}
