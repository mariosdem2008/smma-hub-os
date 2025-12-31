// Strategy OS - Main Shell Component

import { StrategyOSProvider, useStrategyOS } from './StrategyOSContext';
import { StrategyDesktopLayout } from './layout/StrategyDesktopLayout';
import { StrategyMobileLayout } from './layout/StrategyMobileLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2 } from 'lucide-react';
import type { ActiveView } from '@/lib/strategy/types';

interface StrategyOSProps {
  clientId: string;
  agencyId: string;
  activeView?: ActiveView;
  onViewChange?: (view: ActiveView) => void;
}

function StrategyOSContent() {
  const { isLoading, error } = useStrategyOS();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="flex h-[800px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading Strategy OS...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-medium text-destructive">Failed to load strategy</p>
          <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return isMobile ? <StrategyMobileLayout /> : <StrategyDesktopLayout />;
}

export function StrategyOS({ clientId, agencyId, activeView, onViewChange }: StrategyOSProps) {
  return (
    <div className="h-[800px] overflow-y-auto">
      <StrategyOSProvider
        clientId={clientId}
        agencyId={agencyId}
        externalActiveView={activeView}
        onExternalViewChange={onViewChange}
      >
        <StrategyOSContent />
      </StrategyOSProvider>
    </div>
  );
}

export default StrategyOS;