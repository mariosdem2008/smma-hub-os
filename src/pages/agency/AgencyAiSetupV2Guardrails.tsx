import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AgencyAiSetupCheckpointCard } from "@/components/agency-ai-setup-v2/AgencyAiSetupCheckpointCard";
import { useAgency } from "@/hooks/useAgency";
import { useRole } from "@/hooks/useRole";
import {
  useAgencyAiSetupResolvedState,
  useSaveAgencyAiSetupGuardrailsV2,
  useTouchAgencyAiSetupStatusV2,
} from "@/hooks/useAgencyAiSetupV2";
import { useToast } from "@/hooks/use-toast";
import { strengthenSetupList, strengthenSetupTextarea } from "@/lib/agency-ai-setup-v2/adoption";

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

const GUARDRAIL_STARTER = {
  qualityReviewStandard:
    "Reject outputs that are vague, generic, misaligned with the agency's positioning, commercially weak, or risky to publish without revision.",
  creativeRules:
    "lead with specificity, make the CTA explicit, avoid filler phrasing, use direct commercial language",
  bannedClaims:
    "guaranteed results, guaranteed revenue growth, guaranteed rankings",
  requiredDisclaimers:
    "results vary by business, examples are illustrative and not guarantees",
  clientFacingRestrictions:
    "do not promise outcomes, do not negotiate pricing, do not approve scope changes",
  escalationTriggers:
    "regulated claims, legal or compliance questions, upset client tone, unclear approval authority",
};

function getListStrength(value: string, minimumItems: number) {
  const items = splitCsv(value);
  if (!items.length) return { label: "Missing", tone: "text-amber-300", note: "Add concrete items instead of leaving this blank." };
  if (items.length < minimumItems) {
    return { label: "Thin coverage", tone: "text-amber-300", note: `Add at least ${minimumItems} concrete items to make this enforceable.` };
  }
  return { label: "Usable", tone: "text-emerald-300", note: "This is detailed enough for a working rule set." };
}

function getTextStrength(value: string, minimumLength: number) {
  const trimmed = value.trim();
  if (!trimmed) return { label: "Missing", tone: "text-amber-300", note: "Nothing written yet." };
  if (trimmed.length < minimumLength) {
    return { label: "Too thin", tone: "text-amber-300", note: "This is probably too vague to enforce reliably." };
  }
  return { label: "Usable", tone: "text-emerald-300", note: "Specific enough to guide review and escalation." };
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AgencyAiSetupV2Guardrails() {
  const { agencyId } = useAgency();
  const { canEditContent } = useRole();
  const { status } = useAgencyAiSetupResolvedState(agencyId);
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const saveGuardrails = useSaveAgencyAiSetupGuardrailsV2(agencyId);
  const { toast } = useToast();

  const existing = useMemo(() => {
    const meta = (status?.meta_json ?? {}) as Record<string, any>;
    return meta.guardrails ?? {};
  }, [status?.meta_json]);

  const [qualityReviewStandard, setQualityReviewStandard] = useState("");
  const [creativeRules, setCreativeRules] = useState("");
  const [bannedClaims, setBannedClaims] = useState("");
  const [requiredDisclaimers, setRequiredDisclaimers] = useState("");
  const [clientFacingRestrictions, setClientFacingRestrictions] = useState("");
  const [escalationTriggers, setEscalationTriggers] = useState("");

  useEffect(() => {
    setQualityReviewStandard(existing.quality_review_standard ?? "");
    setCreativeRules(Array.isArray(existing.creative_rules) ? existing.creative_rules.join(", ") : "");
    setBannedClaims(Array.isArray(existing.banned_claims) ? existing.banned_claims.join(", ") : "");
    setRequiredDisclaimers(Array.isArray(existing.required_disclaimers) ? existing.required_disclaimers.join(", ") : "");
    setClientFacingRestrictions(Array.isArray(existing.client_facing_restrictions) ? existing.client_facing_restrictions.join(", ") : "");
    setEscalationTriggers(Array.isArray(existing.escalation_triggers) ? existing.escalation_triggers.join(", ") : "");
  }, [existing]);

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "guardrails", step: "guardrails", state: "in_progress" });
    }
  }, [agencyId, canEditContent]);

  const handleSave = async () => {
    try {
      await saveGuardrails.mutateAsync({
        quality_review_standard: qualityReviewStandard.trim(),
        creative_rules: splitCsv(creativeRules),
        banned_claims: splitCsv(bannedClaims),
        required_disclaimers: splitCsv(requiredDisclaimers),
        client_facing_restrictions: splitCsv(clientFacingRestrictions),
        escalation_triggers: splitCsv(escalationTriggers),
      });
      toast({
        title: "Guardrails saved",
        description: "Creator and client-facing readiness has been recomputed from the new guardrails.",
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
    setQualityReviewStandard((current) => current || GUARDRAIL_STARTER.qualityReviewStandard);
    setCreativeRules((current) => current || GUARDRAIL_STARTER.creativeRules);
    setBannedClaims((current) => current || GUARDRAIL_STARTER.bannedClaims);
    setRequiredDisclaimers((current) => current || GUARDRAIL_STARTER.requiredDisclaimers);
    setClientFacingRestrictions((current) => current || GUARDRAIL_STARTER.clientFacingRestrictions);
    setEscalationTriggers((current) => current || GUARDRAIL_STARTER.escalationTriggers);
  };

  const qualityStrength = getTextStrength(qualityReviewStandard, 120);
  const bannedClaimsStrength = getListStrength(bannedClaims, 3);
  const escalationStrength = getListStrength(escalationTriggers, 2);

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Guardrails</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Define the non-negotiables that creator and client-facing agents must follow. This is where quality standards become enforceable, not implied.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">How to complete this step well</div>
            <div className="mt-2">Write the real rules your team uses when it accepts, rejects, or escalates outputs. This page should read like enforceable review standards, not brand aspirations.</div>
            <div className="mt-2">Good guardrails make it obvious what the AI must never publish, what always needs disclaimers, and when a human must take over.</div>
            <div className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={applyStarterDraft}>
                Use starter guardrails
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <GuidanceCard
              title="Quality review standard"
              why="This is the acceptance bar for creator and strategy outputs."
              good="A publishable output must be specific, commercially useful, brand-safe, and clear enough for an account lead to approve without rewriting."
              weak="Content should be good, professional, and clear."
            />
            <GuidanceCard
              title="Claims and client restrictions"
              why="These rules protect client-facing and creator agents from unsafe or non-compliant outputs."
              good="Never promise revenue outcomes, never imply guaranteed rankings, and always escalate regulated or legal claims."
              weak="Avoid bad claims."
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="text-sm font-medium text-foreground">Proof required before trusting creator and client-facing agents</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                "At least 3 concrete creative rules the team already uses",
                "At least 3 banned or risky claims the AI must avoid",
                "At least 2 required disclaimer patterns when applicable",
                "At least 2 escalation triggers that force human review",
              ].map((item) => (
                <div key={item} className="rounded-lg border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="quality-review-standard">Quality review standard</Label>
              <Textarea
                id="quality-review-standard"
                value={qualityReviewStandard}
                onChange={(event) => setQualityReviewStandard(event.target.value)}
                className="min-h-[110px]"
                placeholder="What makes an output publishable or strategy-worthy in this agency?"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() =>
                  setQualityReviewStandard((current) =>
                    strengthenSetupTextarea(
                      current,
                      GUARDRAIL_STARTER.qualityReviewStandard,
                      "Specify what should fail review, what must be escalated, and what makes an output publishable without heavy rewrite.",
                    ),
                  )
                }
              >
                Strengthen this for me
              </Button>
              <div className={`text-xs ${qualityStrength.tone}`}>
                {qualityStrength.label}: {qualityStrength.note}
              </div>
              <p className="text-xs text-muted-foreground">Write the exact standard your reviewers apply, not general aspirations.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="creative-rules">Creative rules</Label>
              <Input
                id="creative-rules"
                value={creativeRules}
                onChange={(event) => setCreativeRules(event.target.value)}
                placeholder="comma-separated"
              />
              <p className="text-xs text-muted-foreground">List concrete rules like tone, hook logic, CTA style, design constraints, or forbidden structures.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="banned-claims">Banned claims</Label>
              <Input
                id="banned-claims"
                value={bannedClaims}
                onChange={(event) => setBannedClaims(event.target.value)}
                placeholder="comma-separated"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => setBannedClaims((current) => strengthenSetupList(current, GUARDRAIL_STARTER.bannedClaims.split(", ")))}
              >
                Strengthen this for me
              </Button>
              <div className={`text-xs ${bannedClaimsStrength.tone}`}>
                {bannedClaimsStrength.label}: {bannedClaimsStrength.note}
              </div>
              <p className="text-xs text-muted-foreground">Capture the exact claim types that should always fail review.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="required-disclaimers">Required disclaimers</Label>
              <Input
                id="required-disclaimers"
                value={requiredDisclaimers}
                onChange={(event) => setRequiredDisclaimers(event.target.value)}
                placeholder="comma-separated"
              />
              <p className="text-xs text-muted-foreground">Use the specific disclaimer language or disclaimer patterns your team expects.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-facing-restrictions">Client-facing restrictions</Label>
              <Input
                id="client-facing-restrictions"
                value={clientFacingRestrictions}
                onChange={(event) => setClientFacingRestrictions(event.target.value)}
                placeholder="comma-separated"
              />
              <p className="text-xs text-muted-foreground">Define what the AI can never say to a client without human approval.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="escalation-triggers">Escalation triggers</Label>
              <Input
                id="escalation-triggers"
                value={escalationTriggers}
                onChange={(event) => setEscalationTriggers(event.target.value)}
                placeholder="comma-separated"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => setEscalationTriggers((current) => strengthenSetupList(current, GUARDRAIL_STARTER.escalationTriggers.split(", ")))}
              >
                Strengthen this for me
              </Button>
              <div className={`text-xs ${escalationStrength.tone}`}>
                {escalationStrength.label}: {escalationStrength.note}
              </div>
              <p className="text-xs text-muted-foreground">Examples: regulated claims, negative sentiment, pricing disputes, legal risk, unclear approval authority.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={!canEditContent || saveGuardrails.isPending}>
              {saveGuardrails.isPending ? "Saving..." : "Save guardrails"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/agency/ai-setup/workflow">
                Continue to workflow
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AgencyAiSetupCheckpointCard
        title="Creator and client-facing guardrails checkpoint"
        reliableNow="The AI now has explicit review, claim, and escalation boundaries instead of only loose style expectations."
        stillWeak="Thin guardrails still make creator and client-facing behavior unsafe or too generic to trust."
        nextAction="Strengthen weak rules, then run a quick creator preview before using these guardrails as a trust signal."
        previewPath="/agency/ai-setup/readiness/preview/creator"
        previewLabel="Run a quick Creator AI preview"
      />
    </div>
  );
}
