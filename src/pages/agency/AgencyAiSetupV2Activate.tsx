import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgency } from "@/hooks/useAgency";
import {
  useActivateAgencyAgentClassV2,
  useAgencyAiSetupResolvedState,
  useCreateAgencyAiSetupSimulationV2,
  useTouchAgencyAiSetupStatusV2,
  type AgencyAiSetupSimulationV2Record,
} from "@/hooks/useAgencyAiSetupV2";
import { useLatestAgencyOperatingModulesV2 } from "@/hooks/useAgencyOperatingModulesV2";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import {
  AGENCY_AI_ACTIVATION_MODE_LABELS,
  getAvailableActivationModes,
} from "@/lib/agency-ai-setup-v2/config";
import { STRATEGY_AI_MINIMUM_PROOF_MODULES } from "@/lib/agency-ai-setup-v2/modules";

function simulationSummary(simulation: AgencyAiSetupSimulationV2Record | null) {
  const summary = simulation?.output_snapshot_json?.summary;
  return typeof summary === "string"
    ? summary
    : "Run the first Strategy AI preview to see what the current setup can already do and what still needs attention.";
}

export default function AgencyAiSetupV2Activate() {
  const { agencyId } = useAgency();
  const { canEditContent } = useRole();
  const { readiness, unlocks, certificationsByAgentClass } = useAgencyAiSetupResolvedState(agencyId);
  const modulesQuery = useLatestAgencyOperatingModulesV2();
  const createSimulation = useCreateAgencyAiSetupSimulationV2(agencyId);
  const activateAgent = useActivateAgencyAgentClassV2(agencyId);
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const { toast } = useToast();
  const [simulation, setSimulation] = useState<AgencyAiSetupSimulationV2Record | null>(null);
  const [selectedMode, setSelectedMode] = useState<"preview_only" | "internal_assist_only" | "operational">("internal_assist_only");

  const strategyUnlock = unlocks.find((item) => item.agent_class === "strategy");
  const certifiedScenarioKeys = certificationsByAgentClass?.strategy?.certifiedScenarioKeys ?? [];
  const availableModes = getAvailableActivationModes("strategy", strategyUnlock?.unlock_state, certifiedScenarioKeys);
  const approvedMinimumCount = STRATEGY_AI_MINIMUM_PROOF_MODULES.filter(
    (moduleKey) => modulesQuery.latestByKey.get(moduleKey)?.status === "approved",
  ).length;
  const hasRunPreview = simulation !== null;
  const previewFailed = simulation?.result === "fail";
  const activationBlockedReason = !hasRunPreview
    ? "Run the Strategy AI preview first before turning it on."
    : previewFailed
      ? "The Strategy AI preview still needs attention. Fix the setup issues it found before activating internal assist."
      : null;
  const quickChecks = useMemo(
    () => [
      { label: "Foundations reviewed", done: readiness.knowledge_coverage >= 40 },
      { label: `${approvedMinimumCount}/${STRATEGY_AI_MINIMUM_PROOF_MODULES.length} key modules approved`, done: approvedMinimumCount >= STRATEGY_AI_MINIMUM_PROOF_MODULES.length },
      { label: "Guardrails set", done: readiness.compliance_safety >= 30 },
      { label: "Quality rules defined", done: readiness.quality_definition >= 40 },
    ],
    [approvedMinimumCount, readiness.compliance_safety, readiness.knowledge_coverage, readiness.quality_definition],
  );
  const celebration = Boolean(strategyUnlock?.activated_at);

  useEffect(() => {
    if (
      strategyUnlock?.activation_mode &&
      availableModes.includes(strategyUnlock.activation_mode) &&
      selectedMode !== strategyUnlock.activation_mode
    ) {
      setSelectedMode(strategyUnlock.activation_mode);
      return;
    }
    if (!availableModes.includes(selectedMode) && availableModes.length > 0 && selectedMode !== availableModes[0]) {
      setSelectedMode(availableModes[0]);
    }
  }, [availableModes, selectedMode, strategyUnlock?.activation_mode]);

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "activation", step: "activation", state: "ready_for_review" });
    }
  }, [agencyId, canEditContent]);

  async function handleRunPreview() {
    if (!strategyUnlock) return;
    const nextSimulation = await createSimulation.mutateAsync({
      agentClass: "strategy",
      unlockState: strategyUnlock.unlock_state,
      readinessLabel: readiness.overall_label,
      blockers: strategyUnlock.blocked_reasons,
      activated: Boolean(strategyUnlock.activated_at),
      activationMode: strategyUnlock.activation_mode,
      readinessScores: {
        knowledge_coverage: readiness.knowledge_coverage,
        process_definition: readiness.process_definition,
        quality_definition: readiness.quality_definition,
        compliance_safety: readiness.compliance_safety,
        approval_governance: readiness.approval_governance,
        evidence_strength: readiness.evidence_strength,
      },
      scenarioKey: "strategy_readiness_certification",
    });
    setSimulation(nextSimulation);
  }

  async function handleActivate() {
    if (activationBlockedReason) {
      toast({
        title: "Activation blocked",
        description: activationBlockedReason,
        variant: "destructive",
      });
      return;
    }

    try {
      await activateAgent.mutateAsync({ agentClass: "strategy", activate: true, mode: selectedMode });
      toast({
        title: "Strategy AI activated",
        description: `Strategy AI is now active in ${AGENCY_AI_ACTIVATION_MODE_LABELS[selectedMode].toLowerCase()} mode.`,
      });
    } catch (error) {
      toast({
        title: "Activation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Activate Strategy AI</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Let&apos;s check if Strategy AI is ready to start helping your team. You do not need the full control plane here. You only need to know what is solid, what still needs attention, and which safe mode to turn on first.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div className="text-base font-semibold text-foreground">Quick check</div>
          <div className="grid gap-3 md:grid-cols-2">
            {quickChecks.map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-sm">
                <CheckCircle2 className={`h-4 w-4 ${item.done ? "text-emerald-400" : "text-amber-300"}`} />
                <span className="text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1">
            <div className="text-base font-semibold text-foreground">Preview what Strategy AI produces</div>
            <div className="text-sm text-muted-foreground">
              Run one strategy preview before you turn anything on. This is the trust check for the first activation.
            </div>
          </div>
          <Button onClick={handleRunPreview} disabled={createSimulation.isPending || !strategyUnlock}>
            {createSimulation.isPending ? "Running preview..." : "Run Strategy Preview"}
          </Button>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">Strategy Preview Result</div>
              {simulation ? <Badge variant={simulation.result === "pass" ? "default" : "secondary"}>{simulation.result === "pass" ? "Ready with review" : "Needs attention"}</Badge> : null}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">{simulationSummary(simulation)}</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">What it can do</div>
                <div className="mt-2 space-y-1 text-sm text-foreground">
                  <div>• Draft strategy recommendations</div>
                  <div>• Generate internal strategy briefs</div>
                  <div>• Help your team with strategy questions</div>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">What it won&apos;t do yet</div>
                <div className="mt-2 space-y-1 text-sm text-foreground">
                  <div>• Produce client-ready deliverables without review</div>
                  <div>• Act autonomously in live workflow</div>
                  <div>• Expand into other agent classes automatically</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1">
            <div className="text-base font-semibold text-foreground">Turn on Strategy AI</div>
            <div className="text-sm text-muted-foreground">Start with the smallest useful mode first. Internal assist is the recommended first activation.</div>
          </div>
          {activationBlockedReason ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              {activationBlockedReason}
            </div>
          ) : null}
          <div className="space-y-3">
            {[
              { key: "preview_only" as const, label: "Preview only", body: "Simulations and draft examples only." },
              { key: "internal_assist_only" as const, label: "Internal assist", body: "Drafts and team support with human review required." },
              { key: "operational" as const, label: "Full operational", body: "Live workflow handling. Only available after additional certification." },
            ].map((mode) => {
              const available = availableModes.includes(mode.key);
              return (
                <button
                  key={mode.key}
                  type="button"
                  disabled={!available}
                  onClick={() => setSelectedMode(mode.key)}
                  className={`block w-full rounded-xl border p-4 text-left ${selectedMode === mode.key ? "border-primary/40 bg-primary/10" : "border-border/60 bg-background/60"} ${available ? "" : "opacity-50"}`}
                >
                  <div className="text-sm font-medium text-foreground">{mode.label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{mode.body}</div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleActivate}
              disabled={
                !canEditContent ||
                activateAgent.isPending ||
                !availableModes.includes(selectedMode) ||
                Boolean(activationBlockedReason)
              }
            >
              {activateAgent.isPending ? "Activating..." : "Activate Strategy AI"}
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/agency/ai-setup?mode=advanced">Open advanced setup</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {celebration ? (
        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3 text-emerald-100">
              <Sparkles className="h-5 w-5" />
              <div className="text-lg font-semibold">Strategy AI is active</div>
            </div>
            <div className="text-sm text-emerald-50/90">
              Strategy AI is now running in {strategyUnlock?.activation_mode ? AGENCY_AI_ACTIVATION_MODE_LABELS[strategyUnlock.activation_mode].toLowerCase() : "internal assist"} mode. Start using it now to see the payoff of the setup work.
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/dashboard">Create your first strategy</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/agency/ai-setup/guardrails?mode=advanced">Set up Creator AI next</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/agency/ai-setup?mode=advanced">Open advanced setup</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
