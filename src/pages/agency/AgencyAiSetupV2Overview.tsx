import { AlertCircle, ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyAiSetupResolvedState } from "@/hooks/useAgencyAiSetupV2";
import {
  AGENCY_AI_AGENT_CLASSES,
  AGENCY_AI_SETUP_READINESS_DIMENSIONS,
  AGENCY_AI_SETUP_STAGES,
  formatUnlockStateLabel,
} from "@/lib/agency-ai-setup-v2/config";

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getCapabilityMilestone(unlockState?: string) {
  if (unlockState === "operational") {
    return {
      title: "Certified for controlled rollout",
      description: "This capability has enough proof to move into governed live use.",
    };
  }

  if (unlockState === "internal_assist_only") {
    return {
      title: "Useful internally",
      description: "This capability can help the team, but it still needs review before live execution.",
    };
  }

  if (unlockState === "preview_only") {
    return {
      title: "Ready for preview",
      description: "This capability can be simulated and reviewed, but not trusted in real workflow yet.",
    };
  }

  return {
    title: "Not trusted yet",
    description: "Still missing setup evidence or approvals before meaningful use.",
  };
}

export default function AgencyAiSetupV2Overview() {
  const { agencyId } = useAgency();
  const { status, readiness, unlocks, isLoading } = useAgencyAiSetupResolvedState(agencyId);

  const readinessValues = AGENCY_AI_SETUP_READINESS_DIMENSIONS.map((item) => readiness[item.key]);
  const averageScore = average(readinessValues);
  const nextStage = AGENCY_AI_SETUP_STAGES.find((stage) => stage.key === (status?.current_stage ?? "imports")) ?? AGENCY_AI_SETUP_STAGES[1];
  const blockedAgentCount = unlocks.filter((row) => row.unlock_state === "blocked").length;
  const strategyUnlock = unlocks.find((row) => row.agent_class === "strategy");
  const strategyCheckpoint = (status?.meta_json as Record<string, any> | undefined)?.checkpoints?.foundations;
  const strategyPathLabel =
    strategyUnlock?.unlock_state === "operational"
      ? "Ready for operational use"
      : strategyUnlock?.unlock_state === "internal_assist_only"
        ? "Ready for internal assist"
        : strategyUnlock?.unlock_state === "preview_only"
          ? "Ready to preview"
          : "Not ready yet";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-semibold text-foreground">Agency AI Setup V2</h1>
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Do not try to configure the whole AI system at once. Start by enabling Strategy AI, review imported context, and earn trust one capability at a time.
              </p>
            </div>
            <Badge variant="secondary" className="text-sm">
              {readiness.overall_label}
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Strategy AI milestone</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{getCapabilityMilestone(strategyUnlock?.unlock_state).title}</div>
              <div className="mt-2 text-sm text-muted-foreground">{getCapabilityMilestone(strategyUnlock?.unlock_state).description}</div>
              <Progress value={averageScore} className="mt-3" />
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Current stage</div>
              <div className="mt-2 text-lg font-semibold text-foreground">
                {status?.current_stage ? status.current_stage.replace(/_/g, " ") : "Not started"}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Last active {status?.last_active_at ? new Date(status.last_active_at).toLocaleString() : "not recorded"}
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Blocked agent classes</div>
              <div className="mt-2 text-3xl font-semibold text-foreground">{blockedAgentCount}</div>
              <div className="mt-2 text-sm text-muted-foreground">Agents remain gated until required modules and scores are in place.</div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-primary/80">Recommended first path</div>
                <div className="text-xl font-semibold text-foreground">Enable Strategy AI first</div>
                <div className="max-w-3xl text-sm text-muted-foreground">
                  Import what already exists, tighten the foundations, and certify one specialist capability before moving into creator, operator, analyst, or client-facing AI.
                </div>
                <div className="text-sm text-muted-foreground">
                  Current Strategy AI trust state: <span className="font-medium text-foreground">{strategyPathLabel}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to={nextStage.path}>
                    Continue Strategy AI setup
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/agency/ai-setup/readiness/preview/strategy">Preview Strategy AI readiness</Link>
                </Button>
              </div>
            </div>
          </div>

          {strategyCheckpoint ? (
            <div className="rounded-xl border border-border/60 bg-background/60 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest Strategy AI preview</div>
                  <div className="text-lg font-semibold text-foreground">
                    {(strategyCheckpoint.milestoneLabel as string | undefined) ?? "Latest checkpoint"}
                  </div>
                  <div className="max-w-3xl text-sm text-muted-foreground">
                    {(strategyCheckpoint.reliableNow as string | undefined) ?? "No preview summary recorded yet."}
                  </div>
                  <div className="text-sm text-foreground">
                    <span className="font-medium">Fix next:</span> {(strategyCheckpoint.nextAction as string | undefined) ?? "Open the Strategy AI preview and run the next check."}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" asChild>
                    <Link to="/agency/ai-setup/readiness/preview/strategy">Reopen Strategy AI preview</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link to="/agency/ai-setup/modules">Open minimum proof modules</Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link to={nextStage.path}>
                Continue setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/agency/ai-setup/readiness">Run readiness review</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/agency/ai-setup/legacy">Open legacy setup</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-border/60 bg-card/40 xl:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Readiness dimensions</h2>
              <p className="text-sm text-muted-foreground">
                These scores will become the unlock logic for strategy, creator, operator, analyst, and client-facing agents.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {AGENCY_AI_SETUP_READINESS_DIMENSIONS.map((dimension) => {
                const value = readiness[dimension.key];
                return (
                  <div key={dimension.key} className="rounded-lg border border-border/60 bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-foreground">{dimension.title}</div>
                      <div className="text-sm text-muted-foreground">{value}%</div>
                    </div>
                    <Progress value={value} className="mt-3" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Critical blockers</h2>
              <p className="text-sm text-muted-foreground">
                The setup should explain exactly why agents are still gated.
              </p>
            </div>
            <div className="space-y-3">
              {(readiness.critical_blockers.length ? readiness.critical_blockers : ["No critical blockers recorded yet."]).map((blocker) => (
                <div key={blocker} className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-amber-300" />
                  <div className="text-sm text-foreground">{blocker}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Capability readiness</h2>
            <p className="text-sm text-muted-foreground">
              Do not activate everything at once. Enable one capability, prove it internally, then expand.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {AGENCY_AI_AGENT_CLASSES.map((agent) => {
              const current = unlocks.find((row) => row.agent_class === agent.key);
              const reasons = current?.blocked_reasons ?? [];
              return (
                <div key={agent.key} className="rounded-lg border border-border/60 bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{agent.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{agent.description}</div>
                      <div className="mt-2 text-xs text-foreground/90">{getCapabilityMilestone(current?.unlock_state).title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{getCapabilityMilestone(current?.unlock_state).description}</div>
                      {agent.key !== "strategy" ? (
                        <div className="mt-2 text-xs text-muted-foreground">Recommended after Strategy AI is certified.</div>
                      ) : (
                        <div className="mt-2 text-xs text-primary/90">Recommended first capability.</div>
                      )}
                    </div>
                    <Badge variant={current?.unlock_state === "operational" ? "default" : "secondary"}>
                      {formatUnlockStateLabel(current?.unlock_state)}
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-2">
                    {reasons.length ? (
                      reasons.slice(0, 2).map((reason) => (
                        <div key={reason} className="text-xs text-muted-foreground">
                          {reason}
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        No blocking reasons recorded
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <Button variant="ghost" size="sm" asChild className="px-0">
                      <Link to={`/agency/ai-setup/readiness/preview/${agent.key}`}>See trust path</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">What to do next</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              <div className="text-sm font-medium text-foreground">1. Review imported context</div>
              <div className="mt-2 text-sm text-muted-foreground">Start from drafted evidence instead of writing everything from zero.</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              <div className="text-sm font-medium text-foreground">2. Tighten foundations</div>
              <div className="mt-2 text-sm text-muted-foreground">Define your positioning, offers, ICP, and what good Strategy AI output should look like.</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              <div className="text-sm font-medium text-foreground">3. Earn Strategy AI trust</div>
              <div className="mt-2 text-sm text-muted-foreground">Run readiness review, fix gaps, then activate Strategy AI before moving to other agent classes.</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
