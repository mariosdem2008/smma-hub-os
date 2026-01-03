import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";
import type { StrategyModule } from "@/lib/strategy/types";
import { STRATEGY_OS_V3_MODULES } from "./strategyModules";
import type { StrategyStatusSummary } from "./status/strategyStatus";

interface StrategyNextStepBarProps {
  summary: StrategyStatusSummary;
  onSelectModule: (module: StrategyModule) => void;
}

const getModuleLabel = (moduleId: StrategyModule) =>
  STRATEGY_OS_V3_MODULES.find((module) => module.id === moduleId)?.label ?? "Module";

export function StrategyNextStepBar({ summary, onSelectModule }: StrategyNextStepBarProps) {
  const completionPercent = Math.round((summary.completedCount / summary.totalCount) * 100);
  const blockerCount = summary.blockers.length;
  const recommendedLabel = getModuleLabel(summary.recommendedNextModuleId);
  const isComplete = summary.completedCount === summary.totalCount;
  const topBlocker = summary.blockers
    .slice()
    .sort((a, b) => b.severity - a.severity)[0];

  const ctaLabel = isComplete
    ? "Generate weekly plan (soon)"
    : blockerCount > 0
      ? `Fix ${recommendedLabel}`
      : `Continue: ${recommendedLabel}`;

  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {summary.completedCount}/{summary.totalCount} complete
          </div>
          <Progress value={completionPercent} className="h-2 w-44" />
        </div>
        <div className={blockerCount > 0 ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}>
          {blockerCount} blockers
        </div>
        <Button
          onClick={() => onSelectModule(summary.recommendedNextModuleId)}
          variant={isComplete ? "outline" : "default"}
          disabled={isComplete}
        >
          {ctaLabel}
        </Button>
      </div>
      {topBlocker && (
        <div className="mt-3 flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <span>{topBlocker.title}</span>
        </div>
      )}
    </div>
  );
}

export default StrategyNextStepBar;

