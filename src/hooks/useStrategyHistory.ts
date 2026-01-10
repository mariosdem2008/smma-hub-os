// Strategy OS - Strategy History React Query Hooks

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  StrategyModule,
  StrategyHistoryRecord,
  HistoryEventType,
} from '@/lib/strategy/types';

// Query keys
export const strategyHistoryKeys = {
  all: ['strategy-history'] as const,
  byClient: (clientId: string) => [...strategyHistoryKeys.all, clientId] as const,
  byStrategy: (clientId: string, strategyId: string) =>
    [...strategyHistoryKeys.byClient(clientId), strategyId] as const,
  byModule: (clientId: string, moduleId: string) =>
    [...strategyHistoryKeys.byClient(clientId), moduleId] as const,
};

// Fetch all history events for a client
export function useStrategyHistory(
  clientId: string | undefined,
  strategyId: string | undefined,
  limit = 50
) {
  return useQuery({
    queryKey: [...strategyHistoryKeys.byStrategy(clientId ?? '', strategyId ?? ''), limit] as const,
    queryFn: async () => {
      if (!clientId || !strategyId) return [];

      const { data, error } = await supabase
        .from('strategy_history')
        .select('*')
        .eq('client_id', clientId)
        .eq('strategy_id', strategyId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as unknown as StrategyHistoryRecord[];
    },
    enabled: !!clientId && !!strategyId,
  });
}

// Fetch history events for a specific module
export function useModuleHistory(
  clientId: string | undefined,
  strategyId: string | undefined,
  moduleId: string | undefined,
  limit = 20
) {
  return useQuery({
    queryKey: [...strategyHistoryKeys.byModule(clientId ?? '', moduleId ?? ''), strategyId, limit] as const,
    queryFn: async () => {
      if (!clientId || !strategyId || !moduleId) return [];

      const { data, error } = await supabase
        .from('strategy_history')
        .select('*')
        .eq('client_id', clientId)
        .eq('strategy_id', strategyId)
        .eq('module_id', moduleId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as unknown as StrategyHistoryRecord[];
    },
    enabled: !!clientId && !!strategyId && !!moduleId,
  });
}

// Add a history event
export function useAddHistoryEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      strategyId,
      moduleId,
      module,
      eventType,
      eventData = {},
    }: {
      clientId: string;
      strategyId: string;
      moduleId?: string | null;
      module: StrategyModule;
      eventType: HistoryEventType;
      eventData?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase.rpc('add_strategy_history', {
        p_client_id: clientId,
        p_strategy_id: strategyId,
        p_module_id: moduleId ?? null,
        p_module: module,
        p_event_type: eventType,
        p_event_data: eventData,
      });

      if (error) throw error;
      return data as unknown as StrategyHistoryRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategyHistoryKeys.byClient(variables.clientId) });
      queryClient.invalidateQueries({
        queryKey: strategyHistoryKeys.byStrategy(variables.clientId, variables.strategyId),
      });
      if (variables.moduleId) {
        queryClient.invalidateQueries({
          queryKey: strategyHistoryKeys.byModule(variables.clientId, variables.moduleId),
        });
      }
    },
  });
}

// Helper to format history event for display
export function formatHistoryEvent(event: StrategyHistoryRecord): {
  title: string;
  description: string;
  timestamp: Date;
} {
  const timestamp = new Date(event.created_at);

  const eventTitles: Record<HistoryEventType, string> = {
    created: 'Module Created',
    updated: 'Content Updated',
    locked: 'Module Locked',
    unlocked: 'Module Unlocked',
    seeded: 'Template Draft',
    approved: 'Module Approved',
    task_created: 'Task Created',
    task_generated: 'Tasks Generated',
    task_pushed: 'Tasks Pushed to Pipeline',
  };

  const title = eventTitles[event.event_type as HistoryEventType] ?? 'Event';
  const description = event.module
    ? `${title} for ${event.module.replace('_', ' ')}`
    : title;

  return { title, description, timestamp };
}

// Group history events by date
export function groupHistoryByDate(
  events: StrategyHistoryRecord[]
): Map<string, StrategyHistoryRecord[]> {
  const grouped = new Map<string, StrategyHistoryRecord[]>();

  for (const event of events) {
    const date = new Date(event.created_at).toLocaleDateString();
    const existing = grouped.get(date) ?? [];
    grouped.set(date, [...existing, event]);
  }

  return grouped;
}
