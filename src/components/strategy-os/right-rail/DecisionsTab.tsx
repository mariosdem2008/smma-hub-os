// Strategy OS - Decisions Tab

import { useStrategyOS } from '../StrategyOSContext';
import { LockToggle } from '../shared/LockToggle';
import { ModuleStatusBadge } from '../shared/ModuleStatusBadge';
import { STRATEGY_MODULES } from '@/lib/strategy/constants';
import type { StrategyStatus } from '@/lib/strategy/types';
import { STRATEGY_DECISIONS } from '@/lib/strategy/decisions';
import { useStrategyDecisions, useUpsertStrategyDecision } from '@/hooks/useStrategyDecisions';
import { evaluateStrategyModule } from '@/lib/strategy/rulesEngine';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { strategyModulesKeys } from '@/hooks/useStrategyModules';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Lock, CheckCircle, Circle } from 'lucide-react';
import { toast } from 'sonner';

export function DecisionsTab() {
  const { modules, getModuleData, clientId, strategyId } = useStrategyOS();
  const { data: decisions = [] } = useStrategyDecisions(clientId, strategyId);
  const upsertDecision = useUpsertStrategyDecision();
  const queryClient = useQueryClient();

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        <div>
          <h3 className="font-medium text-sm">Module Decisions</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Lock modules to prevent accidental changes. Locked content is treated as approved.
          </p>
        </div>

        {STRATEGY_MODULES.map((moduleDef) => {
          const moduleData = getModuleData(moduleDef.key);
          const status = (moduleData?.status ?? 'empty') as StrategyStatus;
          const isLocked = moduleData?.locked ?? false;
          const decisionsForModule = STRATEGY_DECISIONS[moduleDef.key] ?? [];
          const Icon = moduleDef.icon;

          return (
            <Card key={moduleDef.key} className="p-3">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium text-sm">{moduleDef.label}</h4>
                    <ModuleStatusBadge status={status} className="mt-1" />
                  </div>
                </div>
                {moduleData?.id && (
                  <LockToggle
                    moduleId={moduleData.id}
                    module={moduleDef.key}
                    isLocked={isLocked}
                    moduleData={moduleData}
                  />
                )}
              </div>

              {/* Decision items */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                {decisionsForModule.map((decision) => {
                  const stored = decisions.find(
                    (entry) =>
                      entry.module === moduleDef.key && entry.decision_key === decision.key
                  );
                  const isDecisionLocked = stored?.locked ?? false;

                  return (
                    <div
                      key={decision.key}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {isDecisionLocked ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <Label
                          htmlFor={`${moduleDef.key}-${decision.key}`}
                          className={cn((isLocked || isDecisionLocked) && 'text-muted-foreground')}
                        >
                          {decision.label}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        <Switch
                          id={`${moduleDef.key}-${decision.key}`}
                          checked={isDecisionLocked}
                          disabled={isLocked}
                          onCheckedChange={async (checked) => {
                            try {
                              await upsertDecision.mutateAsync({
                                clientId,
                                strategyId,
                                module: moduleDef.key,
                                decisionKey: decision.key,
                                locked: checked,
                              });

                              if (moduleData?.id) {
                                const evaluation = evaluateStrategyModule(
                                  moduleDef.key,
                                  moduleData.content_json,
                                  {
                                    modules: Object.fromEntries(
                                      modules.map((mod) => [mod.module, mod.content_json])
                                    ),
                                    currentStatus: moduleData.status as StrategyStatus,
                                    isLocked: moduleData.locked,
                                  }
                                );

                                await supabase
                                  .from('strategy_modules')
                                  .update({
                                    completion_percent: evaluation.completion_percent,
                                    blockers: evaluation.blockers,
                                    blocker_count: evaluation.blockers.length,
                                    status: evaluation.status,
                                    updated_at: new Date().toISOString(),
                                  })
                                  .eq('id', moduleData.id);

                                queryClient.invalidateQueries({
                                  queryKey: strategyModulesKeys.byClient(clientId),
                                });
                              }
                            } catch (err) {
                              toast.error('Failed to update decision lock');
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {status === 'empty' && (
                <p className="text-xs text-muted-foreground mt-3 italic">
                  No content to lock yet
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default DecisionsTab;
