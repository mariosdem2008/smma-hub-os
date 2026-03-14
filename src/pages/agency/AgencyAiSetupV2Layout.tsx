import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AgencyAiSetupV2Shell } from "@/components/agency-ai-setup-v2/AgencyAiSetupV2Shell";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyData } from "@/hooks/useAgencyData";
import { useRole } from "@/hooks/useRole";
import { useTouchAgencyAiSetupStatusV2, useAgencyAiSetupResolvedState } from "@/hooks/useAgencyAiSetupV2";
import { AGENCY_AI_SETUP_STAGES } from "@/lib/agency-ai-setup-v2/config";

export default function AgencyAiSetupV2Layout() {
  const { agencyId } = useAgency();
  const { agency } = useAgencyData();
  const { canEditContent } = useRole();
  const { readiness } = useAgencyAiSetupResolvedState(agencyId);
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const location = useLocation();

  const currentStage =
    AGENCY_AI_SETUP_STAGES.find((stage) =>
      stage.path === "/agency/ai-setup"
        ? location.pathname === stage.path
        : location.pathname === stage.path || location.pathname.startsWith(`${stage.path}/`),
    )?.key ?? "overview";

  useEffect(() => {
    if (!agencyId || !canEditContent) return;
    if (touchStatus.isPending) return;
    touchStatus.mutate({ stage: currentStage, step: currentStage });
  }, [agencyId, canEditContent, currentStage]);

  return (
    <AgencyAiSetupV2Shell
      agencyName={agency?.name ?? null}
      readinessLabel={readiness?.overall_label ?? "Not Ready"}
    />
  );
}
