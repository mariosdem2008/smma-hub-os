import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AgencyAiSetupCheckpointCard } from "@/components/agency-ai-setup-v2/AgencyAiSetupCheckpointCard";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyData } from "@/hooks/useAgencyData";
import { useAgencyAiSetupResolvedState, useSaveAgencyAiSetupFoundationsV2, useTouchAgencyAiSetupStatusV2 } from "@/hooks/useAgencyAiSetupV2";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { strengthenSetupList, strengthenSetupTextarea } from "@/lib/agency-ai-setup-v2/adoption";

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const FOUNDATION_STARTER = {
  agencySummary:
    "We help service-based businesses turn social media into structured demand generation through strategy, creative direction, and consistent execution.",
  nicheFocus: "Service-based businesses that need operator-grade social media systems",
  serviceModel: "Done-for-you retainer with strategy, approvals, and monthly execution",
  marketPosition:
    "Operator-led specialist agency focused on commercially useful strategy and consistent execution rather than generic content output.",
  primaryServices: "social media strategy, content planning, creative direction, monthly management",
  primaryOffer: "Monthly social media growth system",
  secondaryOffers: "strategy intensives, reporting and optimization, launch support",
  icpSegments: "local service brands, multi-location service businesses, premium small businesses",
};

function getTextStrength(value: string, minimumLength: number) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { label: "Missing", tone: "text-amber-300", note: "Nothing written yet." };
  }
  if (trimmed.length < minimumLength) {
    return { label: "Too thin", tone: "text-amber-300", note: "This is likely too short or generic to guide the AI well." };
  }
  return { label: "Usable", tone: "text-emerald-300", note: "Specific enough to use as a working draft." };
}

function getListStrength(value: string, minimumItems: number) {
  const items = splitCsv(value);
  if (!items.length) {
    return { label: "Missing", tone: "text-amber-300", note: "Add concrete items instead of leaving this blank." };
  }
  if (items.length < minimumItems) {
    return { label: "Thin coverage", tone: "text-amber-300", note: `Add at least ${minimumItems} concrete items to make this more reliable.` };
  }
  return { label: "Usable", tone: "text-emerald-300", note: "This has enough structure for a working draft." };
}

export default function AgencyAiSetupV2Foundations() {
  const { agencyId } = useAgency();
  const { agency } = useAgencyData();
  const { status } = useAgencyAiSetupResolvedState(agencyId);
  const { canEditContent } = useRole();
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const saveFoundations = useSaveAgencyAiSetupFoundationsV2(agencyId);
  const { toast } = useToast();

  const existing = useMemo(() => {
    const meta = (status?.meta_json ?? {}) as Record<string, any>;
    return meta.foundations ?? {};
  }, [status?.meta_json]);

  const [agencySummary, setAgencySummary] = useState("");
  const [nicheFocus, setNicheFocus] = useState("");
  const [serviceModel, setServiceModel] = useState("");
  const [marketPosition, setMarketPosition] = useState("");
  const [primaryServices, setPrimaryServices] = useState("");
  const [primaryOffer, setPrimaryOffer] = useState("");
  const [secondaryOffers, setSecondaryOffers] = useState("");
  const [icpSegments, setIcpSegments] = useState("");

  useEffect(() => {
    setAgencySummary(existing.agency_summary ?? (agency?.name ? `${agency.name} helps clients grow through structured social media execution.` : ""));
    setNicheFocus(existing.niche_focus ?? agency?.niche ?? "");
    setServiceModel(existing.service_model ?? "");
    setMarketPosition(existing.market_position ?? "");
    setPrimaryServices(Array.isArray(existing.primary_services) ? existing.primary_services.join(", ") : "");
    setPrimaryOffer(existing.primary_offer ?? "");
    setSecondaryOffers(Array.isArray(existing.secondary_offers) ? existing.secondary_offers.join(", ") : "");
    setIcpSegments(Array.isArray(existing.icp_segments) ? existing.icp_segments.join(", ") : "");
  }, [existing, agency?.name, agency?.niche]);

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "foundations", step: "foundations", state: "in_progress" });
    }
  }, [agencyId, canEditContent]);

  const handleSave = async () => {
    try {
      await saveFoundations.mutateAsync({
        agency_summary: agencySummary.trim(),
        niche_focus: nicheFocus.trim(),
        service_model: serviceModel.trim(),
        market_position: marketPosition.trim(),
        primary_services: splitCsv(primaryServices),
        primary_offer: primaryOffer.trim(),
        secondary_offers: splitCsv(secondaryOffers),
        icp_segments: splitCsv(icpSegments),
      });
      toast({
        title: "Foundations saved",
        description: "Foundations are now stored in AI Setup V2 and readiness has been recomputed.",
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
    setAgencySummary((current) => current || FOUNDATION_STARTER.agencySummary);
    setNicheFocus((current) => current || FOUNDATION_STARTER.nicheFocus);
    setServiceModel((current) => current || FOUNDATION_STARTER.serviceModel);
    setMarketPosition((current) => current || FOUNDATION_STARTER.marketPosition);
    setPrimaryServices((current) => current || FOUNDATION_STARTER.primaryServices);
    setPrimaryOffer((current) => current || FOUNDATION_STARTER.primaryOffer);
    setSecondaryOffers((current) => current || FOUNDATION_STARTER.secondaryOffers);
    setIcpSegments((current) => current || FOUNDATION_STARTER.icpSegments);
  };

  const Guidance = ({
    why,
    good,
    weak,
  }: {
    why: string;
    good: string;
    weak: string;
  }) => (
    <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
      <div><span className="font-medium text-foreground">Why this matters:</span> {why}</div>
      <div className="mt-2"><span className="font-medium text-foreground">Good:</span> {good}</div>
      <div className="mt-1"><span className="font-medium text-foreground">Weak:</span> {weak}</div>
    </div>
  );

  const agencySummaryStrength = getTextStrength(agencySummary, 110);
  const marketPositionStrength = getTextStrength(marketPosition, 90);
  const primaryServicesStrength = getListStrength(primaryServices, 2);
  const icpSegmentsStrength = getListStrength(icpSegments, 2);

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Agency Foundations</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Tighten the baseline business context Strategy AI needs first. Do not aim for perfect completeness here. Aim for specific, reviewable guidance that helps the system understand who you serve, what you sell, and how you position the agency.
              </p>
            </div>
            <div className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={applyStarterDraft}>
                Use starter draft
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-sm font-medium text-foreground">How to complete this step well</div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <div>1. Review imported suggestions first.</div>
              <div>2. Be specific about who you serve and what outcomes you sell.</div>
              <div>3. Avoid vague language like “we help businesses grow” or “we are professional.”</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agency-summary">Agency summary</Label>
              <Textarea id="agency-summary" value={agencySummary} onChange={(event) => setAgencySummary(event.target.value)} className="min-h-[110px]" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() =>
                  setAgencySummary((current) =>
                    strengthenSetupTextarea(
                      current,
                      FOUNDATION_STARTER.agencySummary,
                      "Make the niche, delivery model, and commercial outcome more explicit so Strategy AI can position the agency without guessing.",
                    ),
                  )
                }
              >
                Strengthen this for me
              </Button>
              <div className={`text-xs ${agencySummaryStrength.tone}`}>
                {agencySummaryStrength.label}: {agencySummaryStrength.note}
              </div>
              <Guidance
                why="Used to draft the core operating identity of your agency for Strategy AI."
                good="We help boutique fitness studios turn short-form content into booked consultations through structured organic strategy and monthly production."
                weak="We help businesses grow on social media."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="market-position">Market position</Label>
              <Textarea id="market-position" value={marketPosition} onChange={(event) => setMarketPosition(event.target.value)} className="min-h-[110px]" placeholder="Premium specialist, niche authority, performance-led, etc." />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() =>
                  setMarketPosition((current) =>
                    strengthenSetupTextarea(
                      current,
                      FOUNDATION_STARTER.marketPosition,
                      "Describe the kind of work you are best at and the generic positioning the AI should avoid.",
                    ),
                  )
                }
              >
                Strengthen this for me
              </Button>
              <div className={`text-xs ${marketPositionStrength.tone}`}>
                {marketPositionStrength.label}: {marketPositionStrength.note}
              </div>
              <Guidance
                why="Used to decide what kind of recommendations fit your agency standard and what should be rejected as off-brand."
                good="Premium niche specialist for local service brands that need operator-grade systems, not generic content calendars."
                weak="We are a high-quality premium agency."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="niche-focus">Niche focus</Label>
              <Input id="niche-focus" value={nicheFocus} onChange={(event) => setNicheFocus(event.target.value)} placeholder="e.g. gyms, dentists, local service businesses" />
              <p className="text-xs text-muted-foreground">Be concrete about the client types you are actually built to serve first.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-model">Service model</Label>
              <Input id="service-model" value={serviceModel} onChange={(event) => setServiceModel(event.target.value)} placeholder="e.g. done-for-you retainer, hybrid consulting + production" />
              <p className="text-xs text-muted-foreground">This affects how the system should think about approvals, delivery ownership, and execution expectations.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary-services">Primary services</Label>
              <Input id="primary-services" value={primaryServices} onChange={(event) => setPrimaryServices(event.target.value)} placeholder="comma-separated" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => setPrimaryServices((current) => strengthenSetupList(current, FOUNDATION_STARTER.primaryServices.split(", ")))}
              >
                Strengthen this for me
              </Button>
              <div className={`text-xs ${primaryServicesStrength.tone}`}>
                {primaryServicesStrength.label}: {primaryServicesStrength.note}
              </div>
              <p className="text-xs text-muted-foreground">List the services the AI should prioritize when drafting strategies and recommendations.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary-offer">Primary offer</Label>
              <Input id="primary-offer" value={primaryOffer} onChange={(event) => setPrimaryOffer(event.target.value)} placeholder="Main offer the AI should optimize around" />
              <p className="text-xs text-muted-foreground">Name the main commercial offer the AI should optimize around before considering secondary upsells.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-offers">Secondary offers</Label>
              <Input id="secondary-offers" value={secondaryOffers} onChange={(event) => setSecondaryOffers(event.target.value)} placeholder="comma-separated" />
              <p className="text-xs text-muted-foreground">Only include offers that the agency really delivers and wants the system to reference later.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="icp-segments">ICP segments</Label>
              <Input id="icp-segments" value={icpSegments} onChange={(event) => setIcpSegments(event.target.value)} placeholder="comma-separated audience or client segments" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => setIcpSegments((current) => strengthenSetupList(current, FOUNDATION_STARTER.icpSegments.split(", ")))}
              >
                Strengthen this for me
              </Button>
              <div className={`text-xs ${icpSegmentsStrength.tone}`}>
                {icpSegmentsStrength.label}: {icpSegmentsStrength.note}
              </div>
              <p className="text-xs text-muted-foreground">Think in actual client categories, not broad markets. Example: “multi-location dentists” is stronger than “healthcare”.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={!canEditContent || saveFoundations.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveFoundations.isPending ? "Saving..." : "Save foundations"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/agency/ai-setup/modules">
                Continue to modules
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AgencyAiSetupCheckpointCard
        title="Strategy AI foundations checkpoint"
        reliableNow="The AI can start forming a real picture of the agency, its offer, and its best-fit clients."
        stillWeak="Thin foundations still lead to generic positioning and weak downstream module drafts."
        nextAction="Strengthen any weak fields, then run a quick strategy preview before you move into module approval."
        previewPath="/agency/ai-setup/readiness/preview/strategy"
        previewLabel="Run a quick Strategy AI preview"
      />
    </div>
  );
}
