import { ArrowRight, CheckCircle2, Compass, FileStack, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyAiSetupResolvedState, useSelectAgencyAiSetupStrategyTemplateV2 } from "@/hooks/useAgencyAiSetupV2";
import { useLatestAgencyOperatingModulesV2 } from "@/hooks/useAgencyOperatingModulesV2";
import {
  AGENCY_AI_SETUP_STRATEGY_TEMPLATES,
  getAgencyAiSetupStrategyTemplate,
  getNextGuidedStrategySetupPath,
} from "@/lib/agency-ai-setup-v2/adoption";

export default function AgencyAiSetupV2Start() {
  const { agencyId } = useAgency();
  const { status, unlocks } = useAgencyAiSetupResolvedState(agencyId);
  const modulesQuery = useLatestAgencyOperatingModulesV2();
  const selectTemplate = useSelectAgencyAiSetupStrategyTemplateV2(agencyId);
  const strategyUnlock = unlocks.find((row) => row.agent_class === "strategy");
  const nextPath = getNextGuidedStrategySetupPath(
    status?.meta_json as Record<string, any> | undefined,
    modulesQuery.latestByKey,
  );
  const strategyCheckpoint = (status?.meta_json as Record<string, any> | undefined)?.checkpoints?.foundations;
  const selectedTemplate = getAgencyAiSetupStrategyTemplate(
    (status?.meta_json as Record<string, any> | undefined)?.guided_strategy_template_key,
  );

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <div className="text-sm font-medium uppercase tracking-[0.18em]">Enable Strategy AI First</div>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Start with one useful capability, not the whole AI system</h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  The full AI setup control plane is too much for a first pass. This guided path gets Strategy AI to its first trustworthy internal-assist state before you think about creator, operator, analyst, or client-facing workflows.
                </p>
              </div>
            </div>
            <Badge variant="secondary">
              {strategyUnlock?.unlock_state === "blocked" ? "Strategy AI not ready yet" : strategyUnlock?.unlock_state?.replace(/_/g, " ")}
            </Badge>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-sm font-medium text-foreground">What you are doing in this flow</div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <div>1. Import what already exists.</div>
              <div>2. Tighten the minimum strategic foundations.</div>
              <div>3. Set the first quality bar and review the draft.</div>
              <div>4. Run your first Strategy AI preview and fix what fails.</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to={nextPath}>
                Continue guided setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/agency/ai-setup?mode=advanced">Open full setup control plane</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {strategyCheckpoint ? (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Latest Strategy AI checkpoint</h2>
              <p className="text-sm text-muted-foreground">
                This keeps the guided path grounded in the last preview result instead of forcing you to remember where you left off.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Reliable now</div>
                <div className="mt-2 text-sm text-foreground">{strategyCheckpoint.reliableNow as string}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Still weak</div>
                <div className="mt-2 text-sm text-foreground">{strategyCheckpoint.stillWeak as string}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Next action</div>
                <div className="mt-2 text-sm text-foreground">{strategyCheckpoint.nextAction as string}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link to="/agency/ai-setup/readiness/preview/strategy">Reopen Strategy AI preview</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/agency/ai-setup/modules">Tighten minimum proof modules</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-3 p-5">
            <FileStack className="h-5 w-5 text-primary" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Import first</h2>
              <p className="text-sm text-muted-foreground">
                Do not write from zero unless the system truly has no evidence. Start from imported context and draft from there.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-3 p-5">
            <Compass className="h-5 w-5 text-primary" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Narrow the job</h2>
              <p className="text-sm text-muted-foreground">
                This guided path only asks for what Strategy AI needs first: who you serve, what you sell, and what good looks like.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-3 p-5">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Earn trust before scale</h2>
              <p className="text-sm text-muted-foreground">
                Strategy AI should become useful internally first. The rest of the agent classes can come after that proof exists.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pick the closest starting template</h2>
            <p className="text-sm text-muted-foreground">
              This does not lock the agency into a preset. It gives the guided path a better first draft so users are not authoring everything from zero.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {AGENCY_AI_SETUP_STRATEGY_TEMPLATES.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => selectTemplate.mutate(template.key)}
                className={`rounded-xl border p-4 text-left transition ${
                  selectedTemplate.key === template.key
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/60 bg-background/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-foreground">{template.title}</div>
                  {selectedTemplate.key === template.key ? <Badge variant="default">Selected</Badge> : null}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">{template.summary}</div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">First focus:</span> {template.firstFocus}
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="text-sm font-medium text-foreground">Current first-run template</div>
            <div className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedTemplate.title}:</span> {selectedTemplate.bestFor}
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">Why this flow is different</h2>
            <p className="text-sm text-muted-foreground">
              The advanced setup still exists. This page is the first-run path for agencies that have not meaningfully started Strategy AI setup yet.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              <div className="text-sm font-medium text-foreground">What this hides for now</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Full capability matrix, activation policy depth, certifications, and control-center thinking until the first Strategy AI path is understandable.
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              <div className="text-sm font-medium text-foreground">What this keeps visible</div>
              <div className="mt-2 text-sm text-muted-foreground">
                The exact next action, the minimum information required, and the payoff of getting Strategy AI to internal-assist quality.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
