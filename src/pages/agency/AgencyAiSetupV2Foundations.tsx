import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AgencyAiSetupCheckpointCard } from "@/components/agency-ai-setup-v2/AgencyAiSetupCheckpointCard";
import { AgencyAiSetupQuickSimulationCard } from "@/components/agency-ai-setup-v2/AgencyAiSetupQuickSimulationCard";
import { useAgency } from "@/hooks/useAgency";
import {
  useAgencyAiSetupResolvedState,
  useCreateAgencyAiSetupSimulationV2,
  usePersistAgencyAiSetupCheckpointV2,
  useSaveAgencyAiSetupFoundationsV2,
  useTouchAgencyAiSetupStatusV2,
  type AgencyAiSetupSimulationV2Record,
} from "@/hooks/useAgencyAiSetupV2";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import {
  buildCheckpointSnapshot,
  buildFoundationFieldCoaching,
  getAgencyAiSetupStrategyTemplate,
  strengthenSetupList,
  strengthenSetupTextarea,
  type AgencyAiSetupCheckpointSnapshot,
} from "@/lib/agency-ai-setup-v2/adoption";

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTextStrength(value: string, minimumLength: number) {
  const trimmed = value.trim();
  if (!trimmed) return { label: "Missing", tone: "text-rose-300", weak: true };
  if (trimmed.length < minimumLength) return { label: "Too thin", tone: "text-amber-300", weak: true };
  return { label: "Usable", tone: "text-emerald-300", weak: false };
}

function getListStrength(value: string, minimumItems: number) {
  const items = splitCsv(value);
  if (!items.length) return { label: "Missing", tone: "text-rose-300", weak: true };
  if (items.length < minimumItems) return { label: "Too thin", tone: "text-amber-300", weak: true };
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

export default function AgencyAiSetupV2Foundations() {
  const { agencyId } = useAgency();
  const { status } = useAgencyAiSetupResolvedState(agencyId);
  const { canEditContent } = useRole();
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const saveFoundations = useSaveAgencyAiSetupFoundationsV2(agencyId);
  const createSimulation = useCreateAgencyAiSetupSimulationV2(agencyId);
  const persistCheckpoint = usePersistAgencyAiSetupCheckpointV2(agencyId);
  const { toast } = useToast();
  const [quickSimulation, setQuickSimulation] = useState<AgencyAiSetupSimulationV2Record | null>(null);
  const [checkpoint, setCheckpoint] = useState<AgencyAiSetupCheckpointSnapshot | null>(null);

  const existing = useMemo(() => ((status?.meta_json ?? {}) as Record<string, any>).foundations ?? {}, [status?.meta_json]);
  const selectedTemplate = getAgencyAiSetupStrategyTemplate(
    ((status?.meta_json ?? {}) as Record<string, any>)?.guided_strategy_template_key,
  );
  const foundationStarter = selectedTemplate.foundations;

  const [agencySummary, setAgencySummary] = useState("");
  const [nicheFocus, setNicheFocus] = useState("");
  const [serviceModel, setServiceModel] = useState("");
  const [marketPosition, setMarketPosition] = useState("");
  const [primaryServices, setPrimaryServices] = useState("");
  const [primaryOffer, setPrimaryOffer] = useState("");
  const [secondaryOffers, setSecondaryOffers] = useState("");
  const [icpSegments, setIcpSegments] = useState("");

  useEffect(() => {
    setAgencySummary(existing.agency_summary ?? "");
    setNicheFocus(existing.niche_focus ?? "");
    setServiceModel(existing.service_model ?? "");
    setMarketPosition(existing.market_position ?? "");
    setPrimaryServices(Array.isArray(existing.primary_services) ? existing.primary_services.join(", ") : "");
    setPrimaryOffer(existing.primary_offer ?? "");
    setSecondaryOffers(Array.isArray(existing.secondary_offers) ? existing.secondary_offers.join(", ") : "");
    setIcpSegments(Array.isArray(existing.icp_segments) ? existing.icp_segments.join(", ") : "");
  }, [existing]);

  useEffect(() => {
    const stored = ((status?.meta_json ?? {}) as Record<string, any>)?.checkpoints?.foundations;
    setCheckpoint(stored ?? null);
  }, [status?.meta_json]);

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "foundations", step: "foundations", state: "in_progress" });
    }
  }, [agencyId, canEditContent]);

  const strengths = {
    agencySummary: getTextStrength(agencySummary, 110),
    nicheFocus: getTextStrength(nicheFocus, 70),
    serviceModel: getTextStrength(serviceModel, 80),
    marketPosition: getTextStrength(marketPosition, 100),
    primaryServices: getListStrength(primaryServices, 3),
    primaryOffer: getTextStrength(primaryOffer, 60),
    secondaryOffers: getListStrength(secondaryOffers, 2),
    icpSegments: getListStrength(icpSegments, 2),
  };

  const weakFieldCount = Object.values(strengths).filter((item) => item.weak).length;
  const agencySummaryCoaching = buildFoundationFieldCoaching({
    fieldLabel: "Agency summary",
    currentValue: agencySummary,
    starterValue: foundationStarter.agencySummary,
    minLength: 110,
    focus: selectedTemplate.title,
  });
  const marketPositionCoaching = buildFoundationFieldCoaching({
    fieldLabel: "Market position",
    currentValue: marketPosition,
    starterValue: foundationStarter.marketPosition,
    minLength: 100,
    focus: selectedTemplate.title,
  });

  async function handleSave() {
    try {
      const saved = await saveFoundations.mutateAsync({
        agency_summary: agencySummary.trim(),
        niche_focus: nicheFocus.trim(),
        service_model: serviceModel.trim(),
        market_position: marketPosition.trim(),
        primary_services: splitCsv(primaryServices),
        primary_offer: primaryOffer.trim(),
        secondary_offers: splitCsv(secondaryOffers),
        icp_segments: splitCsv(icpSegments),
      });
      const unlock = saved.derived.unlocks.find((item) => item.agent_class === "strategy");
      const simulation = unlock
        ? await createSimulation.mutateAsync({
            agentClass: "strategy",
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
      const nextCheckpoint = buildCheckpointSnapshot("strategy", saved.derived, simulation);
      setCheckpoint(nextCheckpoint);
      await persistCheckpoint.mutateAsync({ stage: "foundations", checkpoint: nextCheckpoint });
      toast({
        title: "Foundations saved",
        description: "Your foundations were saved and Strategy AI generated a fresh coaching preview.",
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
            <Building2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Review Your Foundations</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                We drafted these from your template and imports. Review each section and tighten anything that does not sound like your agency.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Current template:</span> {selectedTemplate.title}. Review for accuracy first. Only write from zero if the draft is clearly wrong.
          </div>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Who you serve</h2>
              <p className="text-sm text-muted-foreground">Make sure Strategy AI understands the exact market and client types you want it to prioritize.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="niche-focus">Niche focus</Label>
                  <span className={`text-xs ${strengths.nicheFocus.tone}`}>{strengths.nicheFocus.label}</span>
                </div>
                <Textarea id="niche-focus" value={nicheFocus} onChange={(event) => setNicheFocus(event.target.value)} className="min-h-[110px]" />
                <ReviewPrompt
                  title="Review prompt:"
                  body="Is this your actual niche? If you serve a different market, update it. Strategy AI uses this to filter recommendations."
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="icp-segments">ICP segments</Label>
                  <span className={`text-xs ${strengths.icpSegments.tone}`}>{strengths.icpSegments.label}</span>
                </div>
                <Textarea id="icp-segments" value={icpSegments} onChange={(event) => setIcpSegments(event.target.value)} className="min-h-[110px]" />
                <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setIcpSegments((current) => strengthenSetupList(current, foundationStarter.icpSegments.split(", ")))}>
                  Strengthen weak fields
                </Button>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">What you sell</h2>
              <p className="text-sm text-muted-foreground">Confirm the delivery model and offers Strategy AI should optimize around.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="service-model">Service model</Label>
                  <span className={`text-xs ${strengths.serviceModel.tone}`}>{strengths.serviceModel.label}</span>
                </div>
                <Textarea id="service-model" value={serviceModel} onChange={(event) => setServiceModel(event.target.value)} className="min-h-[110px]" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="primary-services">Primary services</Label>
                  <span className={`text-xs ${strengths.primaryServices.tone}`}>{strengths.primaryServices.label}</span>
                </div>
                <Input id="primary-services" value={primaryServices} onChange={(event) => setPrimaryServices(event.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="primary-offer">Primary offer</Label>
                  <span className={`text-xs ${strengths.primaryOffer.tone}`}>{strengths.primaryOffer.label}</span>
                </div>
                <Textarea id="primary-offer" value={primaryOffer} onChange={(event) => setPrimaryOffer(event.target.value)} className="min-h-[96px]" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="secondary-offers">Secondary offers</Label>
                  <span className={`text-xs ${strengths.secondaryOffers.tone}`}>{strengths.secondaryOffers.label}</span>
                </div>
                <Textarea id="secondary-offers" value={secondaryOffers} onChange={(event) => setSecondaryOffers(event.target.value)} className="min-h-[96px]" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">How you position</h2>
              <p className="text-sm text-muted-foreground">This is how Strategy AI will differentiate your recommendations from generic advice.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="market-position">Market position</Label>
                  <span className={`text-xs ${strengths.marketPosition.tone}`}>{strengths.marketPosition.label}</span>
                </div>
                <Textarea id="market-position" value={marketPosition} onChange={(event) => setMarketPosition(event.target.value)} className="min-h-[130px]" />
                <ReviewPrompt
                  title="Review prompt:"
                  body="Make sure this captures what actually makes you different. If this is generic, Strategy AI will be generic."
                />
                {(marketPositionCoaching.status === "missing" || marketPositionCoaching.status === "thin") ? (
                  <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setMarketPosition(marketPositionCoaching.strengthenCopy)}>
                    Strengthen this for me
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="agency-summary">Agency summary</Label>
                  <span className={`text-xs ${strengths.agencySummary.tone}`}>{strengths.agencySummary.label}</span>
                </div>
                <Textarea id="agency-summary" value={agencySummary} onChange={(event) => setAgencySummary(event.target.value)} className="min-h-[130px]" />
                <ReviewPrompt
                  title="Review prompt:"
                  body="Does this sound like your agency? Edit anything that does not match how you would describe your work to a new client."
                />
                {(agencySummaryCoaching.status === "missing" || agencySummaryCoaching.status === "thin") ? (
                  <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setAgencySummary(agencySummaryCoaching.strengthenCopy)}>
                    Strengthen this for me
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="text-sm text-muted-foreground">
              {weakFieldCount > 0 ? `${weakFieldCount} fields still need attention before this step feels solid.` : "Everything is at least usable. You can move to key modules."}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSave} disabled={!canEditContent || saveFoundations.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {saveFoundations.isPending ? "Saving..." : "Looks good"}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/agency/ai-setup/modules">
                  Continue to key modules
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AgencyAiSetupCheckpointCard
        title="Foundations checkpoint"
        reliableNow={checkpoint?.reliableNow ?? "Strategy AI can start understanding who you serve, what you sell, and how you position the agency."}
        stillWeak={checkpoint?.stillWeak ?? "Thin foundations still lead to generic positioning and weak downstream module drafts."}
        nextAction={checkpoint?.nextAction ?? "Save this review, then approve the key Strategy AI modules."}
        previewPath="/agency/ai-setup/modules"
        previewLabel="Open key modules"
        milestoneLabel={checkpoint?.milestoneLabel}
        updatedNote={checkpoint?.updatedNote}
      />

      <AgencyAiSetupQuickSimulationCard
        title="Quick Strategy AI coaching preview"
        agentClass="strategy"
        simulation={quickSimulation}
      />
    </div>
  );
}
