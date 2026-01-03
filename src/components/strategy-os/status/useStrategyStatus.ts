import type { StrategyModule } from "@/lib/strategy/types";
import { useStrategyOS } from "../StrategyOSContext";
import { buildStrategyStatusSummary } from "./strategyStatus";

export const useStrategyStatus = () => {
  const { modules } = useStrategyOS();
  const modulesById = modules.reduce(
    (acc, moduleRecord) => {
      acc[moduleRecord.module] = moduleRecord;
      return acc;
    },
    {} as Record<StrategyModule, typeof modules[number] | undefined>,
  );

  return buildStrategyStatusSummary(modulesById as any);
};

