import { useNavigate } from "react-router-dom";
import type { BrainModule } from "@/lib/ai/brainModules";
import type { ModuleConfig } from "@/lib/brain/moduleConfig";
import type { ModuleStatus } from "@/lib/brain/statusTypes";
import { StatusBadge } from "@/components/ai-setup/StatusBadge";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  moduleKey: BrainModule;
  config: ModuleConfig;
  status: ModuleStatus;
  lastUpdatedLabel?: string;
}

export function ModuleCard({ moduleKey, config, status, lastUpdatedLabel }: ModuleCardProps) {
  const navigate = useNavigate();

  const actionLabel = status === "not-started" ? "Set up" : status === "error" ? "Fix" : "View";

  return (
    <button
      type="button"
      className={cn(
        "w-full text-left",
        "flex items-center justify-between gap-4 rounded-lg bg-card/70 px-4 py-4",
        "border border-border/70 hover:bg-card transition",
      )}
      onClick={() => navigate(`/agency/ai-setup/${moduleKey}`)}
    >
      <div className="min-w-0 flex items-start gap-4">
        <div className="pt-0.5">
          <StatusBadge status={status} size="sm" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-foreground font-medium truncate">{config.name}</h3>
            {lastUpdatedLabel && <span className="text-xs text-muted-foreground">{lastUpdatedLabel}</span>}
          </div>
          <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{config.description}</p>
        </div>
      </div>

      <span className="shrink-0 text-primary text-sm font-medium">{actionLabel} →</span>
    </button>
  );
}

