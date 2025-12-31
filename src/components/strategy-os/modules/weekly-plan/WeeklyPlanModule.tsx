// Strategy OS - Weekly Plan Module

import { useState } from 'react';
import { useStrategyOS } from '../../StrategyOSContext';
import { useUpdateModuleContent } from '@/hooks/useStrategyModules';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import type { WeeklyPlanContent, ProductionItem, ProductionItemType } from '@/lib/strategy/types';
import { PLATFORMS } from '@/lib/strategy/constants';
import { useStrategyDecisions } from '@/hooks/useStrategyDecisions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Save, ChevronLeft, ChevronRight, CalendarDays, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WeeklyPlanModule() {
  const { clientId, strategyId, getModuleData, isModuleLocked, modules } = useStrategyOS();
  const moduleData = getModuleData('weekly_plan');
  const updateContent = useUpdateModuleContent();
  const addHistoryEvent = useAddHistoryEvent();
  const { data: decisions = [] } = useStrategyDecisions(clientId, strategyId);

  const content = (moduleData?.content_json ?? {}) as WeeklyPlanContent;
  const isLocked = isModuleLocked('weekly_plan');
  const objectiveLocked =
    isLocked ||
    decisions.some((decision) => decision.module === 'weekly_plan' && decision.decision_key === 'weekly_objective_locked' && decision.locked);
  const cadenceLocked =
    isLocked ||
    decisions.some((decision) => decision.module === 'weekly_plan' && decision.decision_key === 'cadence_locked' && decision.locked);

  const [localContent, setLocalContent] = useState<WeeklyPlanContent>(content);
  const [hasChanges, setHasChanges] = useState(false);

  // Parse week
  const [yearPart, weekPart] = (localContent.selectedWeek || '').split('-W');
  const currentDate = new Date();
  const selectedYear = parseInt(yearPart) || currentDate.getFullYear();
  const selectedWeek = parseInt(weekPart) || 1;

  const updateLocal = (updates: Partial<WeeklyPlanContent>) => {
    setLocalContent((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const navigateWeek = (direction: -1 | 1) => {
    let newWeek = selectedWeek + direction;
    let newYear = selectedYear;
    if (newWeek < 1) {
      newWeek = 52;
      newYear--;
    } else if (newWeek > 52) {
      newWeek = 1;
      newYear++;
    }
    updateLocal({ selectedWeek: `${newYear}-W${String(newWeek).padStart(2, '0')}` });
  };

  const updateCadence = (platform: string, value: number) => {
    updateLocal({
      cadenceMatrix: { ...localContent.cadenceMatrix, [platform]: value },
    });
  };

  const addProductionItem = () => {
    const newItem: ProductionItem = {
      id: Date.now().toString(),
      type: 'script',
      title: '',
      owner: '',
      dueDate: '',
      completed: false,
    };
    updateLocal({
      productionChecklist: [...(localContent.productionChecklist ?? []), newItem],
    });
  };

  const updateProductionItem = (id: string, updates: Partial<ProductionItem>) => {
    updateLocal({
      productionChecklist: (localContent.productionChecklist ?? []).map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    });
  };

  const removeProductionItem = (id: string) => {
    updateLocal({
      productionChecklist: (localContent.productionChecklist ?? []).filter(
        (item) => item.id !== id
      ),
    });
  };

  const handleSave = async () => {
    if (!moduleData?.id) return;

    try {
      await updateContent.mutateAsync({
        moduleId: moduleData.id,
        clientId,
        module: 'weekly_plan',
        contentJson: localContent,
        modules: Object.fromEntries(modules.map((mod) => [mod.module, mod.content_json])),
        currentStatus: moduleData.status,
        isLocked: false,
      });

      await addHistoryEvent.mutateAsync({
        clientId,
        strategyId,
        moduleId: moduleData.id,
        module: 'weekly_plan',
        eventType: 'updated',
      });

      setHasChanges(false);
      toast.success('Weekly plan saved');
    } catch (err) {
      toast.error('Failed to save');
    }
  };

  const totalPosts = Object.values(localContent.cadenceMatrix ?? {}).reduce(
    (sum, val) => sum + (val || 0),
    0
  );

  return (
    <div className="p-4 space-y-6">
      {/* Week Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateWeek(-1)}
              disabled={isLocked}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Week {selectedWeek}, {selectedYear}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{totalPosts} posts planned</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateWeek(1)}
              disabled={isLocked}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Focus */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Weekly Focus
          </CardTitle>
          <CardDescription>What's the primary objective for this week?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Objective</Label>
            <Input
              value={localContent.weeklyFocus?.objective ?? ''}
              onChange={(e) =>
                updateLocal({
                  weeklyFocus: { ...localContent.weeklyFocus, objective: e.target.value },
                })
              }
              placeholder="e.g., Launch campaign awareness phase"
              disabled={objectiveLocked}
            />
          </div>
          <div className="space-y-2">
            <Label>KPI Focus (one per line)</Label>
            <Textarea
              value={(localContent.weeklyFocus?.kpiFocus ?? []).join('\n')}
              onChange={(e) =>
                updateLocal({
                  weeklyFocus: {
                    ...localContent.weeklyFocus,
                    kpiFocus: e.target.value.split('\n').filter(Boolean),
                  },
                })
              }
              placeholder="Reach&#10;Engagement rate"
              disabled={objectiveLocked}
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cadence Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadence Matrix</CardTitle>
          <CardDescription>Posts per channel this week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PLATFORMS.map((platform) => (
              <div key={platform.key} className="flex items-center gap-4">
                <div className="w-24">
                  <Badge variant="outline" className={platform.color}>
                    {platform.label}
                  </Badge>
                </div>
                <Slider
                  value={[localContent.cadenceMatrix?.[platform.key] ?? 0]}
                  onValueChange={([v]) => updateCadence(platform.key, v)}
                  max={14}
                  step={1}
                  disabled={cadenceLocked}
                  className="flex-1"
                />
                <span className="w-8 text-sm text-muted-foreground text-right">
                  {localContent.cadenceMatrix?.[platform.key] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Production Checklist */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Production Checklist</CardTitle>
            <CardDescription>Scripts, shoots, edits, and approvals</CardDescription>
          </div>
          <Button onClick={addProductionItem} size="sm" variant="outline" disabled={isLocked}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent>
          {(localContent.productionChecklist ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No production items yet
            </p>
          ) : (
            <div className="space-y-2">
              {(localContent.productionChecklist ?? []).map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg bg-muted/30',
                    item.completed && 'opacity-60'
                  )}
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={(checked) =>
                      updateProductionItem(item.id, { completed: checked === true })
                    }
                    disabled={isLocked}
                  />
                  <Select
                    value={item.type}
                    onValueChange={(v) =>
                      updateProductionItem(item.id, { type: v as ProductionItemType })
                    }
                    disabled={isLocked}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="script">Script</SelectItem>
                      <SelectItem value="shoot">Shoot</SelectItem>
                      <SelectItem value="edit">Edit</SelectItem>
                      <SelectItem value="approval">Approval</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={item.title}
                    onChange={(e) => updateProductionItem(item.id, { title: e.target.value })}
                    placeholder="Task title..."
                    className={cn('flex-1', item.completed && 'line-through')}
                    disabled={isLocked}
                  />
                  <Input
                    value={item.owner}
                    onChange={(e) => updateProductionItem(item.id, { owner: e.target.value })}
                    placeholder="Owner"
                    className="w-24"
                    disabled={isLocked}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProductionItem(item.id)}
                    disabled={isLocked}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Review */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Review</CardTitle>
          <CardDescription>Wins, losses, and changes for next week</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-green-400">Wins</Label>
              <Textarea
                value={(localContent.weeklyReview?.wins ?? []).join('\n')}
                onChange={(e) =>
                  updateLocal({
                    weeklyReview: {
                      ...localContent.weeklyReview,
                      wins: e.target.value.split('\n').filter(Boolean),
                    },
                  })
                }
                placeholder="One per line..."
                disabled={isLocked}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-red-400">Losses</Label>
              <Textarea
                value={(localContent.weeklyReview?.losses ?? []).join('\n')}
                onChange={(e) =>
                  updateLocal({
                    weeklyReview: {
                      ...localContent.weeklyReview,
                      losses: e.target.value.split('\n').filter(Boolean),
                    },
                  })
                }
                placeholder="One per line..."
                disabled={isLocked}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-blue-400">Changes Next Week</Label>
              <Textarea
                value={(localContent.weeklyReview?.changesNextWeek ?? []).join('\n')}
                onChange={(e) =>
                  updateLocal({
                    weeklyReview: {
                      ...localContent.weeklyReview,
                      changesNextWeek: e.target.value.split('\n').filter(Boolean),
                    },
                  })
                }
                placeholder="One per line..."
                disabled={isLocked}
                className="min-h-[100px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && !isLocked && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={updateContent.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}

export default WeeklyPlanModule;
