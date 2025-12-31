// Strategy OS - Desktop Layout (full width - right rail moved to global ClientRightPanel)

import { MissionControl } from '../mission-control/MissionControl';
import { ModuleWorkspace } from '../modules/ModuleWorkspace';
import { useStrategyOS } from '../StrategyOSContext';

export function StrategyDesktopLayout() {
  const { activeView } = useStrategyOS();

  return (
    <div className="min-h-[600px] rounded-lg border border-border/50 bg-card/30">
      {activeView === 'mission-control' ? (
        <MissionControl />
      ) : (
        <ModuleWorkspace module={activeView} />
      )}
    </div>
  );
}

export default StrategyDesktopLayout;
