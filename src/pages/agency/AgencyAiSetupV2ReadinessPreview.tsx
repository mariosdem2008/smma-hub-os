import { useMemo } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, FlaskConical, PlayCircle, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgency } from "@/hooks/useAgency";
import {
  useAgencyAiSetupResolvedState,
  useAgencyAiSetupSimulationsV2,
  useCreateAgencyAiSetupSimulationV2,
} from "@/hooks/useAgencyAiSetupV2";
import { useLatestAgencyOperatingModulesV2 } from "@/hooks/useAgencyOperatingModulesV2";
import { AGENCY_AI_ACTIVATION_MODE_LABELS, type AgencyAiSetupAgentClass } from "@/lib/agency-ai-setup-v2/config";
import {
  assessAgencyAiSetupModuleContent,
  getAgencyAiSetupModuleMeta,
  isAgencyAiSetupCoreModuleKey,
} from "@/lib/agency-ai-setup-v2/modules";
import { getAgencyAiSimulationScenarios } from "@/lib/agency-ai-setup-v2/simulations";
import { shouldUseGuidedStrategyPreview } from "@/lib/agency-ai-setup-v2/adoption";

const VALID_AGENT_CLASSES: AgencyAiSetupAgentClass[] = ["strategy", "creator", "operator", "analyst", "client_facing"];

function isAgentClass(value: string | undefined): value is AgencyAiSetupAgentClass {
  return Boolean(value && VALID_AGENT_CLASSES.includes(value as AgencyAiSetupAgentClass));
}

function getTrustPath(agentClass: AgencyAiSetupAgentClass) {
  const stepMap: Record<AgencyAiSetupAgentClass, string[]> = {
    strategy: [
      "Import agency context and tighten foundations",
      "Approve the core strategy modules with real proof",
      "Run readiness and strategy certification scenarios",
      "Activate Strategy AI in internal assist first, then operational",
    ],
    creator: [
      "Finish guardrails with real banned claims and escalation rules",
      "Approve quality bar and proof-heavy creative modules",
      "Pass creator brief certification scenarios",
      "Activate creator workflows gradually after review standards are proven",
    ],
    operator: [
      "Define lifecycle stages, approvals, and escalation rules",
      "Prove operator checkpoints with workflow evidence",
      "Pass workflow execution certification scenarios",
      "Activate internal workflow assistance before any operational automation",
    ],
    analyst: [
      "Define reporting standards and evidence expectations",
      "Prove what a useful analytical recommendation looks like",
      "Pass reporting certification scenarios",
      "Activate analyst support only after the reporting standard is consistent",
    ],
    client_facing: [
      "Finish client-facing restrictions and escalation rules",
      "Prove approval governance and safe response boundaries",
      "Pass client response certification scenarios",
      "Only then consider operational client-facing activation",
    ],
  };

  return stepMap[agentClass];
}

function getNextEditLink(agentClass: AgencyAiSetupAgentClass) {
  if (agentClass === "creator" || agentClass === "client_facing") return "/agency/ai-setup/guardrails";
  if (agentClass === "operator") return "/agency/ai-setup/workflow";
  return "/agency/ai-setup/foundations";
}

function getWeakEvidenceHints(agentClass: AgencyAiSetupAgentClass) {
  if (agentClass === "strategy") {
    return [
      "Foundations are still weak if your agency summary, market position, or ICP would fit almost any other agency.",
      "Strategy trust stays low until core modules are approved with real proof, not just broad statements.",
    ];
  }

  if (agentClass === "creator") {
    return [
      "Guardrails are still weak if banned claims, disclaimers, and escalation triggers are generic or too short.",
      "Creator quality will drift if the quality bar is declared but not backed by examples and proof.",
    ];
  }

  if (agentClass === "operator") {
    return [
      "Workflow is still weak if lifecycle stages are generic or do not reflect how the agency actually delivers work.",
      "Operator trust stays low until approvals and escalation rules are concrete enough to follow without guessing.",
    ];
  }

  if (agentClass === "analyst") {
    return [
      "Analyst readiness is weak when reporting standards are implied instead of written clearly.",
      "Low evidence strength usually means analytical outputs will become generic instead of operator-useful.",
    ];
  }

  return [
    "Client-facing readiness is weak if response restrictions and escalation rules are incomplete or unclear.",
    "This capability should stay blocked until safe response boundaries are explicitly proven.",
  ];
}

function formatScenarioLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function AgencyAiSetupV2ReadinessPreview() {
  const { agentClass } = useParams<{ agentClass: string }>();
  const location = useLocation();
  const { agencyId } = useAgency();
  const { status, readiness, unlocks, certificationsByAgentClass } = useAgencyAiSetupResolvedState(agencyId);
  const simulations = useAgencyAiSetupSimulationsV2(agencyId);
  const createSimulation = useCreateAgencyAiSetupSimulationV2(agencyId);
  const modulesQuery = useLatestAgencyOperatingModulesV2();

  if (!isAgentClass(agentClass)) {
    return <Navigate to="/agency/ai-setup/readiness" replace />;
  }

  const unlock = unlocks.find((row) => row.agent_class === agentClass);
  const scenarios = getAgencyAiSimulationScenarios(agentClass);
  // Safe exception: `agentClass` comes from the route param and is constant for
  // this component's lifetime, so the early `isAgentClass` guard above is
  // consistent every render — the hook order never actually changes. A full
  // refactor would lose the type-narrowing the guard provides across the body.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const recentRuns = useMemo(
    () => (simulations.data ?? []).filter((row) => row.agent_class === agentClass).slice(0, 5),
    [simulations.data, agentClass],
  );
  const weakEvidenceHints = getWeakEvidenceHints(agentClass);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const proofGapCards = useMemo(() => {
    const requiredModules = unlock?.required_modules ?? [];
    return requiredModules
      .filter(isAgencyAiSetupCoreModuleKey)
      .map((moduleKey) => {
        const meta = getAgencyAiSetupModuleMeta(moduleKey);
        const moduleRecord = modulesQuery.latestByKey.get(moduleKey);
        if (!meta) return null;
        if (!moduleRecord) {
          return {
            key: moduleKey,
            title: meta.title,
            description: "No V2 module draft exists yet.",
            action: "Create the module draft and add the required proof before review.",
          };
        }

        const assessment = assessAgencyAiSetupModuleContent(moduleKey, moduleRecord.content_json);
        if (assessment.readyForApproval && moduleRecord.status === "approved") {
          return null;
        }

        const missingProof = assessment.missingRequirements.map(
          (requirement) =>
            `${requirement.label}: ${requirement.actualCount}/${requirement.minCount} (${requirement.description})`,
        );

        return {
          key: moduleKey,
          title: meta.title,
          description:
            missingProof.length > 0
              ? missingProof.join(" ")
              : `Module status is ${moduleRecord.status}. Approval is still required before this capability can be trusted.`,
          action:
            moduleRecord.status === "approved"
              ? "Strengthen the module content before rerunning readiness."
              : "Add the missing proof and move the module through review.",
        };
      })
      .filter(Boolean) as Array<{ key: string; title: string; description: string; action: string }>;
  }, [modulesQuery.latestByKey, unlock?.required_modules]);
  const missingCertificationScenarios = certificationsByAgentClass?.[agentClass]?.missingScenarioKeys ?? [];
  const locationSearch = new URLSearchParams(location.search);
  const forceAdvanced = locationSearch.get("mode") === "advanced" || locationSearch.get("view") === "advanced";
  const isGuidedStrategyPreview = shouldUseGuidedStrategyPreview({
    agentClass,
    unlockState: unlock?.unlock_state,
    activationMode: unlock?.activation_mode,
    hasRequiredStrategyCertification: !missingCertificationScenarios.includes("strategy_readiness_certification"),
    forceAdvanced,
  });
  const latestCheckpoint = (status?.meta_json as Record<string, any> | undefined)?.checkpoints?.foundations;
  const strategyQuickFixes = [
    proofGapCards[0]?.action,
    unlock?.blocked_reasons?.[0],
    missingCertificationScenarios.length
      ? `Run ${formatScenarioLabel(missingCertificationScenarios[0])} after tightening the minimum proof modules.`
      : null,
  ].filter(Boolean) as string[];
  const primaryProofGap = proofGapCards[0] ?? null;

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" asChild className="px-0">
              <Link to="/agency/ai-setup/readiness">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to readiness
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold capitalize text-foreground">{agentClass.replace(/_/g, " ")} Preview</h1>
              <Badge variant={unlock?.unlock_state === "operational" ? "default" : "secondary"}>
                {unlock?.unlock_state?.replace(/_/g, " ") ?? "blocked"}
              </Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {isGuidedStrategyPreview
                ? "This first preview is the narrowest possible check: can Strategy AI help internally yet, what is still weak, and what exact proof should you fix next?"
                : "Use this page to simulate the current setup for this agent class before activation. This is the page activation-gated workflows link back to when readiness is not sufficient."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {isGuidedStrategyPreview ? (
              <Button variant="outline" asChild>
                <Link to="/agency/ai-setup/modules">Go back to minimum proof modules</Link>
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link to="/agency/ai-setup/activation">Go to activation</Link>
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link to={getNextEditLink(agentClass)}>Edit the highest-impact setup area</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {isGuidedStrategyPreview ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">Run your first Strategy AI preview</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Do not think about full certifications yet. First check whether Strategy AI can produce a useful internal draft without becoming generic.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">This preview checks</div>
                  <div className="mt-2 text-sm text-foreground">Positioning clarity, proof quality, and whether Strategy AI can help internally without guessing.</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Reliable now</div>
                  <div className="mt-2 text-sm text-foreground">
                    {(latestCheckpoint?.reliableNow as string | undefined) ?? "Your imported context and first minimum-proof modules give Strategy AI a usable draft baseline."}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Still weak</div>
                  <div className="mt-2 text-sm text-foreground">
                    {proofGapCards[0]?.description ?? unlock?.blocked_reasons?.[0] ?? "The strategy proof is still too thin to trust for wider activation."}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    createSimulation.mutate({
                      agentClass,
                      scenarioKey: "strategy_readiness_certification",
                      unlockState: unlock?.unlock_state ?? "blocked",
                      readinessLabel: readiness.overall_label,
                      blockers: unlock?.blocked_reasons ?? [],
                      activated: Boolean(unlock?.activated_at),
                      activationMode: unlock?.activation_mode ?? null,
                      readinessScores: {
                        knowledge_coverage: readiness.knowledge_coverage,
                        process_definition: readiness.process_definition,
                        quality_definition: readiness.quality_definition,
                        compliance_safety: readiness.compliance_safety,
                        approval_governance: readiness.approval_governance,
                        evidence_strength: readiness.evidence_strength,
                      },
                    })
                  }
                  disabled={createSimulation.isPending}
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {createSimulation.isPending ? "Running preview..." : "Run first Strategy AI preview"}
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/agency/ai-setup/readiness/preview/strategy?view=advanced">Open advanced readiness view</Link>
                </Button>
                {primaryProofGap ? (
                  <Button variant="ghost" asChild>
                    <Link
                      to={`/agency/ai-setup/modules/${primaryProofGap.key}?returnTo=${encodeURIComponent(
                        "/agency/ai-setup/readiness/preview/strategy",
                      )}`}
                    >
                      Fix {primaryProofGap.title} now
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/40">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <Wrench className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">Fix this next</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Keep the next move narrow. Fix one weak proof area, then rerun the preview.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {strategyQuickFixes.length ? (
                  strategyQuickFixes.map((fix) => (
                    <div key={fix} className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
                      {fix}
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
                    No narrow fix is recorded yet. Run the first preview to get a concrete next action.
                  </div>
                )}
                {primaryProofGap ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Fastest fix path:</span> open{" "}
                    <Link
                      to={`/agency/ai-setup/modules/${primaryProofGap.key}?returnTo=${encodeURIComponent(
                        "/agency/ai-setup/readiness/preview/strategy",
                      )}`}
                      className="text-primary underline underline-offset-4"
                    >
                      {primaryProofGap.title}
                    </Link>{" "}
                    and tighten the missing proof before rerunning this preview.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {isGuidedStrategyPreview ? "What Strategy AI must prove next" : "Trust path for this capability"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isGuidedStrategyPreview
                ? "This is the shortest path from a first draft baseline to trusted internal assist."
                : "Use this as the checklist for moving from draft setup to trusted activation."}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {getTrustPath(agentClass).map((step, index) => (
              <div key={step} className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Step {index + 1}</div>
                <div className="mt-2 text-sm text-foreground">{step}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {isGuidedStrategyPreview ? "Preview scenarios" : "Certification scenarios"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isGuidedStrategyPreview
                  ? "Run a scenario-grade check to see whether Strategy AI is specific enough to help internally and what exact proof still needs work."
                  : "Run scenario-grade checks before you expand activation. These simulations score process, quality, safety, approvals, and usefulness."}
              </p>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {scenarios.map((scenario) => (
              <div key={scenario.key} className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{scenario.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{scenario.description}</div>
                  </div>
                  <Badge variant={scenario.minimumResult === "pass" ? "default" : "secondary"}>
                    {scenario.minimumResult === "pass" ? "Certification" : "Boundary Check"}
                  </Badge>
                </div>
                <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Primary objective</div>
                <div className="mt-1 text-sm text-muted-foreground">{scenario.primaryObjective}</div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Readiness: {readiness.overall_label}</span>
                  <span>Mode: {unlock?.activation_mode ? AGENCY_AI_ACTIVATION_MODE_LABELS[unlock.activation_mode] : "Not activated"}</span>
                </div>
                <div className="mt-4">
                  <Button
                    onClick={() =>
                      createSimulation.mutate({
                        agentClass,
                        scenarioKey: scenario.key,
                        unlockState: unlock?.unlock_state ?? "blocked",
                        readinessLabel: readiness.overall_label,
                        blockers: unlock?.blocked_reasons ?? [],
                        activated: Boolean(unlock?.activated_at),
                        activationMode: unlock?.activation_mode ?? null,
                        readinessScores: {
                          knowledge_coverage: readiness.knowledge_coverage,
                          process_definition: readiness.process_definition,
                          quality_definition: readiness.quality_definition,
                          compliance_safety: readiness.compliance_safety,
                          approval_governance: readiness.approval_governance,
                          evidence_strength: readiness.evidence_strength,
                        },
                      })
                    }
                    disabled={createSimulation.isPending}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    {createSimulation.isPending ? "Running..." : "Run scenario"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Current blockers</h2>
              <p className="text-sm text-muted-foreground">These are the blockers currently stopping or constraining this agent class.</p>
            </div>
            <div className="space-y-3">
              {(unlock?.blocked_reasons?.length ? unlock.blocked_reasons : ["No blockers recorded."]).map((reason) => (
                <div key={reason} className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
                  {reason}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">What looks weak right now</h2>
              <p className="text-sm text-muted-foreground">Use these hints to strengthen the setup before rerunning certification scenarios.</p>
            </div>
            <div className="space-y-3">
              {weakEvidenceHints.map((hint) => (
                <div key={hint} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                  {hint}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Exact proof gaps blocking trust</h2>
              <p className="text-sm text-muted-foreground">
                These are the specific module and certification gaps still blocking trusted activation for this capability.
              </p>
            </div>
            <div className="space-y-3">
              {proofGapCards.length ? (
                proofGapCards.map((gap) => (
                  <div key={gap.key} className="rounded-lg border border-border/60 bg-background/60 p-4">
                    <div className="text-sm font-medium text-foreground">{gap.title}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{gap.description}</div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Next move:</span> {gap.action}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                  No proof gaps are currently recorded for the required V2 modules.
                </div>
              )}

              {missingCertificationScenarios.length ? (
                <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                  <div className="text-sm font-medium text-foreground">Missing certification scenarios</div>
                  <div className="mt-2 space-y-2">
                    {missingCertificationScenarios.map((scenarioKey) => (
                      <div key={scenarioKey} className="text-sm text-muted-foreground">
                        {formatScenarioLabel(scenarioKey)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40 xl:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Recent preview runs</h2>
            </div>
            <div className="space-y-3">
              {recentRuns.length ? (
                recentRuns.map((run) => (
                  <div key={run.id} className="rounded-lg border border-border/60 bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {(run.input_snapshot_json?.scenario_title as string | undefined) ?? "Simulation run"}
                        </div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{run.result}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {(run.output_snapshot_json?.summary as string | undefined) ?? "Simulation completed."}
                    </div>
                    {Array.isArray(run.output_snapshot_json?.findings) && (run.output_snapshot_json?.findings as unknown[]).length ? (
                      <div className="mt-3 space-y-2">
                        {((run.output_snapshot_json?.findings as string[]).slice(0, 3)).map((finding) => (
                          <div key={finding} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
                            <span>{finding}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {run.output_snapshot_json?.recommended_next_action ? (
                      <div className="mt-3 rounded-md border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Next action:</span>{" "}
                        {run.output_snapshot_json.recommended_next_action as string}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                  No preview runs recorded yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
