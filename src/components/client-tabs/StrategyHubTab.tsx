import { StrategyOS } from "@/components/strategy-os/StrategyOS";
import type { ActiveView } from "@/lib/strategy/types";

interface StrategyHubTabProps {
  clientId: string;
  agencyId?: string;
  client?: {
    id: string;
    name: string;
    company: string | null;
  };
  activeView?: ActiveView;
  onViewChange?: (view: ActiveView) => void;
}

export default function StrategyHubTab({
  clientId,
  agencyId,
  client,
  activeView = "mission-control",
  onViewChange,
}: StrategyHubTabProps) {
  // If no agencyId, show a minimal error state
  if (!agencyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">
          Missing agency context for this client.
        </p>
      </div>
    );
  }

  return (
    <StrategyOS
      clientId={clientId}
      agencyId={agencyId}
      activeView={activeView}
      onViewChange={onViewChange}
    />
  );
}
