// Strategy OS - Context Provider

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ActiveView, StrategyOSState, AICopilotMode, StrategyModule, StrategyRecord } from '@/lib/strategy/types';
import { useStrategyModules, useInitializeModules } from '@/hooks/useStrategyModules';
import { useStrategies, useCreateStrategy } from '@/hooks/useStrategies';

interface StrategyOSContextValue extends StrategyOSState {
  // Client/Agency info
  clientId: string;
  agencyId: string;
  strategyId: string;
  activeStrategy: StrategyRecord | null;
  strategies: StrategyRecord[];

  // State setters
  setActiveView: (view: ActiveView) => void;
  setRightRailTab: (tab: 'decisions' | 'history' | 'tasks') => void;
  setMobileSheetOpen: (open: boolean) => void;
  setHasUnsavedChanges: (has: boolean) => void;
  setAICopilotMode: (mode: AICopilotMode) => void;
  setStrategyId: (id: string) => void;

  // Data
  modules: ReturnType<typeof useStrategyModules>['data'];
  isLoading: boolean;
  error: Error | null;

  // Helpers
  getModuleData: (module: StrategyModule) => ReturnType<typeof useStrategyModules>['data'][number] | undefined;
  isModuleLocked: (module: StrategyModule) => boolean;
}

const StrategyOSContext = createContext<StrategyOSContextValue | null>(null);

interface StrategyOSProviderProps {
  clientId: string;
  agencyId: string;
  children: React.ReactNode;
  externalActiveView?: ActiveView;
  onExternalViewChange?: (view: ActiveView) => void;
}

export function StrategyOSProvider({
  clientId,
  agencyId,
  children,
  externalActiveView,
  onExternalViewChange,
}: StrategyOSProviderProps) {
  // Use external view if provided, otherwise use internal state
  const [internalActiveView, setInternalActiveView] = useState<ActiveView>('mission-control');

  // Determine which view to use - external takes precedence
  const activeView = externalActiveView ?? internalActiveView;

  // Handler that either calls external or internal setter
  const setActiveView = (view: ActiveView) => {
    if (onExternalViewChange) {
      onExternalViewChange(view);
    } else {
      setInternalActiveView(view);
    }
  };
  const [rightRailTab, setRightRailTab] = useState<'decisions' | 'history' | 'tasks'>('decisions');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [aiCopilotMode, setAICopilotMode] = useState<AICopilotMode>('assist');
  const [strategyId, setStrategyId] = useState<string>('');

  // Data
  const { data: strategies = [], isLoading: isStrategiesLoading } = useStrategies(clientId);
  const createStrategy = useCreateStrategy();
  const activeStrategy = strategies.find((strategy) => strategy.id === strategyId) ?? strategies[0] ?? null;
  const activeStrategyId = activeStrategy?.id ?? '';
  const { data: modules = [], isLoading: isModulesLoading, error } = useStrategyModules(
    clientId,
    activeStrategyId
  );
  const initializeModules = useInitializeModules();

  // Ensure a strategy exists
  useEffect(() => {
    if (!isStrategiesLoading && strategies.length === 0 && clientId && agencyId) {
      createStrategy.mutate({ clientId, agencyId, versionInt: 1 });
    }
  }, [isStrategiesLoading, strategies.length, clientId, agencyId]);

  // Select latest strategy by default
  useEffect(() => {
    if (!strategyId && activeStrategyId) {
      setStrategyId(activeStrategyId);
    }
  }, [strategyId, activeStrategyId]);

  // Initialize modules if none exist
  useEffect(() => {
    if (!isModulesLoading && modules.length === 0 && clientId && agencyId && activeStrategyId) {
      initializeModules.mutate({ clientId, agencyId, strategyId: activeStrategyId });
    }
  }, [isModulesLoading, modules.length, clientId, agencyId, activeStrategyId]);

  // Helper to get module data
  const getModuleData = useCallback(
    (module: StrategyModule) => {
      return modules.find((m) => m.module === module);
    },
    [modules]
  );

  // Helper to check if module is locked
  const isModuleLocked = useCallback(
    (module: StrategyModule) => {
      const moduleData = getModuleData(module);
      return moduleData?.locked ?? false;
    },
    [getModuleData]
  );

  const value: StrategyOSContextValue = {
    // Client/Agency
    clientId,
    agencyId,
    strategyId: activeStrategyId,
    activeStrategy,
    strategies,

    // State
    activeView,
    rightRailTab,
    mobileSheetOpen,
    hasUnsavedChanges,
    aiCopilotMode,

    // Setters
    setActiveView,
    setRightRailTab,
    setMobileSheetOpen,
    setHasUnsavedChanges,
    setAICopilotMode,
    setStrategyId,

    // Data
    modules,
    isLoading: isStrategiesLoading || isModulesLoading,
    error: error as Error | null,

    // Helpers
    getModuleData,
    isModuleLocked,
  };

  return <StrategyOSContext.Provider value={value}>{children}</StrategyOSContext.Provider>;
}

export function useStrategyOS() {
  const context = useContext(StrategyOSContext);
  if (!context) {
    throw new Error('useStrategyOS must be used within a StrategyOSProvider');
  }
  return context;
}

// Convenience hook for current module
export function useCurrentModule() {
  const { activeView, getModuleData } = useStrategyOS();

  if (activeView === 'mission-control') {
    return null;
  }

  return getModuleData(activeView);
}
