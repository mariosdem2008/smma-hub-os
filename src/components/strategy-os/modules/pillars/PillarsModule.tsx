// Strategy OS - Pillars Module

import { useEffect, useRef, useState } from 'react';
import { useStrategyOS } from '../../StrategyOSContext';
import { useUpdateModuleContent } from '@/hooks/useStrategyModules';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import type { PillarsContent, Pillar, PillarPurpose } from '@/lib/strategy/types';
import { PILLAR_PURPOSE_LABELS } from '@/lib/strategy/constants';
import { useStrategyDecisions } from '@/hooks/useStrategyDecisions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Plus, Trash2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAutosaveLabel } from "@/components/strategy-os/shared/autosave";

export function PillarsModule() {
  const { clientId, strategyId, getModuleData, isModuleLocked, modules } = useStrategyOS();
  const moduleData = getModuleData('pillars');
  const updateContent = useUpdateModuleContent();
  const addHistoryEvent = useAddHistoryEvent();
  const { data: decisions = [] } = useStrategyDecisions(clientId, strategyId);

  const content = (moduleData?.content_json ?? {}) as PillarsContent;
  const isLocked = isModuleLocked('pillars');
  const pillarNamesLocked =
    isLocked ||
    decisions.some((decision) => decision.module === 'pillars' && decision.decision_key === 'pillar_names_locked' && decision.locked);
  const coverageLocked =
    isLocked ||
    decisions.some((decision) => decision.module === 'pillars' && decision.decision_key === 'coverage_locked' && decision.locked);

  const [localContent, setLocalContent] = useState<PillarsContent>(content);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingPillar, setEditingPillar] = useState<Pillar | null>(null);
  const [saveError, setSaveError] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalCoverage = (localContent.pillars ?? []).reduce((sum, p) => sum + p.coveragePercent, 0);

  const updateLocal = (updates: Partial<PillarsContent>) => {
    setLocalContent((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
    setSaveError(false);
  };

  const addPillar = () => {
    const newPillar: Pillar = {
      id: Date.now().toString(),
      name: 'New Pillar',
      coveragePercent: Math.max(0, 100 - totalCoverage),
      purpose: 'reach',
      coreMessage: '',
      contentTypes: [],
      bannedAngles: [],
      kpis: [],
      examples: [],
    };
    updateLocal({ pillars: [...(localContent.pillars ?? []), newPillar] });
    setEditingPillar(newPillar);
  };

  const updatePillar = (id: string, updates: Partial<Pillar>) => {
    updateLocal({
      pillars: (localContent.pillars ?? []).map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    });
    if (editingPillar?.id === id) {
      setEditingPillar((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const removePillar = (id: string) => {
    updateLocal({
      pillars: (localContent.pillars ?? []).filter((p) => p.id !== id),
    });
    if (editingPillar?.id === id) {
      setEditingPillar(null);
    }
  };

  const handleSave = async () => {
    if (!moduleData?.id) return;

    try {
      await updateContent.mutateAsync({
        moduleId: moduleData.id,
        clientId,
        module: 'pillars',
        contentJson: localContent,
        modules: Object.fromEntries(modules.map((mod) => [mod.module, mod.content_json])),
        currentStatus: moduleData.status,
        isLocked: false,
      });

      await addHistoryEvent.mutateAsync({
        clientId,
        strategyId,
        moduleId: moduleData.id,
        module: 'pillars',
        eventType: 'updated',
      });

      setHasChanges(false);
      setSaveError(false);
      toast.success('Pillars saved');
    } catch (err) {
      setSaveError(true);
      toast.error('Failed to save');
    }
  };

  useEffect(() => {
    if (!hasChanges || isLocked || updateContent.isPending || saveError) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 750);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [hasChanges, isLocked, updateContent.isPending, localContent, saveError]);

  const statusLabel = getAutosaveLabel({
    dirty: hasChanges,
    pending: updateContent.isPending,
    error: saveError,
  });

  const purposeColors: Record<PillarPurpose, string> = {
    reach: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    authority: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    leads: 'bg-green-500/20 text-green-400 border-green-500/30',
    proof: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };

  return (
    <div className="p-4 space-y-6">
      {/* Coverage Distribution */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Content Pillars</CardTitle>
            <CardDescription>
              3-6 pillars that shape your content themes. Aim for 100% coverage.
            </CardDescription>
          </div>
          <Button
            onClick={addPillar}
            size="sm"
            variant="outline"
            disabled={pillarNamesLocked || (localContent.pillars ?? []).length >= 6}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Pillar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Progress value={totalCoverage} className="flex-1" />
            <span
              className={cn(
                'text-sm font-medium',
                totalCoverage === 100 ? 'text-green-400' : 'text-orange-400'
              )}
            >
              {totalCoverage}%
            </span>
          </div>

          {(localContent.pillars ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No pillars added yet. Add 3-6 pillars to define your content strategy.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(localContent.pillars ?? []).map((pillar) => (
                <Card
                  key={pillar.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => !isLocked && setEditingPillar(pillar)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium text-sm">{pillar.name}</h4>
                      </div>
                      {!isLocked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePillar(pillar.id);
                          }}
                          disabled={pillarNamesLocked}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <Badge className={cn('mb-2', purposeColors[pillar.purpose])}>
                      {PILLAR_PURPOSE_LABELS[pillar.purpose]}
                    </Badge>

                    <div className="flex items-center gap-2 mt-3">
                      <Progress value={pillar.coveragePercent} className="flex-1 h-2" />
                      <span className="text-xs text-muted-foreground">{pillar.coveragePercent}%</span>
                    </div>

                    {pillar.coreMessage && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {pillar.coreMessage}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pillar Detail Sheet */}
      <Sheet open={!!editingPillar} onOpenChange={() => setEditingPillar(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Pillar</SheetTitle>
            <SheetDescription>
              Configure this content pillar's details and guidelines
            </SheetDescription>
          </SheetHeader>

          {editingPillar && (
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label>Pillar Name</Label>
                <Input
                  value={editingPillar.name}
                  onChange={(e) => updatePillar(editingPillar.id, { name: e.target.value })}
                  disabled={pillarNamesLocked}
                />
              </div>

              <div className="space-y-2">
                <Label>Purpose</Label>
                <Select
                  value={editingPillar.purpose}
                  onValueChange={(v) => updatePillar(editingPillar.id, { purpose: v as PillarPurpose })}
                  disabled={isLocked}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PILLAR_PURPOSE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Coverage ({editingPillar.coveragePercent}%)</Label>
                <Slider
                  value={[editingPillar.coveragePercent]}
                  onValueChange={([v]) => updatePillar(editingPillar.id, { coveragePercent: v })}
                  max={100}
                  step={5}
                  disabled={coverageLocked}
                />
              </div>

              <div className="space-y-2">
                <Label>Core Message</Label>
                <Textarea
                  value={editingPillar.coreMessage}
                  onChange={(e) => updatePillar(editingPillar.id, { coreMessage: e.target.value })}
                  placeholder="What's the main message of this pillar?"
                  disabled={isLocked}
                />
              </div>

              <div className="space-y-2">
                <Label>Content Types (one per line)</Label>
                <Textarea
                  value={editingPillar.contentTypes.join('\n')}
                  onChange={(e) =>
                    updatePillar(editingPillar.id, {
                      contentTypes: e.target.value.split('\n').filter(Boolean),
                    })
                  }
                  placeholder="Educational posts&#10;Expert tips&#10;Industry insights"
                  disabled={isLocked}
                />
              </div>

              <div className="space-y-2">
                <Label>Banned Angles (one per line)</Label>
                <Textarea
                  value={editingPillar.bannedAngles.join('\n')}
                  onChange={(e) =>
                    updatePillar(editingPillar.id, {
                      bannedAngles: e.target.value.split('\n').filter(Boolean),
                    })
                  }
                  placeholder="Clickbait&#10;Controversy for sake of controversy"
                  disabled={isLocked}
                  className="border-red-500/30"
                />
              </div>

              <div className="space-y-2">
                <Label>KPIs (one per line)</Label>
                <Textarea
                  value={editingPillar.kpis.join('\n')}
                  onChange={(e) =>
                    updatePillar(editingPillar.id, {
                      kpis: e.target.value.split('\n').filter(Boolean),
                    })
                  }
                  placeholder="Saves&#10;Shares&#10;Comments"
                  disabled={isLocked}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Autosave Status */}
      <div className="sticky bottom-4">
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-4 py-3 text-sm">
          <div>
            <div className="font-medium">Pillars</div>
            <div className="text-muted-foreground">{statusLabel}</div>
          </div>
          {saveError && !updateContent.isPending && (
            <Button variant="outline" size="sm" onClick={handleSave}>
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PillarsModule;
