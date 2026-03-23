import { Link, Outlet, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AgencyAiSetupWizardStepper } from "@/components/agency-ai-setup-v2/AgencyAiSetupWizardStepper";
import { AGENCY_AI_SETUP_STAGES } from "@/lib/agency-ai-setup-v2/config";
import { AGENCY_AI_SETUP_GUIDED_STEPS } from "@/lib/agency-ai-setup-v2/adoption";

export function AgencyAiSetupV2Shell({
  agencyName,
  readinessLabel,
  guidedMode = false,
  currentPath = "/agency/ai-setup",
  guidedStepIndex = -1,
}: {
  agencyName?: string | null;
  readinessLabel?: string | null;
  guidedMode?: boolean;
  currentPath?: string;
  guidedStepIndex?: number;
}) {
  const location = useLocation();
  const advancedLink = `${currentPath}?mode=advanced`;
  const nextGuidedStep =
    guidedStepIndex >= 0 ? AGENCY_AI_SETUP_GUIDED_STEPS[Math.min(guidedStepIndex + 1, AGENCY_AI_SETUP_GUIDED_STEPS.length - 1)] : null;
  const previousGuidedStep = guidedStepIndex > 0 ? AGENCY_AI_SETUP_GUIDED_STEPS[guidedStepIndex - 1] : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 p-6">
      <aside className={`${guidedMode ? "hidden" : "hidden w-80 shrink-0 lg:block"}`}>
        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-5 p-5">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                {guidedMode ? "Guided Strategy AI Setup" : "Agency AI Setup V2"}
              </div>
              <div className="text-lg font-semibold text-foreground">
                {agencyName || "Agency workspace"}
              </div>
              <div className="text-sm text-muted-foreground">
                {guidedMode
                  ? "Stay in the narrow first-run path until Strategy AI can safely help your team internally. The full setup system is still available when needed."
                  : "Start by enabling one specialist capability, review imported context, and expand what the AI can do as trust becomes real."}
              </div>
              {readinessLabel && <Badge variant="secondary">{readinessLabel}</Badge>}
            </div>

            <Separator />

            {guidedMode ? (
              <div className="space-y-3">
                <div className="text-sm font-medium text-foreground">Strategy-first journey</div>
                <div className="space-y-2">
                  {AGENCY_AI_SETUP_GUIDED_STEPS.map((step, index) => {
                    const active = step.matches(location.pathname);
                    const completed = guidedStepIndex > index;
                    return (
                      <div
                        key={step.key}
                        className={`rounded-lg border px-3 py-3 ${
                          active
                            ? "border-primary/40 bg-primary/10"
                            : completed
                              ? "border-emerald-500/30 bg-emerald-500/10"
                              : "border-border/50 bg-background/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-foreground">{step.title}</div>
                          <Badge variant={active ? "default" : completed ? "secondary" : "outline"}>
                            {active ? "Here" : completed ? "Done" : `Step ${index + 1}`}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{step.description}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-2">
                  {previousGuidedStep ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={previousGuidedStep.path}>Back</Link>
                    </Button>
                  ) : null}
                  {nextGuidedStep && !nextGuidedStep.matches(location.pathname) ? (
                    <Button asChild size="sm">
                      <Link to={nextGuidedStep.path}>Next</Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="ghost" size="sm">
                    <Link to={advancedLink}>Open advanced setup</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <nav className="space-y-1">
                {AGENCY_AI_SETUP_STAGES.map((stage) => {
                  const active =
                    stage.path === "/agency/ai-setup"
                      ? location.pathname === stage.path
                      : location.pathname === stage.path || location.pathname.startsWith(`${stage.path}/`);

                  return (
                    <Link
                      key={stage.key}
                      to={stage.path}
                      className={`block rounded-lg border px-3 py-3 transition-colors ${
                        active
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/50 bg-background/50 hover:bg-background/80"
                      }`}
                    >
                      <div className="text-sm font-medium text-foreground">{stage.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{stage.description}</div>
                    </Link>
                  );
                })}
              </nav>
            )}

            <Separator />

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">
                {guidedMode ? "Why this stays narrow" : "Recommended first path"}
              </div>
              <div>
                {guidedMode ? (
                  <>
                    Get <span className="font-medium text-foreground">Strategy AI</span> useful internally before the user has to interpret
                    advanced setup policy, rollout decisions, or the broader capability matrix.
                  </>
                ) : (
                  <>
                    Enable <span className="font-medium text-foreground">Strategy AI</span> first, then expand into creator,
                    operator, analyst, and client-facing workflows after deeper approval.
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        {guidedMode ? (
          <AgencyAiSetupWizardStepper
            steps={AGENCY_AI_SETUP_GUIDED_STEPS.map((step, index) => ({
              label: step.title,
              route: step.path,
              status: guidedStepIndex === index ? "current" : guidedStepIndex > index ? "done" : "upcoming",
            }))}
            currentIndex={Math.max(guidedStepIndex, 0)}
            onBack={previousGuidedStep?.path ?? null}
            onNext={nextGuidedStep && !nextGuidedStep.matches(location.pathname) ? nextGuidedStep.path : null}
            advancedLink={advancedLink}
          />
        ) : (
          <div className="flex flex-wrap gap-2 lg:hidden">
            {AGENCY_AI_SETUP_STAGES.map((stage) => (
              <Button
                key={stage.key}
                asChild
                size="sm"
                variant={location.pathname === stage.path || location.pathname.startsWith(`${stage.path}/`) ? "default" : "outline"}
              >
                <Link to={stage.path}>{stage.title}</Link>
              </Button>
            ))}
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}
