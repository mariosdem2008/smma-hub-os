// Strategy OS - Mobile Layout (right rail moved to global ClientRightPanel)

import { MissionControl } from '../mission-control/MissionControl';
import { ModuleWorkspace } from '../modules/ModuleWorkspace';
import { GenerateStrategyButton } from '../shared/GenerateStrategyButton';
import { useStrategyOS } from '../StrategyOSContext';

export function StrategyMobileLayout() {
  const { activeView } = useStrategyOS();

  return (
    <div className="flex flex-col min-h-[500px] relative">
      {/* Header with Generate Strategy */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/20 rounded-t-lg">
        <h2 className="text-sm font-semibold">Strategy OS</h2>
        <GenerateStrategyButton size="sm" />
      </div>

      {/* Main Content */}
      <div className="flex-1 pb-20">
        {activeView === 'mission-control' ? (
          <MissionControl />
        ) : (
          <ModuleWorkspace module={activeView} />
        )}
      </div>
    </div>
  );
}

export default StrategyMobileLayout;
