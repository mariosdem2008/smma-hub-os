import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AgencyAiSetupSimulationV2Record } from "@/hooks/useAgencyAiSetupV2";

export function AgencyAiSetupQuickSimulationCard({
  title,
  agentClass,
  simulation,
}: {
  title: string;
  agentClass: "strategy" | "creator" | "operator";
  simulation: AgencyAiSetupSimulationV2Record | null;
}) {
  if (!simulation) return null;

  const summary =
    (simulation.output_snapshot_json?.summary as string | undefined) ?? "Quick coaching preview completed.";
  const recommendedNextAction =
    (simulation.output_snapshot_json?.recommended_next_action as string | undefined) ?? null;
  const findings = Array.isArray(simulation.output_snapshot_json?.findings)
    ? (simulation.output_snapshot_json.findings as string[])
    : [];
  const dimensionScores =
    simulation.output_snapshot_json?.dimension_scores &&
    typeof simulation.output_snapshot_json.dimension_scores === "object"
      ? (simulation.output_snapshot_json.dimension_scores as Record<string, number>)
      : {};

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-medium text-foreground">{title}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{simulation.result}</div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{summary}</p>

        {Object.keys(dimensionScores).length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(dimensionScores).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{key.replace(/_/g, " ")}</div>
                <div className="mt-1 text-sm font-medium text-foreground">{value}/100</div>
              </div>
            ))}
          </div>
        ) : null}

        {findings.length ? (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What needs attention</div>
            <div className="space-y-1 text-sm text-muted-foreground">
              {findings.slice(0, 3).map((finding) => (
                <div key={finding}>- {finding}</div>
              ))}
            </div>
          </div>
        ) : null}

        {recommendedNextAction ? (
          <div className="rounded-lg border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Recommended next action:</span> {recommendedNextAction}
          </div>
        ) : null}

        <Button variant="outline" asChild>
          <Link to={`/agency/ai-setup/readiness/preview/${agentClass}`}>Open full readiness preview</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
