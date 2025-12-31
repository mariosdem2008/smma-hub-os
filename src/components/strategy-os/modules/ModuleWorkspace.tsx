// Strategy OS - Module Workspace

import { useStrategyOS } from '../StrategyOSContext';
import { ModuleHeader } from './ModuleHeader';
import { EmptyModuleState } from '../shared/EmptyModuleState';
import { StrategyDocPreview } from '../shared/StrategyDocPreview';
import { PositioningModule } from './positioning/PositioningModule';
import { PillarsModule } from './pillars/PillarsModule';
import { CampaignPlanModule } from './campaign-plan/CampaignPlanModule';
import { WeeklyPlanModule } from './weekly-plan/WeeklyPlanModule';
import { ChannelAdaptationsModule } from './channel-adaptations/ChannelAdaptationsModule';
import { RulesConstraintsModule } from './rules-constraints/RulesConstraintsModule';
import type { StrategyModule } from '@/lib/strategy/types';
import { Loader2 } from 'lucide-react';

interface ModuleWorkspaceProps {
  module: StrategyModule;
}

export function ModuleWorkspace({ module }: ModuleWorkspaceProps) {
  const { getModuleData, isLoading } = useStrategyOS();

  const moduleData = getModuleData(module);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isEmpty = !moduleData || moduleData.status === 'empty';

  return (
    <div className="h-full flex flex-col">
      <ModuleHeader module={module} moduleData={moduleData} />

      <div className="px-4 pt-4">
        <StrategyDocPreview view={module} />
      </div>

      <div className="flex-1">
        {isEmpty ? (
          <EmptyModuleState module={module} />
        ) : (
          <ModuleEditor module={module} />
        )}
      </div>
    </div>
  );
}

function ModuleEditor({ module }: { module: StrategyModule }) {
  switch (module) {
    case 'positioning':
      return <PositioningModule />;
    case 'pillars':
      return <PillarsModule />;
    case 'campaign_plan':
      return <CampaignPlanModule />;
    case 'weekly_plan':
      return <WeeklyPlanModule />;
    case 'channel_adaptations':
      return <ChannelAdaptationsModule />;
    case 'rules_constraints':
      return <RulesConstraintsModule />;
    default:
      return null;
  }
}

export default ModuleWorkspace;
