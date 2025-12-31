// Strategy OS - Module Selector (Left Rail / Top Selector)

import { cn } from '@/lib/utils';
import { useStrategyOS } from '../StrategyOSContext';
import { STRATEGY_MODULES, MISSION_CONTROL_NAV, getStatusDefinition } from '@/lib/strategy/constants';
import type { ActiveView, StrategyModule } from '@/lib/strategy/types';
import { Badge } from '@/components/ui/badge';
import { Lock, AlertCircle } from 'lucide-react';

interface ModuleSelectorProps {
  variant?: 'rail' | 'horizontal';
  className?: string;
}

export function ModuleSelector({ variant = 'rail', className }: ModuleSelectorProps) {
  const { activeView, setActiveView, modules, getModuleData } = useStrategyOS();

  const isRail = variant === 'rail';

  return (
    <nav
      className={cn(
        isRail
          ? 'flex flex-col gap-1 p-2'
          : 'flex gap-1 overflow-x-auto pb-2 px-1 scrollbar-hide',
        className
      )}
      role="navigation"
      aria-label="Strategy modules"
    >
      {/* Mission Control */}
      <ModuleSelectorItem
        view="mission-control"
        label={MISSION_CONTROL_NAV.label}
        shortLabel={MISSION_CONTROL_NAV.shortLabel}
        icon={MISSION_CONTROL_NAV.icon}
        isActive={activeView === 'mission-control'}
        onClick={() => setActiveView('mission-control')}
        variant={variant}
      />

      {/* Divider */}
      {isRail && <div className="my-2 h-px bg-border/50" />}

      {/* Strategy Modules */}
      {STRATEGY_MODULES.map((moduleDef) => {
        const moduleData = getModuleData(moduleDef.key);
        const status = moduleData?.status ?? 'empty';
        const statusDef = getStatusDefinition(status);
        const isLocked = moduleData?.locked ?? false;
        const hasBlockers = (moduleData?.blocker_count ?? 0) > 0;

        return (
          <ModuleSelectorItem
            key={moduleDef.key}
            view={moduleDef.key}
            label={moduleDef.label}
            shortLabel={moduleDef.shortLabel}
            icon={moduleDef.icon}
            isActive={activeView === moduleDef.key}
            onClick={() => setActiveView(moduleDef.key)}
            variant={variant}
            status={status}
            statusColor={statusDef?.color}
            isLocked={isLocked}
            hasBlockers={hasBlockers}
            completionPercent={moduleData?.completion_percent}
          />
        );
      })}
    </nav>
  );
}

interface ModuleSelectorItemProps {
  view: ActiveView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
  variant: 'rail' | 'horizontal';
  status?: string;
  statusColor?: string;
  isLocked?: boolean;
  hasBlockers?: boolean;
  completionPercent?: number;
}

function ModuleSelectorItem({
  view,
  label,
  shortLabel,
  icon: Icon,
  isActive,
  onClick,
  variant,
  status,
  statusColor,
  isLocked,
  hasBlockers,
  completionPercent,
}: ModuleSelectorItemProps) {
  const isRail = variant === 'rail';

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2 rounded-lg transition-all duration-200',
        isRail
          ? 'w-full px-3 py-2.5 text-left'
          : 'flex-shrink-0 px-3 py-2 min-w-[100px]',
        isActive
          ? 'bg-primary/10 text-primary border border-primary/20'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent',
        isLocked && 'opacity-75'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon
        className={cn(
          'h-4 w-4 flex-shrink-0',
          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
        )}
      />

      <div className={cn('flex-1 min-w-0', !isRail && 'text-center')}>
        <span className={cn('text-sm font-medium block truncate', isRail ? '' : 'text-xs')}>
          {isRail ? label : shortLabel}
        </span>

        {/* Status indicator for rail variant */}
        {isRail && status && status !== 'empty' && (
          <span className={cn('text-xs', statusColor)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        )}
      </div>

      {/* Right side indicators */}
      <div className="flex items-center gap-1">
        {hasBlockers && (
          <AlertCircle className="h-3.5 w-3.5 text-orange-400" />
        )}
        {isLocked && (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {!isLocked && completionPercent !== undefined && completionPercent > 0 && isRail && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {completionPercent}%
          </Badge>
        )}
      </div>

      {/* Horizontal variant status dot */}
      {!isRail && status && status !== 'empty' && (
        <div
          className={cn(
            'absolute top-1 right-1 h-2 w-2 rounded-full',
            status === 'draft' && 'bg-yellow-400',
            status === 'review' && 'bg-blue-400',
            status === 'approved' && 'bg-green-400',
            status === 'locked' && 'bg-red-400'
          )}
        />
      )}
    </button>
  );
}

export default ModuleSelector;
