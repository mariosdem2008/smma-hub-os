import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AgencyAiSetupCheckpointCard } from "@/components/agency-ai-setup-v2/AgencyAiSetupCheckpointCard";
import { AgencyAiSetupQuickSimulationCard } from "@/components/agency-ai-setup-v2/AgencyAiSetupQuickSimulationCard";
import { useAgency } from "@/hooks/useAgency";
import { useRole } from "@/hooks/useRole";
import {
  useCreateAgencyAiSetupSimulationV2,
  useAgencyAiSetupResolvedState,
  usePersistAgencyAiSetupCheckpointV2,
  useSaveAgencyAiSetupWorkflowV2,
  useTouchAgencyAiSetupStatusV2,
  type AgencyAiSetupSimulationV2Record,
} from "@/hooks/useAgencyAiSetupV2";
import { useToast } from "@/hooks/use-toast";
import {
  buildWorkflowFieldCoaching,
  buildCheckpointSnapshot,
  type AgencyAiSetupCheckpointSnapshot,
  strengthenSetupList,
  strengthenSetupTextarea,
} from "@/lib/agency-ai-setup-v2/adoption";

function GuidanceCard({
  title,
  why,
  good,
  weak,
}: {
  title: string;
  why: string;
  good: string;
  weak: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Why this matters:</span> {why}
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        <span className="font-medium text-emerald-300">Good:</span> {good}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-amber-300">Weak:</span> {weak}
      </div>
    </div>
  );
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const WORKFLOW_STARTER = {
  lifecycleStages: "qualified, scoped, onboarding, strategy review, client approval, production, reporting, renewal",
  approvalClasses: "strategy approval, creative approval, client response approval, launch approval",
  deliverySops: "brief before production, internal review before client delivery, approval required before publish",
  reportingExpectations: "monthly performance review, weekly blocker visibility, action-oriented recommendations",
  escalationRules: "pause dependent work when approval is blocked, escalate overdue approvals after 3 business days, escalate risky claims immediately",
  workflowNotes:
    "AI should default to internal assist behavior when approvals are unclear and escalate to the account lead instead of guessing.",
};

function getListStrength(value: string, minimumItems: number) {
  const items = splitCsv(value);
  if (!items.length) return { label: "Missing", tone: "text-amber-300", note: "Add concrete workflow items instead of leaving this blank." };
  if (items.length < minimumItems) {
    return { label: "Thin coverage", tone: "text-amber-300", note: `Add at least ${minimumItems} concrete items to make this operationally useful.` };
  }
  return { label: "Usable", tone: "text-emerald-300", note: "This is detailed enough for a working operator draft." };
}

function getTextStrength(value: string, minimumLength: number) {
  const trimmed = value.trim();
  if (!trimmed) return { label: "Optional", tone: "text-muted-foreground", note: "No notes added yet." };
  if (trimmed.length < minimumLength) {
    return { label: "Thin coverage", tone: "text-amber-300", note: "This likely needs more concrete operator detail." };
  }
  return { label: "Useful detail", tone: "text-emerald-300", note: "This gives the AI extra workflow context." };
}

function CoachingCard({
  title,
  headline,
  guidance,
}: {
  title: string;
  headline: string;
  guidance: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-2 text-sm text-foreground">{headline}</div>
      <div className="mt-2 text-xs text-muted-foreground">{guidance}</div>
    </div>
  );
}

export default function AgencyAiSetupV2Workflow() {
  const { agencyId } = useAgency();
  const { canEditContent } = useRole();
  const { status } = useAgencyAiSetupResolvedState(agencyId);
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const saveWorkflow = useSaveAgencyAiSetupWorkflowV2(agencyId);
  const createSimulation = useCreateAgencyAiSetupSimulationV2(agencyId);
  const persistCheckpoint = usePersistAgencyAiSetupCheckpointV2(agencyId);
  const { toast } = useToast();
  const [quickSimulation, setQuickSimulation] = useState<AgencyAiSetupSimulationV2Record | null>(null);
  const [checkpoint, setCheckpoint] = useState<AgencyAiSetupCheckpointSnapshot | null>(null);

  const existing = useMemo(() => {
    const meta = (status?.meta_json ?? {}) as Record<string, any>;
    return meta.workflow ?? {};
  }, [status?.meta_json]);

  const [lifecycleStages, setLifecycleStages] = useState("");
  const [approvalClasses, setApprovalClasses] = useState("");
  const [deliverySops, setDeliverySops] = useState("");
  const [reportingExpectations, setReportingExpectations] = useState("");
  const [escalationRules, setEscalationRules] = useState("");
  const [workflowNotes, setWorkflowNotes] = useState("");

  useEffect(() => {
    setLifecycleStages(Array.isArray(existing.lifecycle_stages) ? existing.lifecycle_stages.join(", ") : "");
    setApprovalClasses(Array.isArray(existing.approval_classes) ? existing.approval_classes.join(", ") : "");
    setDeliverySops(Array.isArray(existing.delivery_sops) ? existing.delivery_sops.join(", ") : "");
    setReportingExpectations(Array.isArray(existing.reporting_expectations) ? existing.reporting_expectations.join(", ") : "");
    setEscalationRules(Array.isArray(existing.escalation_rules) ? existing.escalation_rules.join(", ") : "");
    setWorkflowNotes(existing.workflow_notes ?? "");
  }, [existing]);

  useEffect(() => {
    const stored = ((status?.meta_json ?? {}) as Record<string, any>)?.checkpoints?.workflow;
    setCheckpoint(stored ?? null);
  }, [status?.meta_json]);

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "workflow", step: "workflow", state: "in_progress" });
    }
  }, [agencyId, canEditContent]);

  const handleSave = async () => {
    try {
      const saved = await saveWorkflow.mutateAsync({
        lifecycle_stages: splitCsv(lifecycleStages),
        approval_classes: splitCsv(approvalClasses),
        delivery_sops: splitCsv(deliverySops),
        reporting_expectations: splitCsv(reportingExpectations),
        escalation_rules: splitCsv(escalationRules),
        workflow_notes: workflowNotes.trim(),
      });
      const unlock = saved.derived.unlocks.find((item) => item.agent_class === "operator");
      if (unlock) {
        const simulation = await createSimulation.mutateAsync({
          agentClass: "operator",
          unlockState: unlock.unlock_state,
          readinessLabel: saved.derived.overall_label,
          blockers: unlock.blocked_reasons,
          activated: false,
          activationMode: null,
          readinessScores: {
            knowledge_coverage: saved.derived.knowledge_coverage,
            process_definition: saved.derived.process_definition,
            quality_definition: saved.derived.quality_definition,
            compliance_safety: saved.derived.compliance_safety,
            approval_governance: saved.derived.approval_governance,
            evidence_strength: saved.derived.evidence_strength,
          },
        });
        setQuickSimulation(simulation);
        const nextCheckpoint = buildCheckpointSnapshot("operator", saved.derived, simulation);
        setCheckpoint(nextCheckpoint);
        await persistCheckpoint.mutateAsync({ stage: "workflow", checkpoint: nextCheckpoint });
      } else {
        const nextCheckpoint = buildCheckpointSnapshot("operator", saved.derived, null);
        setCheckpoint(nextCheckpoint);
        await persistCheckpoint.mutateAsync({ stage: "workflow", checkpoint: nextCheckpoint });
      }
      toast({
        title: "Workflow saved",
        description: "Workflow was saved and a quick Operator AI coaching preview was generated.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const applyStarterDraft = () => {
    setLifecycleStages((current) => current || WORKFLOW_STARTER.lifecycleStages);
    setApprovalClasses((current) => current || WORKFLOW_STARTER.approvalClasses);
    setDeliverySops((current) => current || WORKFLOW_STARTER.deliverySops);
    setReportingExpectations((current) => current || WORKFLOW_STARTER.reportingExpectations);
    setEscalationRules((current) => current || WORKFLOW_STARTER.escalationRules);
    setWorkflowNotes((current) => current || WORKFLOW_STARTER.workflowNotes);
  };

  const lifecycleStrength = getListStrength(lifecycleStages, 4);
  const approvalStrength = getListStrength(approvalClasses, 2);
  const escalationStrength = getListStrength(escalationRules, 2);
  const workflowNotesStrength = getTextStrength(workflowNotes, 80);
  const lifecycleCoaching = buildWorkflowFieldCoaching({
    fieldLabel: "Lifecycle stages",
    currentValue: lifecycleStages,
    starterValue: WORKFLOW_STARTER.lifecycleStages,
    minItems: 4,
    focus: "Operator workflow",
  });
  const approvalCoaching = buildWorkflowFieldCoaching({
    fieldLabel: "Approval classes",
    currentValue: approvalClasses,
    starterValue: WORKFLOW_STARTER.approvalClasses,
    minItems: 2,
    focus: "Operator workflow",
  });
  const escalationCoaching = buildWorkflowFieldCoaching({
    fieldLabel: "Escalation rules",
    currentValue: escalationRules,
    starterValue: WORKFLOW_STARTER.escalationRules,
    minItems: 2,
    focus: "Operator workflow",
  });

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <Workflow className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Workflow And Approvals</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Define the operating path the AI team should follow: stages, approval classes, SOP checkpoints, escalation rules, and reporting expectations.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">How to complete this step well</div>
            <div className="mt-2">Describe the real path your agency follows after work is scoped: who approves, what comes next, and where AI must wait for a human decision.</div>
            <div className="mt-2">If this page stays vague, operator agents will make the wrong assumptions about sequencing, ownership, and escalation.</div>
            <div className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={applyStarterDraft}>
                Use starter workflow
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <GuidanceCard
              title="Lifecycle and approvals"
              why="Operator and strategy agents need the real workflow spine, not generic labels."
              good="Qualified, scoped, onboarding, internal strategy review, client approval, production, reporting, renewal."
              weak="Lead, active, done."
            />
            <GuidanceCard
              title="Delivery and escalation"
              why="This tells AI when it can proceed and when it must stop and hand off to a human."
              good="If client approval is pending more than 3 business days, escalate to the account lead and pause dependent tasks."
              weak="Escalate when needed."
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="text-sm font-medium text-foreground">Proof required before trusting operator agents</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                "A real lifecycle path with named stages",
                "At least 2 approval classes with clear meaning",
                "At least 2 delivery SOP checkpoints",
                "At least 2 escalation rules with a handoff condition",
                "At least 2 reporting expectations or cadence rules",
              ].map((item) => (
                <div key={item} className="rounded-lg border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lifecycle-stages">Lifecycle stages</Label>
              <Input
                id="lifecycle-stages"
                value={lifecycleStages}
                onChange={(event) => setLifecycleStages(event.target.value)}
                placeholder="comma-separated"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => setLifecycleStages(lifecycleCoaching.strengthenCopy)}
              >
                Strengthen this for me
              </Button>
              <div className={`text-xs ${lifecycleStrength.tone}`}>
                {lifecycleStrength.label}: {lifecycleStrength.note}
              </div>
              <p className="text-xs text-muted-foreground">Use the actual stages your agency uses to move work from scoped to reporting or renewal.</p>
              <CoachingCard
                title="Lifecycle coaching"
                headline={lifecycleCoaching.headline}
                guidance={lifecycleCoaching.guidance}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval-classes">Approval classes</Label>
              <Input
                id="approval-classes"
                value={approvalClasses}
                onChange={(event) => setApprovalClasses(event.target.value)}
                placeholder="comma-separated"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => setApprovalClasses(approvalCoaching.strengthenCopy)}
              >
                Strengthen this for me
              </Button>
              <div className={`text-xs ${approvalStrength.tone}`}>
                {approvalStrength.label}: {approvalStrength.note}
              </div>
              <p className="text-xs text-muted-foreground">Examples: strategy approval, creative approval, client-facing response approval, launch approval.</p>
              <CoachingCard
                title="Approval coaching"
                headline={approvalCoaching.headline}
                guidance={approvalCoaching.guidance}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-sops">Delivery SOPs</Label>
              <Input
                id="delivery-sops"
                value={deliverySops}
                onChange={(event) => setDeliverySops(event.target.value)}
                placeholder="comma-separated"
              />
              <p className="text-xs text-muted-foreground">Capture the checkpoints the team must follow, not generic process labels.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reporting-expectations">Reporting expectations</Label>
              <Input
                id="reporting-expectations"
                value={reportingExpectations}
                onChange={(event) => setReportingExpectations(event.target.value)}
                placeholder="comma-separated"
              />
              <p className="text-xs text-muted-foreground">Define cadence, decision owners, and what reporting must include.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="escalation-rules">Escalation rules</Label>
              <Input
                id="escalation-rules"
                value={escalationRules}
                onChange={(event) => setEscalationRules(event.target.value)}
                placeholder="comma-separated"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => setEscalationRules(escalationCoaching.strengthenCopy)}
              >
                Strengthen this for me
              </Button>
              <div className={`text-xs ${escalationStrength.tone}`}>
                {escalationStrength.label}: {escalationStrength.note}
              </div>
              <p className="text-xs text-muted-foreground">Write concrete handoff rules the AI can follow without guessing.</p>
              <CoachingCard
                title="Escalation coaching"
                headline={escalationCoaching.headline}
                guidance={escalationCoaching.guidance}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="workflow-notes">Additional workflow notes</Label>
              <Textarea
                id="workflow-notes"
                value={workflowNotes}
                onChange={(event) => setWorkflowNotes(event.target.value)}
                className="min-h-[110px]"
                placeholder="Optional notes that clarify how the AI should work through approvals, delivery, and reporting."
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() =>
                  setWorkflowNotes((current) =>
                    strengthenSetupTextarea(
                      current,
                      WORKFLOW_STARTER.workflowNotes,
                      "Explain what the AI should do when approval, ownership, or sequencing is unclear.",
                    ),
                  )
                }
              >
                Strengthen this for me
              </Button>
              <div className={`text-xs ${workflowNotesStrength.tone}`}>
                {workflowNotesStrength.label}: {workflowNotesStrength.note}
              </div>
              <p className="text-xs text-muted-foreground">Use this for exceptions, unusual branches, or operator judgment calls that do not fit simple lists.</p>
              <CoachingCard
                title="Workflow notes coaching"
                headline={
                  workflowNotes.trim()
                    ? workflowNotes.trim().length < 80
                      ? "Workflow notes need clearer operator detail"
                      : "Workflow notes are usable"
                    : "Workflow notes are optional for now"
                }
                guidance={
                  workflowNotes.trim()
                    ? workflowNotes.trim().length < 80
                      ? "Spell out what the AI should do when approval, ownership, or sequencing is unclear instead of leaving this as a short reminder."
                      : "This is strong enough for a first operator draft. Expand it only if the preview still shows workflow drift."
                    : "Leave this blank only if the workflow is straightforward. Use it when your team has exceptions or judgment calls the AI must learn."
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={!canEditContent || saveWorkflow.isPending}>
              {saveWorkflow.isPending ? "Saving..." : "Save workflow"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/agency/ai-setup/readiness">
                Continue to readiness
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AgencyAiSetupCheckpointCard
        title="Operator workflow checkpoint"
        reliableNow={checkpoint?.reliableNow ?? "The AI can start following a real workflow spine instead of assuming generic stages and handoffs."}
        stillWeak={checkpoint?.stillWeak ?? "Thin lifecycle and escalation rules still make operator behavior unreliable under pressure."}
        nextAction={checkpoint?.nextAction ?? "Tighten weak workflow rules, then run an operator preview before you treat this as trusted internal assist."}
        previewPath="/agency/ai-setup/readiness/preview/operator"
        previewLabel="Run a quick Operator AI preview"
        milestoneLabel={checkpoint?.milestoneLabel}
        updatedNote={checkpoint?.updatedNote}
      />

      <AgencyAiSetupQuickSimulationCard
        title="Quick Operator AI coaching preview"
        agentClass="operator"
        simulation={quickSimulation}
      />
    </div>
  );
}
