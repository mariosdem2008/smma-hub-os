import { Power, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgency } from "@/hooks/useAgency";
import {
  useActivateAgencyAgentClassV2,
  useAgencyAiSetupResolvedState,
  useTouchAgencyAiSetupStatusV2,
} from "@/hooks/useAgencyAiSetupV2";
import { useLatestAgencyOperatingModulesV2 } from "@/hooks/useAgencyOperatingModulesV2";
import { useRole } from "@/hooks/useRole";
import { useEffect, useMemo } from "react";
import {
  AGENCY_AI_ACTIVATION_MODE_CAPABILITIES,
  AGENCY_AI_ACTIVATION_MODE_LABELS,
  formatUnlockStateLabel,
  getAvailableActivationModes,
} from "@/lib/agency-ai-setup-v2/config";
import { deriveAgencyAiSetupInvalidationState } from "@/lib/agency-ai-setup-v2/invalidation";

function getActivationGuidance(unlockState: string, missingScenarioKeys: string[]) {
  if (unlockState === "operational" && missingScenarioKeys.length === 0) {
    return "This capability has enough proof for controlled rollout. Activate the smallest useful mode first if you want a safer adoption path.";
  }

  if (unlockState === "internal_assist_only") {
    return "Start with internal assist only. Use it to draft and support the team before you trust it inside real client workflow.";
  }

  if (unlockState === "preview_only") {
    return "Keep this in preview. Run simulations and fix evidence gaps before activating it.";
  }

  return "Do not activate this yet. Finish the missing setup proof and review the readiness preview first.";
}

function formatScenarioLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function AgencyAiSetupV2Activation() {
  const { agencyId } = useAgency();
  const { canEditContent } = useRole();
  const { status, unlocks, certifications, certificationsByAgentClass } = useAgencyAiSetupResolvedState(agencyId);
  const modulesQuery = useLatestAgencyOperatingModulesV2();
  const activateAgent = useActivateAgencyAgentClassV2(agencyId);
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const invalidation = useMemo(
    () =>
      deriveAgencyAiSetupInvalidationState({
        status,
        certifications,
        unlocks,
        modules: modulesQuery.latestByKey.values(),
      }),
    [certifications, modulesQuery.latestByKey, status, unlocks],
  );

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "activation", step: "activation", state: "ready_for_review" });
    }
  }, [agencyId, canEditContent]);

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Activation</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Activate agent classes only after the readiness review is acceptable. Activation is separate from unlock state so agencies can roll out gradually.
              </p>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Recommended order: certify Strategy AI first, then creator or operator workflows, and only activate client-facing AI after the review path is proven safe.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {unlocks.map((unlock) => {
          const certificationState = certificationsByAgentClass[unlock.agent_class];
          const staleState = invalidation[unlock.agent_class];
          const effectiveCertifiedScenarioKeys = (certificationState?.certifiedScenarioKeys ?? []).filter(
            (scenarioKey) => !staleState.staleScenarioKeys.includes(scenarioKey),
          );
          const effectiveMissingScenarioKeys = Array.from(
            new Set([...(certificationState?.missingScenarioKeys ?? []), ...staleState.staleScenarioKeys]),
          );
          const availableModes = getAvailableActivationModes(
            unlock.agent_class,
            unlock.unlock_state,
            effectiveCertifiedScenarioKeys,
          );
          const canActivate = availableModes.length > 0;
          const isActive = Boolean(unlock.activated_at);
          const currentMode = unlock.activation_mode;

          return (
            <Card key={unlock.agent_class} className="border-border/60 bg-card/40">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold capitalize text-foreground">{unlock.agent_class.replace(/_/g, " ")}</div>
                  <div className="flex items-center gap-2">
                    {staleState.staleCertifications.length ? <Badge variant="secondary">Needs revalidation</Badge> : null}
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {isActive ? "Activated" : formatUnlockStateLabel(unlock.unlock_state)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="rounded-md border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                    {getActivationGuidance(unlock.unlock_state, effectiveMissingScenarioKeys)}
                  </div>
                  {(unlock.blocked_reasons.length ? unlock.blocked_reasons : ["No blocking reasons recorded"]).map((reason) => (
                    <div key={reason}>{reason}</div>
                  ))}
                  {effectiveMissingScenarioKeys.length ? (
                    <div className="rounded-md border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                      Operational mode still requires certifications for:{" "}
                      {effectiveMissingScenarioKeys.map((item) => item.replace(/_/g, " ")).join(", ")}.
                    </div>
                  ) : null}
                  {staleState.staleCertifications.length ? (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
                      Current trust is outdated because setup evidence changed after certification. Re-run the readiness preview before keeping this in live use.
                    </div>
                  ) : null}
                  {staleState.staleScenarioKeys.length ? (
                    <div className="rounded-md border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                      Re-run scenarios: {staleState.staleScenarioKeys.map(formatScenarioLabel).join(", ")}.
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Allowed rollout modes</div>
                  <div className="flex flex-wrap gap-2">
                    {availableModes.length ? (
                      availableModes.map((mode) => (
                        <Button
                          key={mode}
                          size="sm"
                          variant={currentMode === mode && isActive ? "default" : "outline"}
                          disabled={!canEditContent || activateAgent.isPending}
                          onClick={() => activateAgent.mutate({ agentClass: unlock.agent_class, activate: true, mode })}
                        >
                          <Power className="mr-2 h-4 w-4" />
                          {AGENCY_AI_ACTIVATION_MODE_LABELS[mode]}
                        </Button>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">Resolve readiness blockers before activation.</div>
                    )}
                  </div>
                  {currentMode ? (
                    <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">
                        Current mode: {AGENCY_AI_ACTIVATION_MODE_LABELS[currentMode]}
                      </div>
                      <div className="mt-2 space-y-1">
                        {AGENCY_AI_ACTIVATION_MODE_CAPABILITIES[currentMode].map((capability) => (
                          <div key={capability}>{capability}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" asChild className="px-0">
                    <Link to={`/agency/ai-setup/readiness/preview/${unlock.agent_class}`}>Open readiness preview</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEditContent || !isActive || !canActivate || activateAgent.isPending}
                    onClick={() => activateAgent.mutate({ agentClass: unlock.agent_class, activate: false })}
                  >
                    Deactivate
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
