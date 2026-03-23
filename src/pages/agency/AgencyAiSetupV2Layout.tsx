import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AgencyAiSetupV2Shell } from "@/components/agency-ai-setup-v2/AgencyAiSetupV2Shell";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyData } from "@/hooks/useAgencyData";
import { useRole } from "@/hooks/useRole";
import { useTouchAgencyAiSetupStatusV2, useAgencyAiSetupResolvedState } from "@/hooks/useAgencyAiSetupV2";
import { AGENCY_AI_SETUP_STAGES } from "@/lib/agency-ai-setup-v2/config";
import {
  getAgencyAiSetupGuidedStepIndex,
  isAgencyAiSetupGuidedStage,
  shouldRouteAgencyToGuidedStart,
} from "@/lib/agency-ai-setup-v2/adoption";

export default function AgencyAiSetupV2Layout() {
  const { agencyId } = useAgency();
  const { agency } = useAgencyData();
  const { canEditContent } = useRole();
  const { readiness, status } = useAgencyAiSetupResolvedState(agencyId);
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const advancedMode = search.get("mode") === "advanced";
  const guidedRoute = location.pathname === "/agency/ai-setup" || isAgencyAiSetupGuidedStage(location.pathname);
  const guidedFirstRunComplete = Boolean(status?.activated_at);
  const guidedMode =
    !advancedMode &&
    guidedRoute &&
    (!guidedFirstRunComplete || shouldRouteAgencyToGuidedStart(status?.meta_json as any, status?.current_stage));

  const currentStage =
    AGENCY_AI_SETUP_STAGES.find((stage) =>
      stage.path === "/agency/ai-setup"
        ? location.pathname === stage.path
        : location.pathname === stage.path || location.pathname.startsWith(`${stage.path}/`),
    )?.key ?? "overview";

  const shouldRedirectToGuidedStart =
    location.pathname === "/agency/ai-setup" &&
    guidedMode &&
    shouldRouteAgencyToGuidedStart(status?.meta_json as any, status?.current_stage);

  const guidedStepIndex = guidedMode && isAgencyAiSetupGuidedStage(location.pathname)
    ? getAgencyAiSetupGuidedStepIndex(location.pathname)
    : -1;

  useEffect(() => {
    if (!agencyId || !canEditContent) return;
    if (touchStatus.isPending) return;
    touchStatus.mutate({ stage: currentStage, step: currentStage });
  }, [agencyId, canEditContent, currentStage]);

  if (shouldRedirectToGuidedStart) {
    return <Navigate to="/agency/ai-setup/imports" replace />;
  }

  return (
    <AgencyAiSetupV2Shell
      agencyName={agency?.name ?? null}
      readinessLabel={readiness?.overall_label ?? "Not Ready"}
      guidedMode={guidedMode}
      currentPath={location.pathname}
      guidedStepIndex={guidedStepIndex}
    />
  );
}
