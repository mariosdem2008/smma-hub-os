import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
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
  useSaveAgencyAiSetupGuardrailsV2,
  useTouchAgencyAiSetupStatusV2,
  type AgencyAiSetupSimulationV2Record,
} from "@/hooks/useAgencyAiSetupV2";
import { useToast } from "@/hooks/use-toast";
import {
  buildCheckpointSnapshot,
  buildGuardrailFieldCoaching,
  type AgencyAiSetupCheckpointSnapshot,
} from "@/lib/agency-ai-setup-v2/adoption";

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinCsv(value: string[] | undefined) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function getTextStrength(value: string, minimumLength: number) {
  const trimmed = value.trim();
  if (!trimmed) return { label: "Missing", tone: "text-rose-300", weak: true };
  if (trimmed.length < minimumLength) return { label: "Too thin", tone: "text-amber-300", weak: true };
  return { label: "Usable", tone: "text-emerald-300", weak: false };
}

function getListStrength(value: string, minimumItems: number) {
  const count = splitCsv(value).length;
  if (!count) return { label: "Missing", tone: "text-rose-300", weak: true };
  if (count < minimumItems) return { label: "Too thin", tone: "text-amber-300", weak: true };
  return { label: "Usable", tone: "text-emerald-300", weak: false };
}

function ReviewPrompt({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{title}</span> {body}
    </div>
  );
}

export default function AgencyAiSetupV2Guardrails() {
  const { agencyId } = useAgency();
  const { canEditContent } = useRole();
  const { status } = useAgencyAiSetupResolvedState(agencyId);
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const saveGuardrails = useSaveAgencyAiSetupGuardrailsV2(agencyId);
  const createSimulation = useCreateAgencyAiSetupSimulationV2(agencyId);
  const persistCheckpoint = usePersistAgencyAiSetupCheckpointV2(agencyId);
  const { toast } = useToast();
  const [quickSimulation, setQuickSimulation] = useState<AgencyAiSetupSimulationV2Record | null>(null);
  const [checkpoint, setCheckpoint] = useState<AgencyAiSetupCheckpointSnapshot | null>(null);

  const existing = useMemo(() => ((status?.meta_json ?? {}) as Record<string, any>).guardrails ?? {}, [status?.meta_json]);

  const [qualityReviewStandard, setQualityReviewStandard] = useState("");
  const [creativeRules, setCreativeRules] = useState("");
  const [bannedClaims, setBannedClaims] = useState("");
  const [requiredDisclaimers, setRequiredDisclaimers] = useState("");
  const [clientFacingRestrictions, setClientFacingRestrictions] = useState("");
  const [escalationTriggers, setEscalationTriggers] = useState("");

  useEffect(() => {
    setQualityReviewStandard(existing.quality_review_standard ?? "");
    setCreativeRules(joinCsv(existing.creative_rules));
    setBannedClaims(joinCsv(existing.banned_claims));
    setRequiredDisclaimers(joinCsv(existing.required_disclaimers));
    setClientFacingRestrictions(joinCsv(existing.client_facing_restrictions));
    setEscalationTriggers(joinCsv(existing.escalation_triggers));
  }, [existing]);

  useEffect(() => {
    const stored = ((status?.meta_json ?? {}) as Record<string, any>)?.checkpoints?.guardrails;
    setCheckpoint(stored ?? null);
  }, [status?.meta_json]);

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "guardrails", step: "guardrails", state: "in_progress" });
    }
  }, [agencyId, canEditContent]);

  const qualityStrength = getTextStrength(qualityReviewStandard, 120);
  const creativeStrength = getListStrength(creativeRules, 4);
  const claimsStrength = getListStrength(bannedClaims, 3);
  const disclaimersStrength = getListStrength(requiredDisclaimers, 2);
  const restrictionsStrength = getListStrength(clientFacingRestrictions, 2);
  const escalationStrength = getListStrength(escalationTriggers, 2);
  const weakCount = [
    qualityStrength,
    creativeStrength,
    claimsStrength,
    disclaimersStrength,
    restrictionsStrength,
    escalationStrength,
  ].filter((item) => item.weak).length;

  const claimsCoaching = buildGuardrailFieldCoaching({
    fieldLabel: "Banned claims",
    currentValue: bannedClaims,
    starterValue: joinCsv(existing.banned_claims),
    minItems: 3,
    focus: "Guardrails",
  });
  const escalationCoaching = buildGuardrailFieldCoaching({
    fieldLabel: "Escalation triggers",
    currentValue: escalationTriggers,
    starterValue: joinCsv(existing.escalation_triggers),
    minItems: 2,
    focus: "Guardrails",
  });

  async function handleSave() {
    try {
      const saved = await saveGuardrails.mutateAsync({
        quality_review_standard: qualityReviewStandard.trim(),
        creative_rules: splitCsv(creativeRules),
        banned_claims: splitCsv(bannedClaims),
        required_disclaimers: splitCsv(requiredDisclaimers),
        client_facing_restrictions: splitCsv(clientFacingRestrictions),
        escalation_triggers: splitCsv(escalationTriggers),
      });
      const unlock = saved.derived.unlocks.find((item) => item.agent_class === "creator");
      const simulation = unlock
        ? await createSimulation.mutateAsync({
            agentClass: "creator",
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
          })
        : null;
      if (simulation) setQuickSimulation(simulation);
      const nextCheckpoint = buildCheckpointSnapshot("creator", saved.derived, simulation);
      setCheckpoint(nextCheckpoint);
      await persistCheckpoint.mutateAsync({ stage: "guardrails", checkpoint: nextCheckpoint });
      toast({
        title: "Guardrails saved",
        description: "Your safety rules were saved and Creator AI generated a fresh coaching preview.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Set Your Guardrails</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                These rules tell Strategy AI what to never do. Review the draft rules, tighten the weak spots, and add anything specific to your agency.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            This page should read like real review rules your team would enforce. The goal is not to invent policy from zero. The goal is to confirm and tighten the draft you already imported.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="quality-review-standard">Quality review standard</Label>
                <span className={`text-xs ${qualityStrength.tone}`}>{qualityStrength.label}</span>
              </div>
              <Textarea id="quality-review-standard" value={qualityReviewStandard} onChange={(event) => setQualityReviewStandard(event.target.value)} className="min-h-[120px]" />
              <ReviewPrompt
                title="Review prompt:"
                body="Does this actually describe what your team accepts and rejects? If not, tighten it now."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="creative-rules">Creative rules</Label>
                <span className={`text-xs ${creativeStrength.tone}`}>{creativeStrength.label}</span>
              </div>
              <Input id="creative-rules" value={creativeRules} onChange={(event) => setCreativeRules(event.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="banned-claims">Banned claims</Label>
                <span className={`text-xs ${claimsStrength.tone}`}>{claimsStrength.label}</span>
              </div>
              <Input id="banned-claims" value={bannedClaims} onChange={(event) => setBannedClaims(event.target.value)} />
              {(claimsCoaching.status === "missing" || claimsCoaching.status === "thin") ? (
                <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setBannedClaims(claimsCoaching.strengthenCopy)}>
                  Strengthen this for me
                </Button>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="required-disclaimers">Required disclaimers</Label>
                <span className={`text-xs ${disclaimersStrength.tone}`}>{disclaimersStrength.label}</span>
              </div>
              <Input id="required-disclaimers" value={requiredDisclaimers} onChange={(event) => setRequiredDisclaimers(event.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="client-facing-restrictions">Client-facing restrictions</Label>
                <span className={`text-xs ${restrictionsStrength.tone}`}>{restrictionsStrength.label}</span>
              </div>
              <Input id="client-facing-restrictions" value={clientFacingRestrictions} onChange={(event) => setClientFacingRestrictions(event.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="escalation-triggers">Escalation triggers</Label>
                <span className={`text-xs ${escalationStrength.tone}`}>{escalationStrength.label}</span>
              </div>
              <Input id="escalation-triggers" value={escalationTriggers} onChange={(event) => setEscalationTriggers(event.target.value)} />
              {(escalationCoaching.status === "missing" || escalationCoaching.status === "thin") ? (
                <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setEscalationTriggers(escalationCoaching.strengthenCopy)}>
                  Strengthen this for me
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="text-sm text-muted-foreground">
              {weakCount > 0 ? `${weakCount} guardrail areas still need attention.` : "All guardrail areas are at least usable for the first trust pass."}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSave} disabled={!canEditContent || saveGuardrails.isPending}>
                {saveGuardrails.isPending ? "Saving..." : "Save & continue"}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/agency/ai-setup/activate">
                  Continue to activation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AgencyAiSetupCheckpointCard
        title="Guardrails checkpoint"
        reliableNow={checkpoint?.reliableNow ?? "The AI now has explicit quality, claim, and escalation boundaries instead of vague expectations."}
        stillWeak={checkpoint?.stillWeak ?? "Thin guardrails still make creator and client-facing behavior risky to trust."}
        nextAction={checkpoint?.nextAction ?? "Save this review, then run the final Strategy AI activation check."}
        previewPath="/agency/ai-setup/activate"
        previewLabel="Open activation check"
        milestoneLabel={checkpoint?.milestoneLabel}
        updatedNote={checkpoint?.updatedNote}
      />

      <AgencyAiSetupQuickSimulationCard
        title="Quick Creator AI coaching preview"
        agentClass="creator"
        simulation={quickSimulation}
      />
    </div>
  );
}
