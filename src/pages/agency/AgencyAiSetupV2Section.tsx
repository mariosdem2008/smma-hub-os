import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgency } from "@/hooks/useAgency";
import { useRole } from "@/hooks/useRole";
import { useTouchAgencyAiSetupStatusV2 } from "@/hooks/useAgencyAiSetupV2";
import { AGENCY_AI_SETUP_STAGES, type AgencyAiSetupStageKey } from "@/lib/agency-ai-setup-v2/config";

const SECTION_NOTES: Record<AgencyAiSetupStageKey, { heading: string; body: string; nextLabel?: string; nextPath?: string }> = {
  overview: {
    heading: "Overview",
    body: "Use the overview page to understand current readiness, blockers, and the next recommended action.",
  },
  imports: {
    heading: "Imports",
    body: "This section will connect imported sources, surface extraction confidence, and let the team accept or reject extracted operating rules.",
    nextLabel: "Go to foundations",
    nextPath: "/agency/ai-setup/foundations",
  },
  foundations: {
    heading: "Agency Foundations",
    body: "This section will define agency identity, services, offers, and ICP segments from imported evidence plus guided structured entry.",
    nextLabel: "Go to modules",
    nextPath: "/agency/ai-setup/modules",
  },
  modules: {
    heading: "Operating Modules",
    body: "This section will become the main module workspace for definitions, rules, examples, anti-patterns, edge cases, evidence, and approvals.",
    nextLabel: "Go to guardrails",
    nextPath: "/agency/ai-setup/guardrails",
  },
  guardrails: {
    heading: "Quality And Guardrails",
    body: "This section will configure the quality bar, claims compliance, creative rules, and the non-negotiable standards that creator and client-facing agents must follow.",
    nextLabel: "Go to workflow",
    nextPath: "/agency/ai-setup/workflow",
  },
  workflow: {
    heading: "Workflow And Approvals",
    body: "This section will define lifecycle stages, owners, approval classes, delivery SOPs, and escalation rules for the AI operating model.",
    nextLabel: "Go to readiness",
    nextPath: "/agency/ai-setup/readiness",
  },
  readiness: {
    heading: "Readiness Review",
    body: "This section will become the readiness dashboard with remediation tasks, previews, and explicit unlock logic per agent class.",
    nextLabel: "Go to activation",
    nextPath: "/agency/ai-setup/activation",
  },
  activation: {
    heading: "Activation",
    body: "This section will control staged rollout so agencies can activate strategist, creator, operator, analyst, and client-facing agents progressively.",
    nextLabel: "Go to control center",
    nextPath: "/agency/ai-setup/control-center",
  },
  "control-center": {
    heading: "Control Center",
    body: "This section will become the ongoing AI operations panel for drift alerts, re-review queues, and live agent status.",
  },
  legacy: {
    heading: "Legacy Setup",
    body: "The legacy setup surface remains available while V2 is being built out. Use it only for compatibility workflows.",
  },
};

export default function AgencyAiSetupV2Section({ stageKey }: { stageKey: AgencyAiSetupStageKey }) {
  const { agencyId } = useAgency();
  const { canEditContent } = useRole();
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const stage = AGENCY_AI_SETUP_STAGES.find((item) => item.key === stageKey)!;
  const note = SECTION_NOTES[stageKey];

  useEffect(() => {
    if (!agencyId || !canEditContent) return;
    touchStatus.mutate({ stage: stageKey, step: stageKey, state: "in_progress" });
  }, [agencyId, canEditContent, stageKey]);

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{note.heading}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{note.body}</p>
            </div>
            <Badge variant="secondary">{stage.title}</Badge>
          </div>

          <div className="rounded-xl border border-dashed border-border/60 bg-background/50 p-5">
            <div className="text-sm font-medium text-foreground">Phase 1 placeholder</div>
            <div className="mt-2 text-sm text-muted-foreground">
              The route shell, resume-state updates, and overview logic are implemented. The full workflow for this section is intentionally not faked yet.
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {note.nextPath && note.nextLabel && (
              <Button asChild>
                <Link to={note.nextPath}>
                  {note.nextLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/agency/ai-setup">Back to overview</Link>
            </Button>
            {stageKey !== "legacy" && (
              <Button variant="ghost" asChild>
                <Link to="/agency/ai-setup/legacy">Open legacy setup</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
