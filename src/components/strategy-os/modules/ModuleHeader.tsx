// Strategy OS - Module Header

import { useStrategyOS } from '../StrategyOSContext';
import { ModuleStatusBadge } from '../shared/ModuleStatusBadge';
import { LockToggle } from '../shared/LockToggle';
import { getModuleDefinition } from '@/lib/strategy/constants';
import type { StrategyModule, StrategyModuleRecord, StrategyStatus } from '@/lib/strategy/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useApproveStrategyModule } from '@/hooks/useStrategyModules';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import { toast } from 'sonner';

interface ModuleHeaderProps {
  module: StrategyModule;
  moduleData: StrategyModuleRecord | undefined;
}

export function ModuleHeader({ module, moduleData }: ModuleHeaderProps) {
  const { setActiveView, clientId, strategyId } = useStrategyOS();
  const moduleDef = getModuleDefinition(module);
  const Icon = moduleDef?.icon;
  const approveModule = useApproveStrategyModule();
  const addHistoryEvent = useAddHistoryEvent();

  const status = (moduleData?.status ?? 'empty') as StrategyStatus;
  const isLocked = moduleData?.locked ?? false;
  const blockers = moduleData?.blocker_count ?? 0;
  const canApprove = !!moduleData?.id && blockers === 0 && status !== 'approved' && status !== 'locked';

  const handleApprove = async () => {
    if (!moduleData?.id) return;
    try {
      await approveModule.mutateAsync({ moduleId: moduleData.id, clientId });
      await addHistoryEvent.mutateAsync({
        clientId,
        strategyId,
        moduleId: moduleData.id,
        module,
        eventType: 'approved',
      });
      toast.success('Module approved');
    } catch (err) {
      toast.error('Failed to approve module');
    }
  };

  return (
    <div className="border-b border-border/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {/* Back button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveView('mission-control')}
            className="h-8 w-8 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {/* Module icon */}
          {Icon && (
            <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}

          {/* Title and description */}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{moduleDef?.label}</h1>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {moduleDef?.description}
            </p>

            {/* Status badges */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <ModuleStatusBadge status={status} />
            </div>
          </div>
        </div>

        {/* Lock toggle */}
        <div className="flex items-center gap-2">
          {canApprove && (
            <Button size="sm" variant="outline" onClick={handleApprove} disabled={approveModule.isPending}>
              Approve
            </Button>
          )}
          {moduleData && status !== 'empty' && (
            <LockToggle
              moduleId={moduleData.id}
              module={module}
              isLocked={isLocked}
              moduleData={moduleData}
            />
          )}
        </div>
      </div>

      {/* Locked notice */}
      {isLocked && (
        <div className="mt-3 p-2 rounded-md bg-muted/50 text-sm text-muted-foreground">
          This module is locked. Unlock it to make changes.
        </div>
      )}
    </div>
  );
}

export default ModuleHeader;
