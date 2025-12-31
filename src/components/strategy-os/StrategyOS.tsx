// Strategy OS - Main Shell Component

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StrategyOSProvider, useStrategyOS } from './StrategyOSContext';
import { StrategyDesktopLayout } from './layout/StrategyDesktopLayout';
import { StrategyMobileLayout } from './layout/StrategyMobileLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2 } from 'lucide-react';
import { STRATEGY_MODULES } from '@/lib/strategy/constants';
import type { ActiveView } from '@/lib/strategy/types';

const STRATEGY_VIEW_PARAM = 'module';
const LEGACY_VIEW_PARAM = 'subTab';
const VALID_VIEWS = new Set<ActiveView>(['mission-control', ...STRATEGY_MODULES.map((module) => module.key)]);

const normalizeView = (value: string | null) => {
  if (!value) return null;
  return VALID_VIEWS.has(value as ActiveView) ? (value as ActiveView) : null;
};

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [internalView, setInternalView] = useState<ActiveView>(activeView ?? 'mission-control');

  useEffect(() => {
    if (activeView && activeView !== internalView) {
      setInternalView(activeView);
    }
  }, [activeView, internalView]);

  useEffect(() => {
    if (activeView) return;
    const moduleParam = normalizeView(searchParams.get(STRATEGY_VIEW_PARAM));
    const legacyParam = normalizeView(searchParams.get(LEGACY_VIEW_PARAM));
    const nextView = moduleParam ?? legacyParam;

    if (nextView && nextView !== internalView) {
      setInternalView(nextView);
    }

    if (legacyParam && (!moduleParam || moduleParam !== legacyParam)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set(STRATEGY_VIEW_PARAM, legacyParam);
      nextParams.delete(LEGACY_VIEW_PARAM);
      setSearchParams(nextParams);
    }
  }, [activeView, internalView, searchParams, setSearchParams]);

  const handleViewChange = (view: ActiveView) => {
    if (onViewChange) {
      onViewChange(view);
    } else {
      setInternalView(view);
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(STRATEGY_VIEW_PARAM, view);
    nextParams.delete(LEGACY_VIEW_PARAM);
    setSearchParams(nextParams);
  };

  return (
    <div className="h-[800px] overflow-y-auto">
      <StrategyOSProvider
        clientId={clientId}
        agencyId={agencyId}
        externalActiveView={activeView ?? internalView}
        onExternalViewChange={handleViewChange}
      >
        <StrategyOSContent />
      </StrategyOSProvider>
    </div>
  );
}

export default StrategyOS;
