// Strategy OS - Strategy version hooks

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StrategyRecord, StrategyModule, ModuleContent, StrategyStatus } from '@/lib/strategy/types';
import { evaluateStrategyModule } from '@/lib/strategy/rulesEngine';

export const strategiesKeys = {
  all: ['strategies'] as const,
  byClient: (clientId: string) => [...strategiesKeys.all, clientId] as const,
};

export function useStrategies(clientId: string | undefined) {
  return useQuery({
    queryKey: strategiesKeys.byClient(clientId ?? ''),
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('client_id', clientId)
        .order('version_int', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as StrategyRecord[];
    },
    enabled: !!clientId,
  });
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      agencyId,
      versionInt,
    }: {
      clientId: string;
      agencyId: string;
      versionInt: number;
    }) => {
      const { data, error } = await supabase
        .from('strategies')
        .insert({
          client_id: clientId,
          agency_id: agencyId,
          version_int: versionInt,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as StrategyRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategiesKeys.byClient(variables.clientId) });
    },
  });
}

export function useLockStrategyVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      strategyId,
      clientId,
    }: {
      strategyId: string;
      clientId: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const { data, error } = await supabase
        .from('strategies')
        .update({
          status: 'locked',
          locked_at: new Date().toISOString(),
          locked_by: userId,
        })
        .eq('id', strategyId)
        .select()
        .single();

      if (error) throw error;

      const { error: modulesError } = await supabase
        .from('strategy_modules')
        .update({
          locked: true,
          locked_at: new Date().toISOString(),
          locked_by: userId,
          status: 'locked',
        })
        .eq('strategy_id', strategyId);

      if (modulesError) throw modulesError;

      return data as unknown as StrategyRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategiesKeys.byClient(variables.clientId) });
    },
  });
}

export function useCloneStrategyVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      agencyId,
      sourceStrategy,
    }: {
      clientId: string;
      agencyId: string;
      sourceStrategy: StrategyRecord;
    }) => {
      const newVersion = sourceStrategy.version_int + 1;

      const { data: newStrategy, error: strategyError } = await supabase
        .from('strategies')
        .insert({
          client_id: clientId,
          agency_id: agencyId,
          version_int: newVersion,
          status: 'active',
        })
        .select()
        .single();

      if (strategyError) throw strategyError;

      const { data: modules, error: modulesError } = await supabase
        .from('strategy_modules')
        .select('*')
        .eq('strategy_id', sourceStrategy.id);

      if (modulesError) throw modulesError;

      const { data: decisions, error: decisionsError } = await supabase
        .from('strategy_decisions')
        .select('*')
        .eq('strategy_id', sourceStrategy.id);

      if (decisionsError) throw decisionsError;

      const moduleRows = (modules ?? []).map((moduleRow) => {
        const evaluation = evaluateStrategyModule(
          moduleRow.module as StrategyModule,
          moduleRow.content_json as ModuleContent,
          { currentStatus: moduleRow.status as StrategyStatus, isLocked: false }
        );

        return {
          client_id: moduleRow.client_id,
          agency_id: moduleRow.agency_id,
          strategy_id: newStrategy.id,
          module: moduleRow.module,
          content_json: moduleRow.content_json,
          status: evaluation.status,
          completion_percent: evaluation.completion_percent,
          blockers: evaluation.blockers,
          blocker_count: evaluation.blockers.length,
          locked: false,
          locked_at: null,
          locked_by: null,
        };
      });

      if (moduleRows.length > 0) {
        const { error: insertModulesError } = await supabase
          .from('strategy_modules')
          .insert(moduleRows);
        if (insertModulesError) throw insertModulesError;
      }

      const decisionRows = (decisions ?? []).map((decision) => ({
        strategy_id: newStrategy.id,
        client_id: decision.client_id,
        module: decision.module,
        decision_key: decision.decision_key,
        value: decision.value,
        locked: false,
        approved_by: null,
        approved_at: null,
      }));

      if (decisionRows.length > 0) {
        const { error: insertDecisionsError } = await supabase
          .from('strategy_decisions')
          .insert(decisionRows);
        if (insertDecisionsError) throw insertDecisionsError;
      }

      return newStrategy as unknown as StrategyRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategiesKeys.byClient(variables.clientId) });
    },
  });
}
