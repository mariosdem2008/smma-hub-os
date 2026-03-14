import { AlertCircle, ArrowRight, CheckCircle2, RefreshCcw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAgency } from "@/hooks/useAgency";
import {
  useAgencyAiSetupResolvedState,
  useRunAgencyAiSetupReadinessReviewV2,
  useRevokeAgencyAiCertificationV2,
  useTouchAgencyAiSetupStatusV2,
} from "@/hooks/useAgencyAiSetupV2";
import { useLatestAgencyOperatingModulesV2 } from "@/hooks/useAgencyOperatingModulesV2";
import { useRole } from "@/hooks/useRole";
import { useEffect, useMemo } from "react";
import {
  AGENCY_AI_ACTIVATION_MODE_LABELS,
  AGENCY_AI_SETUP_READINESS_DIMENSIONS,
  formatUnlockStateLabel,
} from "@/lib/agency-ai-setup-v2/config";
import { deriveAgencyAiSetupInvalidationState } from "@/lib/agency-ai-setup-v2/invalidation";

function formatAgentClassLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatScenarioLabel(value: string) {
  return value.replace(/_/g, " ");
}

function getTrustSummary(unlockState: string) {
  if (unlockState === "operational") {
    return {
      label: "Trusted for controlled activation",
      tone: "text-emerald-300",
      description: "This capability is ready to move beyond setup and into controlled operational use.",
    };
  }

  if (unlockState === "internal_assist_only") {
    return {
      label: "Usable with human review",
      tone: "text-primary",
      description: "This capability can help internally, but it should not act like a trusted autonomous teammate yet.",
    };
  }

  if (unlockState === "preview_only") {
    return {
      label: "Preview only",
      tone: "text-amber-300",
      description: "This capability can be tested and simulated, but it is not ready for real workflow execution.",
    };
  }

  return {
    label: "Not trusted yet",
    tone: "text-amber-300",
    description: "This capability is still missing essential setup evidence or approvals.",
  };
}

export default function AgencyAiSetupV2Readiness() {
  const { agencyId } = useAgency();
  const { canEditContent } = useRole();
  const { status, readiness, unlocks, certifications } = useAgencyAiSetupResolvedState(agencyId);
  const modulesQuery = useLatestAgencyOperatingModulesV2();
  const runReview = useRunAgencyAiSetupReadinessReviewV2(agencyId);
  const revokeCertification = useRevokeAgencyAiCertificationV2(agencyId);
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
  const staleCapabilitySummaries = unlocks
    .map((unlock) => ({
      unlock,
      invalidation: invalidation[unlock.agent_class],
    }))
    .filter((item) => item.invalidation.staleCertifications.length > 0);

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "readiness", step: "readiness", state: "ready_for_review" });
    }
  }, [agencyId, canEditContent]);

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">Readiness Review</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Review the computed readiness, confirm the remaining blockers, and move the setup into activation once the current setup is strong enough.
              </p>
            </div>
            <Badge variant="secondary">{readiness.overall_label}</Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => runReview.mutate()} disabled={!canEditContent || runReview.isPending}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              {runReview.isPending ? "Running review..." : "Run readiness review"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/agency/ai-setup/activation">
                Continue to activation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {staleCapabilitySummaries.length ? (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Trust needs revalidation after recent setup changes</h2>
              <p className="text-sm text-muted-foreground">
                Some certified capabilities are now based on setup evidence that changed after certification. Re-run previews and certifications before treating them as trusted.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {staleCapabilitySummaries.map(({ unlock, invalidation: stale }) => (
                <div key={unlock.agent_class} className="rounded-lg border border-amber-500/30 bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-foreground">{formatAgentClassLabel(unlock.agent_class)}</div>
                    <Badge variant="secondary">Certification stale</Badge>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {stale.staleCertifications.length} certification{stale.staleCertifications.length === 1 ? "" : "s"} need revalidation.
                  </div>
                  <div className="mt-3 space-y-2">
                    {stale.staleReasons.map((reason) => (
                      <div key={reason} className="text-xs text-muted-foreground">{reason}</div>
                    ))}
                  </div>
                  {stale.staleScenarioKeys.length ? (
                    <div className="mt-3 rounded-md border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
                      Re-run scenarios: {stale.staleScenarioKeys.map(formatScenarioLabel).join(", ")}.
                    </div>
                  ) : null}
                  <div className="mt-4">
                    <Button variant="ghost" size="sm" asChild className="px-0">
                      <Link to={`/agency/ai-setup/readiness/preview/${unlock.agent_class}`}>Re-run this readiness preview</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Readiness dimensions</h2>
              <p className="text-sm text-muted-foreground">These scores now reflect imports, foundations, approved modules, guardrails, and workflow setup.</p>
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
              <p className="text-sm text-muted-foreground">Resolve these before treating the AI team as expert-quality ready.</p>
            </div>
            <div className="space-y-3">
              {(readiness.critical_blockers.length ? readiness.critical_blockers : ["No critical blockers recorded."]).map((blocker) => (
                <div key={blocker} className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-amber-300" />
                  <div className="text-sm text-foreground">{blocker}</div>
                </div>
              ))}
              {readiness.warnings?.map((warning) => (
                <div key={warning} className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
                  {warning}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Certification status</h2>
              <p className="text-sm text-muted-foreground">Passing simulations can now be promoted into durable certifications with revocation history.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {certifications.length ? (
              certifications.map((certification) => {
                const staleState = invalidation[certification.agent_class];
                const isStale = staleState.staleCertifications.some((row) => row.id === certification.id);
                return (
                <div key={certification.id} className="rounded-lg border border-border/60 bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium capitalize text-foreground">
                        {certification.agent_class.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs text-muted-foreground">{certification.scenario_title}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isStale ? <Badge variant="secondary">Stale</Badge> : null}
                      <Badge variant={certification.certification_state === "certified" ? "default" : "secondary"}>
                        {certification.certification_state.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Latest result: {certification.latest_result}
                  </div>
                  {certification.certified_at ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Certified {new Date(certification.certified_at).toLocaleString()}
                    </div>
                  ) : null}
                  {certification.note ? (
                    <div className="mt-3 rounded-md border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
                      {certification.note}
                    </div>
                  ) : null}
                  {isStale ? (
                    <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
                      This certification is outdated because newer setup evidence was added after it was certified.
                    </div>
                  ) : null}
                  {certification.certification_state === "certified" ? (
                    <div className="mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEditContent || revokeCertification.isPending}
                        onClick={() =>
                          revokeCertification.mutate({
                            certificationId: certification.id,
                            note: "Revoked pending updated simulation evidence.",
                          })
                        }
                      >
                        Revoke certification
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                No certification records yet. Run scenario previews and promote a passing run from Control Center.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Capability trust levels</h2>
            <p className="text-sm text-muted-foreground">Read this as the answer to what the agency can already trust and what still needs proof before activation.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {unlocks.map((unlock) => (
              <div key={unlock.agent_class} className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-foreground">{formatAgentClassLabel(unlock.agent_class)}</div>
                  <div className="flex items-center gap-2">
                    {invalidation[unlock.agent_class].staleCertifications.length ? <Badge variant="secondary">Needs revalidation</Badge> : null}
                    <Badge variant={unlock.unlock_state === "operational" ? "default" : "secondary"}>
                      {formatUnlockStateLabel(unlock.unlock_state)}
                    </Badge>
                  </div>
                </div>
                <div className={`mt-3 text-sm font-medium ${getTrustSummary(unlock.unlock_state).tone}`}>
                  {getTrustSummary(unlock.unlock_state).label}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {getTrustSummary(unlock.unlock_state).description}
                </div>
                <div className="mt-3 space-y-2">
                  {(unlock.blocked_reasons.length ? unlock.blocked_reasons : ["No blocking reasons recorded"]).map((reason) => (
                    <div key={reason} className="text-xs text-muted-foreground">{reason}</div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Max rollout mode:{" "}
                  {unlock.unlock_state === "blocked"
                    ? "Blocked"
                    : AGENCY_AI_ACTIVATION_MODE_LABELS[unlock.unlock_state]}
                </div>
                {invalidation[unlock.agent_class].staleScenarioKeys.length ? (
                  <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
                    Revalidate: {invalidation[unlock.agent_class].staleScenarioKeys.map(formatScenarioLabel).join(", ")}.
                  </div>
                ) : null}
                <div className="mt-4">
                  <Button variant="ghost" size="sm" asChild className="px-0">
                    <Link to={`/agency/ai-setup/readiness/preview/${unlock.agent_class}`}>Preview this agent</Link>
                  </Button>
                </div>
                {unlock.unlock_state === "operational" && (
                  <div className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Ready for controlled activation
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
