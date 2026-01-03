import type { StrategyModule } from "@/lib/strategy/types";
import type { StrategyModuleDefinition } from "./strategyModules";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface StrategyModuleSwitcherMobileProps {
  modules: StrategyModuleDefinition[];
  activeModule: StrategyModule;
  onSelect: (module: StrategyModule) => void;
}

export function StrategyModuleSwitcherMobile({
  modules,
  activeModule,
  onSelect,
}: StrategyModuleSwitcherMobileProps) {
  const active = modules.find((module) => module.id === activeModule) ?? modules[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="text-sm font-medium">{active.label}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
        {modules.map((module) => (
          <DropdownMenuItem
            key={module.id}
            onClick={() => onSelect(module.id)}
          >
            {module.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default StrategyModuleSwitcherMobile;

