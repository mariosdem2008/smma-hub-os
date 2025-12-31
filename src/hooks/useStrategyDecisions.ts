// Strategy OS - Strategy Decisions React Query Hooks

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StrategyDecisionRecord, StrategyModule } from '@/lib/strategy/types';

export const strategyDecisionsKeys = {
  all: ['strategy-decisions'] as const,
  byStrategy: (clientId: string, strategyId: string) =>
    [...strategyDecisionsKeys.all, clientId, strategyId] as const,
};

export function useStrategyDecisions(clientId: string | undefined, strategyId: string | undefined) {
  return useQuery({
    queryKey: strategyDecisionsKeys.byStrategy(clientId ?? '', strategyId ?? ''),
    queryFn: async () => {
      if (!clientId || !strategyId) return [];

      const { data, error } = await supabase
        .from('strategy_decisions')
        .select('*')
        .eq('client_id', clientId)
        .eq('strategy_id', strategyId)
        .order('module', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as StrategyDecisionRecord[];
    },
    enabled: !!clientId && !!strategyId,
  });
}

export function useUpsertStrategyDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      strategyId,
      module,
      decisionKey,
      value,
      locked,
    }: {
      clientId: string;
      strategyId: string;
      module: StrategyModule;
      decisionKey: string;
      value?: Record<string, unknown> | null;
      locked: boolean;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const { data, error } = await supabase
        .from('strategy_decisions')
        .upsert(
          {
            client_id: clientId,
            strategy_id: strategyId,
            module,
            decision_key: decisionKey,
            value: value ?? null,
            locked,
            approved_by: locked ? userId : null,
            approved_at: locked ? new Date().toISOString() : null,
          },
          { onConflict: 'strategy_id,module,decision_key' }
        )
        .select()
        .single();

      if (error) throw error;
      return data as unknown as StrategyDecisionRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: strategyDecisionsKeys.byStrategy(variables.clientId, variables.strategyId),
      });
    },
  });
}
