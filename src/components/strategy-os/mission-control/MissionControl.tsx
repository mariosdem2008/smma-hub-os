// Strategy OS - Mission Control (Layer A Overview)

import { useStrategyOS } from '../StrategyOSContext';
import { StrategyHealthCard } from './StrategyHealthCard';
import { ModuleStatusGrid } from './ModuleStatusGrid';
import { GenerateStrategyButton } from '../shared/GenerateStrategyButton';
import { calculateStrategyCompletion, getModulesWithBlockers } from '@/hooks/useStrategyModules';
import { useCloneStrategyVersion, useLockStrategyVersion } from '@/hooks/useStrategies';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';
import { StrategyDocPreview } from '../shared/StrategyDocPreview';

export function MissionControl() {
  const { modules, clientId, agencyId, strategyId, activeStrategy, strategies, setStrategyId } = useStrategyOS();
  const navigate = useNavigate();
  const cloneStrategy = useCloneStrategyVersion();
  const lockStrategy = useLockStrategyVersion();

  const completion = calculateStrategyCompletion(modules);
  const modulesWithBlockers = getModulesWithBlockers(modules);
  const hasContent = modules.some((m) => m.status !== 'empty');
  const isLocked = activeStrategy?.status === 'locked';

  const [pipelineCounts, approvalsCount, calendarCount] = useMissionControlCounts(clientId);

  const handleStartIteration = async () => {
    if (!activeStrategy) return;
    const result = await cloneStrategy.mutateAsync({
      clientId,
      agencyId,
      sourceStrategy: activeStrategy,
    });
    setStrategyId(result.id);

    await supabase.from('strategy_history').insert({
      client_id: clientId,
      strategy_id: result.id,
      module_id: null,
      module: null,
      event_type: 'created',
      event_data: { source: 'start_iteration', from_version: activeStrategy.version_int },
    });
  };

  const handleLockVersion = async () => {
    if (!activeStrategy) return;
    await lockStrategy.mutateAsync({ clientId, strategyId: activeStrategy.id });

    await supabase.from('strategy_history').insert({
      client_id: clientId,
      strategy_id: activeStrategy.id,
      module_id: null,
      module: null,
      event_type: 'locked',
      event_data: { source: 'lock_version', version: activeStrategy.version_int },
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Mission Control</h1>
            <p className="text-sm text-muted-foreground">
              Strategy overview and module status
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={strategyId} onValueChange={setStrategyId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Strategy history" />
            </SelectTrigger>
            <SelectContent>
              {strategies.map((strategy) => (
                <SelectItem key={strategy.id} value={strategy.id}>
                  {format(new Date(strategy.created_at), "MMM d, yyyy")}
                  {strategy.status === 'locked' ? ' (locked)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartIteration}
            disabled={!activeStrategy || cloneStrategy.isPending}
          >
            Create copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLockVersion}
            disabled={!activeStrategy || isLocked || lockStrategy.isPending}
          >
            Lock strategy
          </Button>
          <GenerateStrategyButton variant={hasContent ? 'outline' : 'default'} />
        </div>
      </div>

      <StrategyDocPreview view="mission-control" />

      {/* Health Card */}
      <StrategyHealthCard
        completion={completion}
        modulesCount={modules.length}
        blockersCount={modulesWithBlockers.length}
      />

      {/* Module Status Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Module Status</CardTitle>
          <CardDescription>
            Click on a module to view and edit its content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModuleStatusGrid />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {!hasContent && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <h3 className="font-medium mb-2">Get Started</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate a complete strategy foundation with templates, then customize each module.
            </p>
            <GenerateStrategyButton size="lg" />
          </CardContent>
        </Card>
      )}

      {/* Mission Control widgets */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer" onClick={() => navigate(`/clients/${clientId}?tab=pipeline`)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pipeline</CardTitle>
            <CardDescription>Projects by stage</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-xs">
            {PIPELINE_STAGE_LABELS.map((stage) => (
              <div key={stage.key} className="flex items-center justify-between">
                <span>{stage.label}</span>
                <span>{pipelineCounts[stage.key]}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="cursor-pointer" onClick={() => navigate(`/clients/${clientId}?tab=pipeline&focus=approvals`)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Approvals</CardTitle>
            <CardDescription>Client review queue</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-2xl font-semibold">{approvalsCount}</span>
            <span className="text-xs text-muted-foreground">In review</span>
          </CardContent>
        </Card>

        <Card className="cursor-pointer" onClick={() => navigate(`/clients/${clientId}?tab=calendar`)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Calendar</CardTitle>
            <CardDescription>Next 7 days</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-2xl font-semibold">{calendarCount}</span>
            <span className="text-xs text-muted-foreground">Scheduled posts</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function useMissionControlCounts(clientId: string) {
  const [pipelineCounts, setPipelineCounts] = useState({
    idea: 0,
    script_copy: 0,
    raw_assets: 0,
    editing: 0,
    internal_review: 0,
    client_review: 0,
    approved: 0,
    scheduled: 0,
    published: 0,
  });
  const [approvalsCount, setApprovalsCount] = useState(0);
  const [calendarCount, setCalendarCount] = useState(0);

  useEffect(() => {
    if (!clientId) return;

    const loadCounts = async () => {
      const { data: pipelineData } = await supabase
        .from('projects')
        .select('pipeline_stage')
        .eq('client_id', clientId);

      const counts: Record<PipelineStageKey, number> = {
        idea: 0,
        script_copy: 0,
        raw_assets: 0,
        editing: 0,
        internal_review: 0,
        client_review: 0,
        approved: 0,
        scheduled: 0,
        published: 0,
      };
      (pipelineData ?? []).forEach((row) => {
        const stage = row.pipeline_stage ?? 'idea';
        if (stage in counts) {
          counts[stage as keyof typeof counts] += 1;
        }
      });
      setPipelineCounts(counts);

      const approvals = (pipelineData ?? []).filter((row) => row.pipeline_stage === 'client_review').length;
      setApprovalsCount(approvals);

      const now = new Date();
      const inSeven = new Date();
      inSeven.setDate(now.getDate() + 7);

      const { data: scheduled } = await supabase
        .from('scheduled_posts')
        .select('id')
        .eq('client_id', clientId)
        .gte('scheduled_for', now.toISOString())
        .lte('scheduled_for', inSeven.toISOString());

      setCalendarCount((scheduled ?? []).length);
    };

    loadCounts();
  }, [clientId]);

  return [pipelineCounts, approvalsCount, calendarCount] as const;
}

type PipelineStageKey =
  | 'idea'
  | 'script_copy'
  | 'raw_assets'
  | 'editing'
  | 'internal_review'
  | 'client_review'
  | 'approved'
  | 'scheduled'
  | 'published';

const PIPELINE_STAGE_LABELS: Array<{ key: PipelineStageKey; label: string }> = [
  { key: 'idea', label: 'Idea' },
  { key: 'script_copy', label: 'Script' },
  { key: 'raw_assets', label: 'Raw' },
  { key: 'editing', label: 'Editing' },
  { key: 'internal_review', label: 'Internal' },
  { key: 'client_review', label: 'Client' },
  { key: 'approved', label: 'Approved' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
];

export default MissionControl;
