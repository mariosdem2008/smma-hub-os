import type { StrategyModule } from "@/lib/strategy/types";
import type { StrategyModuleDefinition } from "./strategyModules";
import type { StrategyStatusSummary, ModuleStatus } from "./status/strategyStatus";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Circle, CircleDot } from "lucide-react";

interface StrategyModuleNavProps {
  modules: StrategyModuleDefinition[];
  activeModule: StrategyModule;
  onSelect: (module: StrategyModule) => void;
  statusSummary: StrategyStatusSummary;
}

export function StrategyModuleNav({
  modules,
  activeModule,
  onSelect,
  statusSummary,
}: StrategyModuleNavProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Modules
      </div>
      <div className="flex flex-col gap-1">
        {modules.map((module) => {
          const isActive = activeModule === module.id;
          const status = statusSummary.perModule[module.id]?.status ?? "not_started";
          const isRecommended = statusSummary.recommendedNextModuleId === module.id;
          const isBlocked = status === "blocked";
          const StatusIcon = getStatusIcon(status);
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => onSelect(module.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition",
                isActive
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border/60 bg-background hover:border-border",
                isRecommended && "ring-2 ring-primary/20",
                isBlocked && "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="flex items-start gap-2">
                <StatusIcon className={cn("mt-0.5 h-4 w-4", statusColor(status))} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {module.label}
                    {isRecommended && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        Next
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{module.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const getStatusIcon = (status: ModuleStatus) => {
  switch (status) {
    case "complete":
      return CheckCircle2;
    case "blocked":
      return AlertTriangle;
    case "in_progress":
      return CircleDot;
    default:
      return Circle;
  }
};

const statusColor = (status: ModuleStatus) => {
  switch (status) {
    case "complete":
      return "text-emerald-500";
    case "blocked":
      return "text-destructive";
    case "in_progress":
      return "text-amber-500";
    default:
      return "text-muted-foreground";
  }
};

export default StrategyModuleNav;

