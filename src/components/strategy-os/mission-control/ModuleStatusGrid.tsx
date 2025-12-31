// Strategy OS - Module Status Grid

import { useStrategyOS } from '../StrategyOSContext';
import { ModuleStatusBadge } from '../shared/ModuleStatusBadge';
import { STRATEGY_MODULES, getStatusDefinition } from '@/lib/strategy/constants';
import type { StrategyStatus } from '@/lib/strategy/types';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Lock, AlertCircle, ArrowRight } from 'lucide-react';

export function ModuleStatusGrid() {
  const { modules, setActiveView, getModuleData } = useStrategyOS();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {STRATEGY_MODULES.map((moduleDef) => {
        const moduleData = getModuleData(moduleDef.key);
        const status = (moduleData?.status ?? 'empty') as StrategyStatus;
        const statusDef = getStatusDefinition(status);
        const isLocked = moduleData?.locked ?? false;
        const hasBlockers = (moduleData?.blocker_count ?? 0) > 0;
        const Icon = moduleDef.icon;

        return (
          <Card
            key={moduleDef.key}
            onClick={() => setActiveView(moduleDef.key)}
            className={cn(
              'p-4 cursor-pointer transition-all duration-200',
              'hover:border-primary/50 hover:shadow-md',
              'group relative',
              status === 'empty' && 'border-dashed opacity-75 hover:opacity-100'
            )}
          >
            {/* Status indicators */}
            <div className="absolute top-2 right-2 flex items-center gap-1">
              {hasBlockers && (
                <div className="rounded-full bg-orange-500/10 p-1">
                  <AlertCircle className="h-3 w-3 text-orange-400" />
                </div>
              )}
              {isLocked && (
                <div className="rounded-full bg-muted p-1">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'rounded-lg p-2 flex-shrink-0',
                  status === 'empty' ? 'bg-muted/50' : statusDef?.bgColor
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    status === 'empty' ? 'text-muted-foreground' : statusDef?.color
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {moduleDef.label}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {moduleDef.description}
                </p>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <ModuleStatusBadge status={status} showIcon={false} />
                </div>
              </div>
            </div>

            {/* Hover arrow */}
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default ModuleStatusGrid;
