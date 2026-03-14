import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Save, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { AgencyAiSetupCheckpointCard } from "@/components/agency-ai-setup-v2/AgencyAiSetupCheckpointCard";
import { useAgency } from "@/hooks/useAgency";
import { useApprovedBrainDocuments } from "@/hooks/useBrainDocuments";
import { useRole } from "@/hooks/useRole";
import { useAgencyAiSetupResolvedState, useTouchAgencyAiSetupStatusV2 } from "@/hooks/useAgencyAiSetupV2";
import {
  useAgencyOperatingModuleReviewsV2,
  useEnsureAgencyOperatingModuleDraftV2,
  useLatestAgencyOperatingModulesV2,
  useReviewAgencyOperatingModuleV2,
  useSaveAgencyOperatingModuleV2,
} from "@/hooks/useAgencyOperatingModulesV2";
import {
  assessAgencyAiSetupModuleContent,
  type AgencyAiSetupCoreModuleKey,
  buildDefaultAgencyOperatingModuleV2,
  getAgencyAiSetupModuleMeta,
  isAgencyAiSetupCoreModuleKey,
} from "@/lib/agency-ai-setup-v2/modules";
import type { AgencyOperatingModuleV2 } from "@/lib/strategy/v2/contracts";
import { useToast } from "@/hooks/use-toast";
import { buildSuggestedAgencyOperatingModuleDraft, strengthenSetupTextarea } from "@/lib/agency-ai-setup-v2/adoption";

function joinStatements<T>(items: T[] | undefined, pick: (item: T) => string) {
  return (items ?? []).map(pick).filter(Boolean).join("\n");
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toRules(value: string) {
  return splitLines(value).map((statement, index) => ({
    id: `rule_${index + 1}`,
    statement,
  }));
}

function toExamples(value: string) {
  return splitLines(value).map((summary, index) => ({
    id: `example_${index + 1}`,
    title: `Example ${index + 1}`,
    summary,
  }));
}

function toAntiPatterns(value: string) {
  return splitLines(value).map((statement, index) => ({
    id: `anti_${index + 1}`,
    statement,
  }));
}

function toEdgeCases(value: string) {
  return splitLines(value).map((guidance, index) => ({
    id: `edge_${index + 1}`,
    condition: `Case ${index + 1}`,
    guidance,
  }));
}

function toEvidenceSources(value: string) {
  return splitLines(value).map((label, index) => ({
    type: "manual_note",
    ref_id: `manual_${index + 1}`,
    label,
  }));
}

function formatStatus(status: string | null | undefined) {
  switch (status) {
    case "approved":
      return "Approved";
    case "review":
      return "In Review";
    case "draft":
      return "Draft";
    case "archived":
      return "Archived";
    default:
      return "Not Started";
  }
}

export default function AgencyAiSetupV2ModuleDetail() {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const validModuleKey = moduleKey && isAgencyAiSetupCoreModuleKey(moduleKey) ? moduleKey : null;
  const { agencyId } = useAgency();
  const { status } = useAgencyAiSetupResolvedState(agencyId);
  const { data: approvedDocs = [] } = useApprovedBrainDocuments();
  const { canEditContent } = useRole();
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const modulesQuery = useLatestAgencyOperatingModulesV2();
  const reviewsQuery = useAgencyOperatingModuleReviewsV2();
  const saveModule = useSaveAgencyOperatingModuleV2();
  const reviewModule = useReviewAgencyOperatingModuleV2();
  const ensureDraft = useEnsureAgencyOperatingModuleDraftV2();
  const { toast } = useToast();

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "modules", step: moduleKey ?? "modules", state: "in_progress" });
    }
  }, [agencyId, canEditContent, moduleKey]);
  const normalizedModuleKey = validModuleKey ?? "agency_identity";
  const moduleMeta = getAgencyAiSetupModuleMeta(normalizedModuleKey);
  const latestRecord = modulesQuery.latestByKey.get(normalizedModuleKey);
  const reviewHistory = (reviewsQuery.data ?? []).filter((item) => item.module_key === normalizedModuleKey).slice(0, 5);
  const currentContent = latestRecord?.content_json ?? buildDefaultAgencyOperatingModuleV2(normalizedModuleKey);
  const metaJson = useMemo(() => ((status?.meta_json ?? {}) as Record<string, unknown>), [status?.meta_json]);
  const suggestedDraft = useMemo(
    () =>
      buildSuggestedAgencyOperatingModuleDraft(
        normalizedModuleKey as AgencyAiSetupCoreModuleKey,
        metaJson as any,
        approvedDocs.map((doc) => ({ id: doc.id, title: doc.title, module: doc.module })),
      ),
    [approvedDocs, metaJson, normalizedModuleKey],
  );

  const [title, setTitle] = useState(currentContent.title);
  const [definition, setDefinition] = useState(currentContent.definition);
  const [rulesText, setRulesText] = useState(joinStatements(currentContent.rules, (item) => item.statement));
  const [examplesText, setExamplesText] = useState(joinStatements(currentContent.examples, (item) => item.summary));
  const [antiPatternsText, setAntiPatternsText] = useState(joinStatements(currentContent.anti_patterns, (item) => item.statement));
  const [edgeCasesText, setEdgeCasesText] = useState(joinStatements(currentContent.edge_cases, (item) => item.guidance));
  const [evidenceSourcesText, setEvidenceSourcesText] = useState(joinStatements(currentContent.evidence_sources, (item) => item.label));
  const [confidence, setConfidence] = useState(currentContent.confidence);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    setTitle(currentContent.title);
    setDefinition(currentContent.definition);
    setRulesText(joinStatements(currentContent.rules, (item) => item.statement));
    setExamplesText(joinStatements(currentContent.examples, (item) => item.summary));
    setAntiPatternsText(joinStatements(currentContent.anti_patterns, (item) => item.statement));
    setEdgeCasesText(joinStatements(currentContent.edge_cases, (item) => item.guidance));
    setEvidenceSourcesText(joinStatements(currentContent.evidence_sources, (item) => item.label));
    setConfidence(currentContent.confidence);
  }, [currentContent]);

  const formContent = useMemo<AgencyOperatingModuleV2>(() => ({
    ...currentContent,
    module_key: normalizedModuleKey,
    title: title.trim() || currentContent.title,
    definition: definition.trim(),
    rules: toRules(rulesText),
    examples: toExamples(examplesText),
    anti_patterns: toAntiPatterns(antiPatternsText),
    edge_cases: toEdgeCases(edgeCasesText),
    evidence_sources: toEvidenceSources(evidenceSourcesText),
    confidence,
    approval: {
      ...currentContent.approval,
      status: latestRecord?.status ?? "draft",
    },
  }), [
    antiPatternsText,
    confidence,
    currentContent,
    definition,
    examplesText,
    latestRecord?.status,
    moduleKey,
    rulesText,
    title,
    edgeCasesText,
    evidenceSourcesText,
  ]);

  const assessment = useMemo(() => assessAgencyAiSetupModuleContent(normalizedModuleKey, formContent), [formContent, normalizedModuleKey]);

  const applySuggestedDraft = () => {
    setTitle(suggestedDraft.title);
    setDefinition(suggestedDraft.definition);
    setRulesText(joinStatements(suggestedDraft.rules, (item) => item.statement));
    setExamplesText(joinStatements(suggestedDraft.examples, (item) => item.summary));
    setAntiPatternsText(joinStatements(suggestedDraft.anti_patterns, (item) => item.statement));
    setEdgeCasesText(joinStatements(suggestedDraft.edge_cases, (item) => item.guidance));
    setEvidenceSourcesText(joinStatements(suggestedDraft.evidence_sources, (item) => item.label));
    setConfidence(suggestedDraft.confidence);
  };

  const handleSave = async (status: "draft" | "review") => {
    try {
      await saveModule.mutateAsync({
        moduleKey: normalizedModuleKey,
        content: formContent,
        confidence,
        status,
      });
    } catch (error) {
      toast({
        title: "Module save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleReview = async (decision: "approved" | "changes_requested" | "rejected") => {
    const record =
      modulesQuery.latestByKey.get(normalizedModuleKey) ??
      (await ensureDraft.mutateAsync({ moduleKey: normalizedModuleKey }));

    if (decision === "approved" && !assessment.readyForApproval) {
      toast({
        title: "More proof is required before approval",
        description: assessment.missingRequirements.map((item) => `${item.label} ${item.actualCount}/${item.minCount}`).join(" • "),
        variant: "destructive",
      });
      return;
    }

    try {
      await reviewModule.mutateAsync({
        moduleRecord: record,
        decision,
        note: reviewNote,
      });
      setReviewNote("");
    } catch (error) {
      toast({
        title: "Review update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    validModuleKey ? (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Button variant="ghost" size="sm" asChild className="px-0">
                <Link to="/agency/ai-setup/modules">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to modules
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">{moduleMeta?.title ?? moduleKey}</h1>
                <Badge variant={latestRecord?.status === "approved" ? "default" : "secondary"}>
                  {formatStatus(latestRecord?.status)}
                </Badge>
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {moduleMeta?.description}
              </p>
              {moduleMeta?.whyItMatters ? (
                <div className="max-w-3xl rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Why this matters:</span> {moduleMeta.whyItMatters}
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Current version</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{latestRecord?.version ?? 0}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
              <div className="font-medium text-foreground">What good looks like</div>
              <div className="mt-2 text-muted-foreground">{moduleMeta?.goodExample ?? "Use specific, operator-grade guidance with real examples."}</div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm">
              <div className="font-medium text-foreground">What weak input looks like</div>
              <div className="mt-2 text-muted-foreground">{moduleMeta?.weakExample ?? "Avoid generic or unsupported statements."}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">Suggested draft from current setup evidence</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Review this draft built from foundations, guardrails, workflow, and approved documents before authoring from scratch.
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={applySuggestedDraft}>
                Apply suggested draft
              </Button>
            </div>
            <div className="text-sm font-medium text-foreground">Proof requirements for trusted approval</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {assessment.requirements.map((requirement) => {
                const actualCount = requirement.actualCount ?? 0;
                const complete = actualCount >= requirement.minCount;
                return (
                  <div key={requirement.key} className="rounded-lg border border-border/60 bg-card/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-foreground">{requirement.label}</div>
                      <Badge variant={complete ? "default" : "secondary"}>
                        {actualCount}/{requirement.minCount}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{requirement.description}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="module-title">Module title</Label>
              <Input id="module-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Confidence</Label>
                <span className="text-sm text-muted-foreground">{confidence}%</span>
              </div>
              <Slider
                value={[confidence]}
                min={0}
                max={100}
                step={5}
                onValueChange={(value) => setConfidence(value[0] ?? confidence)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="module-definition">Definition</Label>
              <Textarea
                id="module-definition"
                value={definition}
                onChange={(event) => setDefinition(event.target.value)}
                className="min-h-[100px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() =>
                  setDefinition((current) =>
                    strengthenSetupTextarea(
                      current,
                      suggestedDraft.definition,
                      "Make the definition more specific, more operator-usable, and more grounded in how this agency really works.",
                    ),
                  )
                }
              >
                Strengthen this for me
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-rules">Rules</Label>
              <Textarea
                id="module-rules"
                value={rulesText}
                onChange={(event) => setRulesText(event.target.value)}
                className="min-h-[170px]"
                placeholder="One rule per line"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() =>
                  setRulesText((current) =>
                    current.trim()
                      ? `${current}\n${joinStatements(suggestedDraft.rules, (item) => item.statement)}`
                      : joinStatements(suggestedDraft.rules, (item) => item.statement),
                  )
                }
              >
                Add stronger rule suggestions
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-examples">Examples</Label>
              <Textarea
                id="module-examples"
                value={examplesText}
                onChange={(event) => setExamplesText(event.target.value)}
                className="min-h-[170px]"
                placeholder="One example per line"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() =>
                  setExamplesText((current) =>
                    current.trim()
                      ? `${current}\n${joinStatements(suggestedDraft.examples, (item) => item.summary)}`
                      : joinStatements(suggestedDraft.examples, (item) => item.summary),
                  )
                }
              >
                Add stronger example suggestions
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-anti-patterns">Anti-patterns</Label>
              <Textarea
                id="module-anti-patterns"
                value={antiPatternsText}
                onChange={(event) => setAntiPatternsText(event.target.value)}
                className="min-h-[150px]"
                placeholder="What should fail review"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-edge-cases">Edge cases</Label>
              <Textarea
                id="module-edge-cases"
                value={edgeCasesText}
                onChange={(event) => setEdgeCasesText(event.target.value)}
                className="min-h-[150px]"
                placeholder="Exceptional handling and escalation cases"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="module-evidence-sources">Evidence sources</Label>
              <Textarea
                id="module-evidence-sources"
                value={evidenceSourcesText}
                onChange={(event) => setEvidenceSourcesText(event.target.value)}
                className="min-h-[120px]"
                placeholder="One evidence source per line. Example: Approved strategist notes from local service positioning workshop"
              />
              <p className="text-xs text-muted-foreground">
                Add the sources, references, or approved notes that prove this module reflects how the agency really works.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => handleSave("draft")} disabled={!canEditContent || saveModule.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Save draft
            </Button>
            <Button variant="outline" onClick={() => handleSave("review")} disabled={!canEditContent || saveModule.isPending}>
              <Send className="mr-2 h-4 w-4" />
              Submit for review
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/agency/ai-setup/guardrails">Continue to guardrails</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Review controls</h2>
              <p className="text-sm text-muted-foreground">
                Approval is what makes a module count toward readiness and agent unlocks.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-review-note">Review note</Label>
              <Textarea
                id="module-review-note"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                className="min-h-[100px]"
                placeholder="Capture why this was approved, what changed, or what still needs work."
              />
            </div>
            {!assessment.readyForApproval ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                Approval is blocked until the missing proof requirements above are met.
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => handleReview("approved")} disabled={!canEditContent || reviewModule.isPending || !assessment.readyForApproval}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve module
              </Button>
              <Button variant="outline" onClick={() => handleReview("changes_requested")} disabled={!canEditContent || reviewModule.isPending}>
                Request changes
              </Button>
              <Button variant="destructive" onClick={() => handleReview("rejected")} disabled={!canEditContent || reviewModule.isPending}>
                Archive module
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Recent review activity</h2>
              <p className="text-sm text-muted-foreground">
                Keep a lightweight audit trail for why module state changed.
              </p>
            </div>
            <div className="space-y-3">
              {reviewHistory.length ? (
                reviewHistory.map((review) => (
                  <div key={review.id} className="rounded-lg border border-border/60 bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-foreground">{review.decision.replace(/_/g, " ")}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleString()}
                      </div>
                    </div>
                    {review.note ? <div className="mt-2 text-sm text-muted-foreground">{review.note}</div> : null}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                  No review activity recorded yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AgencyAiSetupCheckpointCard
        title="Module review checkpoint"
        reliableNow="This module can start reflecting the agency's real rules, examples, and approval evidence instead of generic defaults."
        stillWeak="If proof requirements are still underfilled, the module may look complete while still being too vague to trust."
        nextAction="Apply the suggested draft, fill the missing proof, then review the readiness preview for the capability this module supports."
        previewPath={normalizedModuleKey === "quality_bar" || normalizedModuleKey === "approval_matrix" ? "/agency/ai-setup/readiness/preview/creator" : "/agency/ai-setup/readiness/preview/strategy"}
        previewLabel="Open the related readiness preview"
      />
    </div>
    ) : <Navigate to="/agency/ai-setup/modules" replace />
  );
}
