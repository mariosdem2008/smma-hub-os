// Strategy OS - Strategy Modules React Query Hooks

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  StrategyModule,
  StrategyModuleRecord,
  ModuleContent,
  StrategyStatus,
} from '@/lib/strategy/types';
import { getDefaultModuleContent } from '@/lib/strategy/defaults';
import { STRATEGY_MODULES } from '@/lib/strategy/constants';
import { evaluateStrategyModule } from '@/lib/strategy/rulesEngine';
import { strategyDocumentsKeys } from '@/hooks/useStrategyDocuments';
import { parseEdgeFunctionResponse } from '@/lib/edgeFunctionError';

type StrategyGenerateResult =
  | { mode: 'ai'; documentId?: string | null }
  | { mode: 'unknown'; code?: string; deepLink?: string; missing_fields?: string[]; questions?: string[]; message?: string };

async function readFunctionErrorPayload(error: unknown): Promise<{ code?: string; error?: string } | null> {
  if (!error || typeof error !== 'object') return null;
  const context = (error as { context?: Response }).context;
  if (!context || typeof context.json !== 'function') return null;
  try {
    return (await context.json()) as { code?: string; error?: string };
  } catch {
    return null;
  }
}

// Query keys
export const strategyModulesKeys = {
  all: ['strategy-modules'] as const,
  byClient: (clientId: string) => [...strategyModulesKeys.all, clientId] as const,
  module: (clientId: string, module: StrategyModule) =>
    [...strategyModulesKeys.byClient(clientId), module] as const,
};

// Fetch all strategy modules for a client
export function useStrategyModules(clientId: string | undefined, strategyId: string | undefined) {
  return useQuery({
    queryKey: [...strategyModulesKeys.byClient(clientId ?? ''), strategyId] as const,
    queryFn: async () => {
      if (!clientId || !strategyId) return [];

      const { data, error } = await supabase
        .from('strategy_modules')
        .select('*')
        .eq('client_id', clientId)
        .eq('strategy_id', strategyId)
        .order('module');

      if (error) throw error;

      // Cast to our types
      return (data ?? []) as unknown as StrategyModuleRecord[];
    },
    enabled: !!clientId && !!strategyId,
  });
}

// Fetch a single strategy module
export function useStrategyModule(
  clientId: string | undefined,
  strategyId: string | undefined,
  module: StrategyModule | undefined
) {
  return useQuery({
    queryKey: [...strategyModulesKeys.module(clientId ?? '', module ?? 'positioning'), strategyId] as const,
    queryFn: async () => {
      if (!clientId || !strategyId || !module) return null;

      const { data, error } = await supabase
        .from('strategy_modules')
        .select('*')
        .eq('client_id', clientId)
        .eq('strategy_id', strategyId)
        .eq('module', module)
        .maybeSingle();

      if (error) throw error;

      return data as unknown as StrategyModuleRecord | null;
    },
    enabled: !!clientId && !!strategyId && !!module,
  });
}

// Upsert a strategy module
export function useUpsertStrategyModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      agencyId,
      strategyId,
      module,
      contentJson,
      status = 'draft',
      aiGenerated = false,
      aiConfidence,
    }: {
      clientId: string;
      agencyId: string;
      strategyId: string;
      module: StrategyModule;
      contentJson: ModuleContent;
      status?: StrategyStatus;
      aiGenerated?: boolean;
      aiConfidence?: number;
    }) => {
      const { data, error } = await supabase.rpc('upsert_strategy_module', {
        p_client_id: clientId,
        p_agency_id: agencyId,
        p_strategy_id: strategyId,
        p_module: module,
        p_content_json: contentJson,
        p_status: status,
        p_ai_generated: aiGenerated,
        p_ai_confidence: aiConfidence ?? null,
      });

      if (error) throw error;
      return data as unknown as StrategyModuleRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
    },
  });
}

// Update module content (partial update)
export function useUpdateModuleContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      moduleId,
      clientId,
      module,
      contentJson,
      status,
      modules,
      currentStatus,
      isLocked,
    }: {
      moduleId: string;
      clientId: string;
      module: StrategyModule;
      contentJson: ModuleContent;
      status?: StrategyStatus;
      modules?: Partial<Record<StrategyModule, ModuleContent>>;
      currentStatus?: StrategyStatus;
      isLocked?: boolean;
    }) => {
      const evaluation = evaluateStrategyModule(module, contentJson, {
        modules,
        currentStatus,
        isLocked,
      });

      const updates: Record<string, unknown> = {
        content_json: contentJson,
        updated_at: new Date().toISOString(),
        completion_percent: evaluation.completion_percent,
        blockers: evaluation.blockers,
        blocker_count: evaluation.blockers.length,
      };

      updates.status = status ?? evaluation.status;

      const { data, error } = await supabase
        .from('strategy_modules')
        .update(updates)
        .eq('id', moduleId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as StrategyModuleRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
    },
  });
}

// Toggle lock on a module
export function useToggleModuleLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      moduleId,
      clientId,
      lock,
      module,
      content,
      modules,
      currentStatus,
    }: {
      moduleId: string;
      clientId: string;
      lock: boolean;
      module: StrategyModule;
      content: ModuleContent;
      modules?: Partial<Record<StrategyModule, ModuleContent>>;
      currentStatus?: StrategyStatus;
    }) => {
      const { data, error } = await supabase.rpc('toggle_strategy_module_lock', {
        p_module_id: moduleId,
        p_lock: lock,
      });

      if (error) throw error;
      const moduleRecord = data as unknown as StrategyModuleRecord;

      if (!lock) {
        const evaluation = evaluateStrategyModule(module, content, {
          modules,
          currentStatus,
          isLocked: false,
        });

        const { data: updated, error: updateError } = await supabase
          .from('strategy_modules')
          .update({
            status: evaluation.status,
            completion_percent: evaluation.completion_percent,
            blockers: evaluation.blockers,
            blocker_count: evaluation.blockers.length,
            updated_at: new Date().toISOString(),
          })
          .eq('id', moduleId)
          .select()
          .single();

        if (updateError) throw updateError;
        return updated as unknown as StrategyModuleRecord;
      }

      return moduleRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
    },
  });
}

// Generate strategy via edge function
export function useGenerateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
    }: {
      clientId: string;
      agencyId: string;
      strategyId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-strategy-generate', {
        body: { client_id: clientId },
      });

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        if (payload?.code === 'MISSING_API_KEY') {
          throw new Error('AI service not configured. Contact your administrator.');
        }
        if (payload?.code === 'RAG_FAILURE') {
          throw new Error('Failed to retrieve context. Please try again.');
        }
        throw error;
      }

      const parsed = parseEdgeFunctionResponse<{
        document?: { document_id?: string | null } | null;
        unknown?: boolean;
        [key: string]: unknown;
      }>(data);

      if (!parsed.success && parsed.error) {
        return {
          mode: 'unknown',
          code: parsed.error.code,
          deepLink: parsed.error.deepLink,
          message: parsed.error.message,
          missing_fields: parsed.error.missingFields,
          questions: parsed.error.questions,
        } as StrategyGenerateResult;
      }

      const documentId = parsed.result?.document?.document_id ?? null;
      return { mode: 'ai', documentId } as StrategyGenerateResult;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: strategyDocumentsKeys.byClient(variables.clientId) });
    },
  });
}

// Initialize empty modules for a client (if none exist)
export function useInitializeModules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      agencyId,
      strategyId,
    }: {
      clientId: string;
      agencyId: string;
      strategyId: string;
    }) => {
      const results: StrategyModuleRecord[] = [];

      for (const moduleDef of STRATEGY_MODULES) {
        const content = getDefaultModuleContent(moduleDef.key);
        const evaluation = evaluateStrategyModule(moduleDef.key, content, {
          currentStatus: 'empty',
          isLocked: false,
        });

        const { data, error } = await supabase
          .from('strategy_modules')
          .upsert(
            {
              client_id: clientId,
              agency_id: agencyId,
              strategy_id: strategyId,
              module: moduleDef.key,
              content_json: content,
              status: evaluation.status,
              completion_percent: evaluation.completion_percent,
              blockers: evaluation.blockers,
              blocker_count: evaluation.blockers.length,
            },
            { onConflict: 'strategy_id,module', ignoreDuplicates: true }
          )
          .select()
          .single();

        if (!error && data) {
          results.push(data as unknown as StrategyModuleRecord);
        }
      }

      return results;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
    },
  });
}

// Calculate overall strategy completion
export function calculateStrategyCompletion(modules: StrategyModuleRecord[]): number {
  if (modules.length === 0) return 0;

  const total = modules.reduce((sum, mod) => sum + (mod.completion_percent ?? 0), 0);
  return Math.round(total / modules.length);
}

// Get modules with blockers
export function getModulesWithBlockers(modules: StrategyModuleRecord[]): StrategyModuleRecord[] {
  return modules.filter((mod) => (mod.blocker_count ?? 0) > 0);
}

// Approve a strategy module (only when blockers are clear)
export function useApproveStrategyModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      moduleId,
      clientId,
    }: {
      moduleId: string;
      clientId: string;
    }) => {
      const { data, error } = await supabase
        .from('strategy_modules')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', moduleId)
        .eq('blocker_count', 0)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as StrategyModuleRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
    },
  });
}
