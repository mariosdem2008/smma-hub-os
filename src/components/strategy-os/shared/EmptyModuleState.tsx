// Strategy OS - Empty Module State

import { GenerateStrategyButton } from './GenerateStrategyButton';
import { getModuleDefinition } from '@/lib/strategy/constants';
import type { StrategyModule } from '@/lib/strategy/types';
import { FileQuestion } from 'lucide-react';

interface EmptyModuleStateProps {
  module: StrategyModule;
}

export function EmptyModuleState({ module }: EmptyModuleStateProps) {
  const moduleDef = getModuleDefinition(module);
  const Icon = moduleDef?.icon ?? FileQuestion;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted/50 p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>

      <h3 className="text-lg font-semibold mb-2">No strategy captured yet</h3>

      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Run Strategy Builder to draft this section with AI, or build your{" "}
        {moduleDef?.label.toLowerCase()} strategy from scratch. If AI is disabled, you will get a
        Template Draft instead.
      </p>

      <GenerateStrategyButton />
    </div>
  );
}

export default EmptyModuleState;
