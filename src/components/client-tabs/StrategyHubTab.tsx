import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ContentPlanningTab from "@/components/client-tabs/ContentPlanningTab";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StrategyHubTabProps {
  clientId: string;
  agencyId?: string;
  client?: {
    id: string;
    name: string;
    company: string | null;
  };
}

const STRATEGY_SECTIONS = [
  {
    title: "Positioning",
    description: "Define the single-sentence positioning that anchors every campaign.",
  },
  {
    title: "Pillars",
    description: "3-6 pillars that shape content themes, proof, and differentiation.",
  },
  {
    title: "Campaign plan (monthly)",
    description: "Monthly arcs, offers, and priorities that drive pipeline impact.",
  },
  {
    title: "Weekly plan",
    description: "Weekly goals, cadence, and production focus.",
  },
  {
    title: "Channel adaptations",
    description: "How strategy shifts by channel while keeping the core message.",
  },
  {
    title: "Rules / constraints",
    description: "Guardrails, claims, and compliance notes for safe execution.",
  },
];

export default function StrategyHubTab({ clientId, agencyId, client }: StrategyHubTabProps) {
  const [searchParams] = useSearchParams();
  const [strategyResult, setStrategyResult] = useState<{
    summary: string;
    sections: Array<{ title: string; content: string }>;
    citations: Array<{ doc_type: string; document_id: string; chunk_id: string; score: number }>;
    confidence: number;
  } | null>(null);
  const [unknownGate, setUnknownGate] = useState<{ questions: string[]; missingFields: string[] } | null>(null);
  const [running, setRunning] = useState(false);
  const planningRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const actionParam = searchParams.get("action");
  const showStrategyAction = actionParam === "strategy";

  const handleRunStrategy = async () => {
    if (!agencyId) {
      toast({
        title: "Strategy gate unavailable",
        description: "Missing agency context for this client.",
        variant: "destructive",
      });
      return;
    }
    setRunning(true);
    setUnknownGate(null);
    setStrategyResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-strategy-generate", {
        body: { agency_id: agencyId, client_id: clientId, mode: "draft_v1" },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.unknown) {
        setUnknownGate({
          questions: data.questions || [],
          missingFields: data.missing_fields || [],
        });
        return;
      }

      setStrategyResult({
        summary: data.strategy?.summary || "",
        sections: data.strategy?.sections || [],
        citations: data.citations || [],
        confidence: data.confidence ?? 0,
      });
    } catch (err: any) {
      toast({
        title: "Strategy gate failed",
        description: err.message || "Unable to check strategy readiness.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const handleSeedPlan = () => {
    planningRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      {unknownGate && (
        <Card className="border-border/70 bg-card/60">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold">UNKNOWN: Missing strategy context</p>
              <p className="text-xs text-muted-foreground">
                Complete onboarding to unlock strategy generation.
              </p>
            </div>
            {unknownGate.missingFields.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Missing fields: {unknownGate.missingFields.join(", ")}
              </div>
            )}
            {unknownGate.questions.length > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {unknownGate.questions.map((q) => (
                  <div key={q}>- {q}</div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate(`/onboarding/ai/client/${clientId}`)}>
                Complete onboarding
              </Button>
              <Button variant="outline" onClick={() => setUnknownGate(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {showStrategyAction && (
        <Card className="border-border/70 bg-card/60">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold">AI action queued: strategy</p>
              <p className="text-xs text-muted-foreground">
                Ready to generate a strategy draft for this client.
              </p>
            </div>
            <Button onClick={handleRunStrategy} disabled={running}>
              {running ? "Checking..." : "Run now"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="ai-surface space-y-6 p-6">
        <div className="relative overflow-hidden rounded-lg border border-border/70 bg-card/50 p-4">
          <div className="absolute inset-0 ai-glow opacity-80" aria-hidden="true" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Deep Strategy</h2>
              <p className="text-sm text-muted-foreground">
                Strategy flows into planning, then pipeline and approvals.
              </p>
              {client?.company && (
                <p className="text-xs text-muted-foreground mt-1">
                  Workspace: {client.company}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRunStrategy} disabled={running}>
                {running ? "Checking..." : "Generate Strategy"}
              </Button>
              <Button variant="outline" onClick={handleRunStrategy} disabled={running}>
                Refresh Strategy
              </Button>
              <Button variant="outline" onClick={handleSeedPlan}>
                Seed Plan
              </Button>
            </div>
          </div>
        </div>

        {strategyResult ? (
          <div className="space-y-4">
            <Card className="border-border/60 bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Strategy Summary</CardTitle>
                <CardDescription>Confidence: {strategyResult.confidence}%</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{strategyResult.summary || "Summary pending."}</p>
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              {strategyResult.sections.map((section) => (
                <Card key={section.title} className="border-border/60 bg-card/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{section.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">Citations</div>
              {strategyResult.citations.length === 0 ? (
                <div>No citations returned.</div>
              ) : (
                <div className="mt-2 space-y-1">
                  {strategyResult.citations.map((citation) => (
                    <div key={citation.chunk_id}>
                      {citation.doc_type} · {citation.document_id}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {STRATEGY_SECTIONS.map((section) => (
              <Card key={section.title} className="border-border/60 bg-card/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-dashed border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                    No strategy captured yet. Use Generate Strategy to seed this section.
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div ref={planningRef} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">Planning & Execution</h3>
            <p className="text-sm text-muted-foreground">
              Turn strategy into weekly production flow.
            </p>
          </div>
          <Badge variant="outline">Content Planning</Badge>
        </div>
        <ContentPlanningTab clientId={clientId} />
      </div>

    </div>
  );
}
