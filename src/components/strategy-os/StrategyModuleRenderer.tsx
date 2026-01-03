import type { StrategyModule } from "@/lib/strategy/types";
import { PositioningModule } from "@/components/strategy-os/modules/positioning/PositioningModule";
import { PillarsModule } from "@/components/strategy-os/modules/pillars/PillarsModule";
import { CampaignPlanModule } from "@/components/strategy-os/modules/campaign-plan/CampaignPlanModule";
import { WeeklyPlanModule } from "@/components/strategy-os/modules/weekly-plan/WeeklyPlanModule";
import { ChannelAdaptationsModule } from "@/components/strategy-os/modules/channel-adaptations/ChannelAdaptationsModule";
import { RulesConstraintsModule } from "@/components/strategy-os/modules/rules-constraints/RulesConstraintsModule";
import { EmptyModuleState } from "@/components/strategy-os/shared/EmptyModuleState";

interface StrategyModuleRendererProps {
  moduleId: StrategyModule;
}

export function StrategyModuleRenderer({ moduleId }: StrategyModuleRendererProps) {
  switch (moduleId) {
    case "positioning":
      return <PositioningModule />;
    case "pillars":
      return <PillarsModule />;
    case "campaign_plan":
      return <CampaignPlanModule />;
    case "weekly_plan":
      return <WeeklyPlanModule />;
    case "channel_adaptations":
      return <ChannelAdaptationsModule />;
    case "rules_constraints":
      return <RulesConstraintsModule />;
    default:
      return <EmptyModuleState module={moduleId} />;
  }
}

export default StrategyModuleRenderer;

