import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import type { StrategyModule } from "@/lib/strategy/types";
import { STRATEGY_OS_V3_MODULES, getStrategyOSV3ModuleDefinition } from "./strategyModules";
import { StrategyModuleNav } from "./StrategyModuleNav";
import { StrategyModuleSwitcherMobile } from "./StrategyModuleSwitcherMobile";
import { StrategyModuleRenderer } from "./StrategyModuleRenderer";
import { StrategyRightPanel } from "./StrategyRightPanel";
import { StrategyNextStepBar } from "./StrategyNextStepBar";
import { useStrategyStatus } from "./status/useStrategyStatus";
import { useStrategyOS } from "./StrategyOSContext";
import { Badge } from "@/components/ui/badge";

interface StrategyOSLayoutProps {
  activeModule: StrategyModule;
  onModuleChange: (module: StrategyModule) => void;
}

export function StrategyOSLayout({ activeModule, onModuleChange }: StrategyOSLayoutProps) {
  const isMobile = useIsMobile();
  const [panelOpen, setPanelOpen] = useState(false);
  const statusSummary = useStrategyStatus();
  const { getModuleData } = useStrategyOS();
  const activeDefinition = useMemo(
    () => getStrategyOSV3ModuleDefinition(activeModule),
    [activeModule],
  );
  const moduleData = getModuleData(activeModule);
  const moduleSource = (() => {
    if (moduleData?.ai_generated) return "AI";
    const metaSource = (moduleData?.content_json as { meta?: { source?: string } })?.meta?.source ?? "";
    const normalized = metaSource.toLowerCase();
    if (normalized.includes("onboarding")) return "Onboarding";
    if (normalized.includes("brain")) return "Brain";
    return "Human";
  })();

  const gridColumns = useMemo(() => {
    if (!isMobile && panelOpen) return "lg:grid-cols-[240px_minmax(0,1fr)_320px]";
    if (!isMobile) return "lg:grid-cols-[240px_minmax(0,1fr)]";
    return "lg:grid-cols-[240px_minmax(0,1fr)]";
  }, [isMobile, panelOpen]);

  return (
    <div className="rounded-lg border border-border/80 bg-card/80 p-4 shadow-card md:p-5">
      <div className={`grid gap-4 ${gridColumns}`}>
        <aside className="hidden rounded-lg border border-border/70 bg-muted/25 p-3 lg:block">
          <StrategyModuleNav
            modules={STRATEGY_OS_V3_MODULES}
            activeModule={activeModule}
            onSelect={onModuleChange}
            statusSummary={statusSummary}
          />
        </aside>

        <section className="flex flex-col gap-4">
          {isMobile && (
            <StrategyModuleSwitcherMobile
              modules={STRATEGY_OS_V3_MODULES}
              activeModule={activeModule}
              onSelect={onModuleChange}
            />
          )}

          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-card p-4 shadow-xs">
            <div>
              <p className="page-eyebrow">Strategy Module</p>
              <div className="font-display text-2xl font-bold text-foreground" data-testid="strategy-module-title">
                {activeDefinition.label}
              </div>
              <div className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {activeDefinition.description}
              </div>
              <div className="mt-2">
                <Badge variant="outline" className="text-xs">
                  Source: {moduleSource}
                </Badge>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setPanelOpen((prev) => !prev)}>
              Strategy tools
            </Button>
          </div>

          <StrategyNextStepBar summary={statusSummary} onSelectModule={onModuleChange} />

          <div className="min-h-[500px] overflow-hidden rounded-lg border border-border/80 bg-card/70 shadow-card">
            <StrategyModuleRenderer moduleId={activeModule} />
          </div>
        </section>

        {!isMobile && panelOpen && (
          <StrategyRightPanel isMobile={false} open={panelOpen} onOpenChange={setPanelOpen} />
        )}
      </div>

      {isMobile && (
        <StrategyRightPanel isMobile open={panelOpen} onOpenChange={setPanelOpen} />
      )}
    </div>
  );
}

export default StrategyOSLayout;
