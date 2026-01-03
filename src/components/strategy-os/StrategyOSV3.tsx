import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { StrategyModule } from "@/lib/strategy/types";
import { StrategyOSProvider } from "./StrategyOSContext";
import { StrategyOSLayout } from "./StrategyOSLayout";
import { STRATEGY_OS_V3_MODULES } from "./strategyModules";

interface StrategyOSV3Props {
  clientId: string;
  agencyId: string;
}

export function StrategyOSV3({ clientId, agencyId }: StrategyOSV3Props) {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialModule = useMemo(() => {
    const raw = searchParams.get("strategy_module");
    if (!raw) return STRATEGY_OS_V3_MODULES[0].id;
    if (raw === "weekly") return "weekly_plan";
    const match = STRATEGY_OS_V3_MODULES.find((module) => module.id === raw);
    return match?.id ?? STRATEGY_OS_V3_MODULES[0].id;
  }, [searchParams]);

  const [activeModule, setActiveModule] = useState<StrategyModule>(initialModule);

  useEffect(() => {
    const raw = searchParams.get("strategy_module");
    if (!raw) return;
    if (raw === "weekly" && activeModule !== "weekly_plan") {
      setActiveModule("weekly_plan");
      return;
    }
    const match = STRATEGY_OS_V3_MODULES.find((module) => module.id === raw);
    if (match && match.id !== activeModule) {
      setActiveModule(match.id);
    }
  }, [activeModule, searchParams]);

  const handleModuleChange = (module: StrategyModule) => {
    setActiveModule(module);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("strategy_module", module);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="min-h-[700px]">
      <StrategyOSProvider
        clientId={clientId}
        agencyId={agencyId}
        externalActiveView={activeModule}
        onExternalViewChange={handleModuleChange}
      >
        <StrategyOSLayout activeModule={activeModule} onModuleChange={handleModuleChange} />
      </StrategyOSProvider>
    </div>
  );
}

export default StrategyOSV3;

