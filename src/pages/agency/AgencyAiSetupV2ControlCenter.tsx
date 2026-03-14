import { Activity, AlertTriangle, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgency } from "@/hooks/useAgency";
import {
  useAgencyAiCertificationEventsV2,
  useAgencyAiCertificationsV2,
  useAgencyAiSetupResolvedState,
  useAgencyAiSetupSimulationsV2,
  useCreateAgencyAiSetupSimulationV2,
  usePromoteAgencyAiSimulationToCertificationV2,
  useTouchAgencyAiSetupStatusV2,
} from "@/hooks/useAgencyAiSetupV2";
import { useLatestAgencyOperatingModulesV2 } from "@/hooks/useAgencyOperatingModulesV2";
import { useRole } from "@/hooks/useRole";
import { useEffect, useMemo } from "react";
import { AGENCY_AI_ACTIVATION_MODE_CAPABILITIES, AGENCY_AI_ACTIVATION_MODE_LABELS } from "@/lib/agency-ai-setup-v2/config";
import { deriveAgencyAiSetupInvalidationState } from "@/lib/agency-ai-setup-v2/invalidation";
import { getAgencyAiSimulationScenarios } from "@/lib/agency-ai-setup-v2/simulations";

function formatScenarioLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function AgencyAiSetupV2ControlCenter() {
  const { agencyId } = useAgency();
  const { canEditContent } = useRole();
  const { status, readiness, unlocks, certifications } = useAgencyAiSetupResolvedState(agencyId);
  const simulations = useAgencyAiSetupSimulationsV2(agencyId);
  const certificationsQuery = useAgencyAiCertificationsV2(agencyId);
  const certificationEvents = useAgencyAiCertificationEventsV2(agencyId);
  const createSimulation = useCreateAgencyAiSetupSimulationV2(agencyId);
  const promoteCertification = usePromoteAgencyAiSimulationToCertificationV2(agencyId);
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const modulesQuery = useLatestAgencyOperatingModulesV2();
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
      touchStatus.mutate({ stage: "control-center", step: "control-center", state: "active" });
    }
  }, [agencyId, canEditContent]);

  const runScenario = (unlock: (typeof unlocks)[number], scenarioKey: string) =>
    createSimulation.mutate({
      agentClass: unlock.agent_class,
      scenarioKey,
      unlockState: unlock.unlock_state,
      readinessLabel: readiness.overall_label,
      blockers: unlock.blocked_reasons,
      activated: Boolean(unlock.activated_at),
      activationMode: unlock.activation_mode,
      readinessScores: {
        knowledge_coverage: readiness.knowledge_coverage,
        process_definition: readiness.process_definition,
        quality_definition: readiness.quality_definition,
        compliance_safety: readiness.compliance_safety,
        approval_governance: readiness.approval_governance,
        evidence_strength: readiness.evidence_strength,
      },
    });

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Control Center</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Monitor the current agent estate, run dry-run simulations, and verify that the activated AI team is still operating within the defined setup.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {unlocks.some((unlock) => invalidation[unlock.agent_class].staleCertifications.length > 0) ? (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Stale certifications need reruns</h2>
              <p className="text-sm text-muted-foreground">
                Some agent classes changed after certification. Re-run the stale certification scenarios before treating operational trust as valid.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {unlocks
                .filter((unlock) => invalidation[unlock.agent_class].staleCertifications.length > 0)
                .map((unlock) => {
                  const staleState = invalidation[unlock.agent_class];
                  return (
                    <div key={unlock.agent_class} className="rounded-lg border border-amber-500/30 bg-background/60 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium capitalize text-foreground">{unlock.agent_class.replace(/_/g, " ")}</div>
                        <Badge variant="secondary">Needs revalidation</Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {staleState.staleScenarioKeys.map((scenarioKey) => (
                          <Button
                            key={scenarioKey}
                            size="sm"
                            variant="outline"
                            className="w-full justify-start"
                            disabled={!canEditContent || createSimulation.isPending}
                            onClick={() => runScenario(unlock, scenarioKey)}
                          >
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            {createSimulation.isPending ? "Running..." : `Run ${formatScenarioLabel(scenarioKey)}`}
                          </Button>
                        ))}
                      </div>
                      <div className="mt-4">
                        <Button variant="ghost" size="sm" asChild className="px-0">
                          <Link to={`/agency/ai-setup/readiness/preview/${unlock.agent_class}`}>Open readiness preview</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Live agent state</h2>
            <p className="text-sm text-muted-foreground">Run a dry-run simulation on any class to capture a readiness snapshot.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {unlocks.map((unlock) => (
              <div key={unlock.agent_class} className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium capitalize text-foreground">{unlock.agent_class.replace(/_/g, " ")}</div>
                  {invalidation[unlock.agent_class].staleCertifications.length ? <Badge variant="secondary">Needs revalidation</Badge> : null}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {unlock.activated_at ? "Activated" : "Not activated"} ·{" "}
                  {unlock.activation_mode ? AGENCY_AI_ACTIVATION_MODE_LABELS[unlock.activation_mode] : unlock.unlock_state.replace(/_/g, " ")}
                </div>
                {invalidation[unlock.agent_class].staleScenarioKeys.length ? (
                  <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
                    Stale scenarios: {invalidation[unlock.agent_class].staleScenarioKeys.map(formatScenarioLabel).join(", ")}.
                  </div>
                ) : null}
                {unlock.activation_mode ? (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {AGENCY_AI_ACTIVATION_MODE_CAPABILITIES[unlock.activation_mode].map((capability) => (
                      <div key={capability}>{capability}</div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4">
                  <div className="space-y-2">
                    {getAgencyAiSimulationScenarios(unlock.agent_class).map((scenario) => (
                      <Button
                        key={scenario.key}
                        size="sm"
                        variant="outline"
                        className="w-full justify-start"
                        disabled={!canEditContent || createSimulation.isPending}
                        onClick={() => runScenario(unlock, scenario.key)}
                      >
                        <FlaskConical className="mr-2 h-4 w-4" />
                        {createSimulation.isPending ? "Running..." : scenario.title}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Recent simulations</h2>
            <p className="text-sm text-muted-foreground">The last 20 dry-run simulations are stored here for operator review.</p>
          </div>
          <div className="space-y-3">
            {(simulations.data ?? []).length ? (
              simulations.data!.map((simulation) => (
                <div key={simulation.id} className="rounded-lg border border-border/60 bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium capitalize text-foreground">{simulation.agent_class.replace(/_/g, " ")}</div>
                      <div className="text-xs text-muted-foreground">
                        {(simulation.input_snapshot_json?.scenario_title as string | undefined) ?? "Simulation run"}
                      </div>
                    </div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{simulation.result}</div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {(simulation.output_snapshot_json?.summary as string | undefined) ?? "Simulation completed."}
                  </div>
                  {simulation.output_snapshot_json?.dimension_scores ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {Object.entries(simulation.output_snapshot_json.dimension_scores as Record<string, number>).map(([key, value]) => (
                        <div key={key} className="rounded-md border border-border/60 bg-background/50 p-2 text-xs text-muted-foreground">
                          <div className="font-medium text-foreground">{key.replace(/_/g, " ")}</div>
                          <div className="mt-1">{value}/100</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {simulation.output_snapshot_json?.recommended_next_action ? (
                    <div className="mt-3 rounded-md border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Next action:</span>{" "}
                      {simulation.output_snapshot_json.recommended_next_action as string}
                    </div>
                  ) : null}
                  {simulation.result === "pass" ? (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        disabled={!canEditContent || promoteCertification.isPending}
                        onClick={() =>
                          promoteCertification.mutate({
                            simulation,
                            note: "Certified from passing control-center simulation.",
                          })
                        }
                      >
                        Promote to certification
                      </Button>
                    </div>
                  ) : null}
                  <div className="mt-2 text-xs text-muted-foreground">{new Date(simulation.created_at).toLocaleString()}</div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                No simulations recorded yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Certification records</h2>
            <p className="text-sm text-muted-foreground">These are the durable readiness decisions currently recorded for the agency AI team.</p>
          </div>
          <div className="space-y-3">
            {(certificationsQuery.data ?? []).length ? (
              certificationsQuery.data!.map((certification) => {
                const staleState = invalidation[certification.agent_class];
                const isStale = staleState.staleCertifications.some((row) => row.id === certification.id);
                const unlock = unlocks.find((row) => row.agent_class === certification.agent_class);
                return (
                  <div key={certification.id} className="rounded-lg border border-border/60 bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium capitalize text-foreground">{certification.agent_class.replace(/_/g, " ")}</div>
                        <div className="text-xs text-muted-foreground">{certification.scenario_title}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isStale ? <Badge variant="secondary">Stale</Badge> : null}
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          {certification.certification_state}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Latest result: {certification.latest_result}
                    </div>
                    {isStale && unlock ? (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
                          This certification is stale because setup evidence changed after it was issued.
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canEditContent || createSimulation.isPending}
                          onClick={() => runScenario(unlock, certification.scenario_key)}
                        >
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          {createSimulation.isPending ? "Running..." : `Run ${formatScenarioLabel(certification.scenario_key)} again`}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                No certification records yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Certification activity</h2>
            <p className="text-sm text-muted-foreground">Promotion and revocation events are now logged for auditability.</p>
          </div>
          <div className="space-y-3">
            {(certificationEvents.data ?? []).length ? (
              certificationEvents.data!.map((event) => (
                <div key={event.id} className="rounded-lg border border-border/60 bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium capitalize text-foreground">
                      {event.agent_class.replace(/_/g, " ")} · {event.event_type.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{event.scenario_key}</div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                No certification events recorded yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
