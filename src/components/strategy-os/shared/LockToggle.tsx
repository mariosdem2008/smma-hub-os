// Strategy OS - Lock Toggle

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToggleModuleLock } from '@/hooks/useStrategyModules';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import { useStrategyOS } from '../StrategyOSContext';
import type { StrategyModule, StrategyModuleRecord } from '@/lib/strategy/types';
import { Lock, Unlock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LockToggleProps {
  moduleId: string;
  module: StrategyModule;
  isLocked: boolean;
  moduleData: StrategyModuleRecord;
  className?: string;
}

export function LockToggle({ moduleId, module, isLocked, moduleData, className }: LockToggleProps) {
  const { clientId, strategyId, modules } = useStrategyOS();
  const toggleLock = useToggleModuleLock();
  const addHistoryEvent = useAddHistoryEvent();

  const handleToggle = async () => {
    try {
      await toggleLock.mutateAsync({
        moduleId,
        clientId,
        lock: !isLocked,
        module,
        content: moduleData.content_json,
        modules: Object.fromEntries(modules.map((mod) => [mod.module, mod.content_json])),
        currentStatus: moduleData.status,
      });

      await addHistoryEvent.mutateAsync({
        clientId,
        strategyId,
        moduleId,
        module,
        eventType: isLocked ? 'unlocked' : 'locked',
      });

      toast.success(isLocked ? 'Module unlocked' : 'Module locked', {
        description: isLocked
          ? 'You can now edit this module.'
          : 'This module is now read-only.',
      });
    } catch (err) {
      toast.error('Failed to toggle lock', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  if (isLocked) {
    // Unlock requires confirmation
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('gap-2', className)}
            disabled={toggleLock.isPending}
          >
            {toggleLock.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Locked
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock this module?</AlertDialogTitle>
            <AlertDialogDescription>
              Unlocking will allow editing of this module. Any approved content will need to be
              re-approved after changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle}>Unlock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Lock button
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      className={cn('gap-2', className)}
      disabled={toggleLock.isPending}
    >
      {toggleLock.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Unlock className="h-4 w-4" />
      )}
      Lock Module
    </Button>
  );
}

export default LockToggle;
