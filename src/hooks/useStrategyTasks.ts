// Strategy OS - Strategy Tasks React Query Hooks

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  StrategyModule,
  StrategyTaskRecord,
  TaskStatus,
  TaskPriority,
  ModuleContent,
  ChannelAdaptationsContent,
  WeeklyPlanContent,
  CampaignPlanContent,
  PositioningContent,
  PillarsContent,
  RulesConstraintsContent,
} from '@/lib/strategy/types';
import { STRATEGY_MODULES } from '@/lib/strategy/constants';

// Query keys
export const strategyTasksKeys = {
  all: ['strategy-tasks'] as const,
  byClient: (clientId: string, strategyId: string) =>
    [...strategyTasksKeys.all, clientId, strategyId] as const,
  byModule: (clientId: string, strategyId: string, moduleId: string) =>
    [...strategyTasksKeys.byClient(clientId, strategyId), moduleId] as const,
};

// Fetch all tasks for a client + strategy
export function useStrategyTasks(clientId: string | undefined, strategyId: string | undefined) {
  return useQuery({
    queryKey: strategyTasksKeys.byClient(clientId ?? '', strategyId ?? ''),
    queryFn: async () => {
      if (!clientId || !strategyId) return [];

      const { data, error } = await supabase
        .from('strategy_tasks')
        .select('*')
        .eq('client_id', clientId)
        .eq('strategy_id', strategyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as StrategyTaskRecord[];
    },
    enabled: !!clientId && !!strategyId,
  });
}

// Fetch tasks for a specific module
export function useModuleTasks(
  clientId: string | undefined,
  strategyId: string | undefined,
  moduleId: string | undefined
) {
  return useQuery({
    queryKey: strategyTasksKeys.byModule(clientId ?? '', strategyId ?? '', moduleId ?? ''),
    queryFn: async () => {
      if (!clientId || !strategyId || !moduleId) return [];

      const { data, error } = await supabase
        .from('strategy_tasks')
        .select('*')
        .eq('client_id', clientId)
        .eq('strategy_id', strategyId)
        .eq('module_id', moduleId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as StrategyTaskRecord[];
    },
    enabled: !!clientId && !!strategyId && !!moduleId,
  });
}

// Create a new task
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      agencyId,
      strategyId,
      moduleId,
      module,
      title,
      description,
      priority = 'medium',
      assignedTo,
    }: {
      clientId: string;
      agencyId: string;
      strategyId: string;
      moduleId?: string;
      module?: StrategyModule;
      title: string;
      description?: string;
      priority?: TaskPriority;
      assignedTo?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const { data: taskRow, error: taskError } = await supabase
        .from('tasks')
        .insert({
          client_id: clientId,
          agency_id: agencyId,
          title,
          description: description ?? null,
          priority,
          status: 'todo',
          assigned_to: assignedTo ?? null,
          created_by: userId,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      const { data, error } = await supabase
        .from('strategy_tasks')
        .insert({
          client_id: clientId,
          strategy_id: strategyId,
          module_id: moduleId ?? null,
          module: module ?? null,
          task_id: taskRow.id,
          title,
          description: description ?? null,
          priority,
          status: 'todo',
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as StrategyTaskRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: strategyTasksKeys.byClient(variables.clientId, variables.strategyId),
      });
      if (variables.moduleId) {
        queryClient.invalidateQueries({
          queryKey: strategyTasksKeys.byModule(variables.clientId, variables.strategyId, variables.moduleId),
        });
      }
    },
  });
}

// Update task status
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      clientId,
      strategyId,
      status,
    }: {
      taskId: string;
      clientId: string;
      strategyId: string;
      status: TaskStatus;
    }) => {
      const { data: strategyTask, error: taskLookupError } = await supabase
        .from('strategy_tasks')
        .select('task_id')
        .eq('id', taskId)
        .single();

      if (taskLookupError) throw taskLookupError;

      if (strategyTask?.task_id) {
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', strategyTask.task_id);
        if (taskError) throw taskError;
      }

      const { data, error } = await supabase
        .from('strategy_tasks')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as StrategyTaskRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: strategyTasksKeys.byClient(variables.clientId, variables.strategyId),
      });
    },
  });
}

// Delete a task
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      clientId,
      strategyId,
    }: {
      taskId: string;
      clientId: string;
      strategyId: string;
    }) => {
      const { data: strategyTask, error: taskLookupError } = await supabase
        .from('strategy_tasks')
        .select('task_id')
        .eq('id', taskId)
        .single();

      if (taskLookupError) throw taskLookupError;

      if (strategyTask?.task_id) {
        const { error: deleteTaskError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', strategyTask.task_id);
        if (deleteTaskError) throw deleteTaskError;
      }

      const { error } = await supabase.from('strategy_tasks').delete().eq('id', taskId);

      if (error) throw error;
      return taskId;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: strategyTasksKeys.byClient(variables.clientId, variables.strategyId),
      });
    },
  });
}

// Push task to pipeline (creates project + links)
export function usePushTaskToPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      clientId,
      strategyId,
      agencyId,
      moduleContent,
    }: {
      taskId: string;
      clientId: string;
      strategyId: string;
      agencyId: string;
      moduleContent?: ModuleContent;
    }) => {
      const { data: strategyTask, error } = await supabase
        .from('strategy_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) throw error;

      if (strategyTask.project_id) {
        return strategyTask as unknown as StrategyTaskRecord;
      }

      const platforms = inferPlatformsFromModule(moduleContent);
      let assignedTo: string | null = null;

      if (strategyTask.task_id) {
        const { data: taskRow } = await supabase
          .from('tasks')
          .select('assigned_to')
          .eq('id', strategyTask.task_id)
          .single();
        assignedTo = taskRow?.assigned_to ?? null;
      }

      const { data: projectRow, error: projectError } = await supabase
        .from('projects')
        .insert({
          client_id: clientId,
          agency_id: agencyId,
          title: strategyTask.title,
          description: strategyTask.description,
          pipeline_stage: 'idea',
          status: 'idea',
          assigned_to: assignedTo,
          platforms,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      const { data: updated, error: updateError } = await supabase
        .from('strategy_tasks')
        .update({
          status: 'pushed',
          project_id: projectRow.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select()
        .single();

      if (updateError) throw updateError;
      return updated as unknown as StrategyTaskRecord;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: strategyTasksKeys.byClient(variables.clientId, variables.strategyId),
      });
    },
  });
}

// Generate tasks from module content
export function useGenerateTasksFromModule() {
  return useMutation({
    mutationFn: async ({
      clientId,
      agencyId,
      strategyId,
      moduleId,
      module,
      content,
    }: {
      clientId: string;
      agencyId: string;
      strategyId: string;
      moduleId: string;
      module: StrategyModule;
      content: ModuleContent;
    }) => {
      const templates = generateTaskTemplatesForModule(module, content);
  const periodKey = templates[0]?.period_key ?? 'base';
      const slugs = templates.map((template) => template.slug);

      const { data: existing } = await supabase
        .from('strategy_tasks')
        .select('slug')
        .eq('strategy_id', strategyId)
        .eq('module', module)
        .eq('period_key', periodKey)
        .in('slug', slugs);

      const existingSlugs = new Set((existing ?? []).map((row) => row.slug));
      const results: StrategyTaskRecord[] = [];

      for (const template of templates) {
        if (existingSlugs.has(template.slug)) {
          continue;
        }

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id ?? null;

        const { data: taskRow, error: taskError } = await supabase
          .from('tasks')
          .insert({
            client_id: clientId,
            agency_id: agencyId,
            title: template.title,
            description: template.description,
            priority: template.priority,
            status: 'todo',
            created_by: userId,
          })
          .select()
          .single();

        if (taskError) throw taskError;

        const dedupeKey = buildDedupeKey(strategyId, module, template.period_key, template.slug);

        const { data, error } = await supabase
          .from('strategy_tasks')
          .insert({
            client_id: clientId,
            strategy_id: strategyId,
            module_id: moduleId,
            module,
            task_id: taskRow.id,
            title: template.title,
            description: template.description,
            priority: template.priority,
            status: 'todo',
            dedupe_key: dedupeKey,
            period_key: template.period_key,
            slug: template.slug,
            created_by: userId,
          })
          .select()
          .single();

        if (error) throw error;
        results.push(data as unknown as StrategyTaskRecord);
      }

      return results;
    },
  });
}

function buildDedupeKey(
  strategyId: string,
  module: StrategyModule,
  periodKey: string | null | undefined,
  slug: string
) {
  return [strategyId, module, periodKey ?? 'base', slug].join(':');
}

function inferPlatformsFromModule(content?: ModuleContent): string[] | null {
  if (!content) return null;
  if ('channels' in content) {
    const channelContent = content as ChannelAdaptationsContent;
    return channelContent.channels.filter((channel) => channel.enabled).map((channel) => channel.platform);
  }
  if ('cadenceMatrix' in content) {
    const weekly = content as WeeklyPlanContent;
    return Object.entries(weekly.cadenceMatrix)
      .filter(([, cadence]) => cadence > 0)
      .map(([platform]) => platform);
  }
  return null;
}

// Helper function to generate tasks based on module content
function generateTaskTemplatesForModule(
  module: StrategyModule,
  content: ModuleContent
): Array<{ title: string; description: string; priority: TaskPriority; slug: string; period_key: string | null }> {
  const tasks: Array<{ title: string; description: string; priority: TaskPriority; slug: string; period_key: string | null }> = [];
  const moduleDef = STRATEGY_MODULES.find((m) => m.key === module);
  const basePeriod = 'base';

  switch (module) {
    case 'positioning': {
      const data = content as PositioningContent;
      tasks.push(
        {
          title: 'Collect proof assets for positioning claims',
          description: 'Gather links or evidence for each proof point in positioning.',
          priority: 'high',
          slug: 'positioning-proof-collection',
          period_key: basePeriod,
        },
        {
          title: 'Refine differentiator phrasing',
          description: 'Finalize approved phrasing for top differentiators.',
          priority: 'medium',
          slug: 'positioning-differentiators',
          period_key: basePeriod,
        },
        {
          title: 'Finalize positioning sentence',
          description: `Confirm positioning sentence: ${data.finalSentence || 'Draft sentence'}`,
          priority: 'high',
          slug: 'positioning-final-sentence',
          period_key: basePeriod,
        }
      );
      break;
    }
    case 'pillars': {
      const data = content as PillarsContent;
      tasks.push(
        {
          title: 'Add examples for each pillar',
          description: 'Fill at least 3 real examples per pillar.',
          priority: 'high',
          slug: 'pillars-examples',
          period_key: basePeriod,
        },
        {
          title: 'Gather proof assets per pillar',
          description: `Collect proof links for ${data.pillars.length} pillars.`,
          priority: 'medium',
          slug: 'pillars-proof-assets',
          period_key: basePeriod,
        }
      );
      break;
    }
    case 'campaign_plan': {
      const data = content as CampaignPlanContent;
      const periodKey = data.selectedMonth ?? basePeriod;
      (data.campaigns ?? []).forEach((campaign) => {
        tasks.push({
          title: `Complete assets checklist for ${campaign.name}`,
          description: `Finish assets for ${campaign.name} in ${data.selectedMonth}.`,
          priority: 'high',
          slug: `campaign-assets-${campaign.id}`,
          period_key: periodKey,
        });
      });
      break;
    }
    case 'weekly_plan': {
      const data = content as WeeklyPlanContent;
      const periodKey = data.selectedWeek ?? basePeriod;
      const cadenceEntries = Object.entries(data.cadenceMatrix ?? {}).filter(([, count]) => count > 0);
      cadenceEntries.forEach(([platform, count]) => {
        tasks.push({
          title: `Plan ${count} ${platform} posts`,
          description: `Outline scripts/shoot/edit tasks for ${count} ${platform} posts.`,
          priority: 'high',
          slug: `weekly-${platform}-${periodKey ?? 'base'}`,
          period_key: periodKey,
        });
      });
      tasks.push({
        title: 'Build weekly production checklist',
        description: 'Define scripts, shoots, edits, and approvals for the week.',
        priority: 'medium',
        slug: 'weekly-production-checklist',
        period_key: periodKey,
      });
      break;
    }
    case 'channel_adaptations': {
      const data = content as ChannelAdaptationsContent;
      const enabledChannels = data.channels.filter((channel) => channel.enabled);
      enabledChannels.forEach((channel) => {
        tasks.push({
          title: `Create ${channel.platform} hook bank`,
          description: 'Build a list of hooks aligned to channel rules.',
          priority: 'medium',
          slug: `channel-hooks-${channel.platform}`,
          period_key: basePeriod,
        });
      });
      tasks.push({
        title: 'Translate core message across channels',
        description: 'Fill the translation table with core message variants.',
        priority: 'high',
        slug: 'channel-translation-table',
        period_key: basePeriod,
      });
      break;
    }
    case 'rules_constraints': {
      tasks.push(
        {
          title: 'Compile banned terms list',
          description: 'Finalize the banned terms list and share with creative team.',
          priority: 'medium',
          slug: 'rules-banned-terms',
          period_key: basePeriod,
        },
        {
          title: 'Verify proof links',
          description: 'Ensure all proof-required claims have valid proof links.',
          priority: 'high',
          slug: 'rules-proof-links',
          period_key: basePeriod,
        },
        {
          title: 'Define approval triggers',
          description: 'Confirm triggers and approval actions with stakeholders.',
          priority: 'medium',
          slug: 'rules-approval-triggers',
          period_key: basePeriod,
        }
      );
      break;
    }
  }

  if (tasks.length === 0) {
    tasks.push({
      title: `Review ${moduleDef?.label ?? module}`,
      description: `Review and update ${moduleDef?.label ?? module} content`,
      priority: 'low',
      slug: `review-${module}`,
      period_key: basePeriod,
    });
  }

  return tasks;
}

// Get task counts by status
export function getTaskCounts(tasks: StrategyTaskRecord[]): Record<TaskStatus, number> {
  return {
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    pushed: tasks.filter((t) => t.status === 'pushed').length,
  };
}
