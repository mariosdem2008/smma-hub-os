// Strategy OS - Channel Adaptations Module

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStrategyOS } from '../../StrategyOSContext';
import { useUpdateModuleContent } from '@/hooks/useStrategyModules';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import type {
  ChannelAdaptationsContent,
  ChannelConfig,
  Platform,
  PillarsContent,
  PositioningContent,
} from '@/lib/strategy/types';
import { getPlatformDefinition } from '@/lib/strategy/constants';
import { useStrategyDecisions } from '@/hooks/useStrategyDecisions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Share2, Settings, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAutosaveLabel } from "@/components/strategy-os/shared/autosave";

export function ChannelAdaptationsModule() {
  const { clientId, strategyId, getModuleData, isModuleLocked, modules } = useStrategyOS();
  const moduleData = getModuleData('channel_adaptations');
  const updateContent = useUpdateModuleContent();
  const addHistoryEvent = useAddHistoryEvent();
  const { data: decisions = [] } = useStrategyDecisions(clientId, strategyId);

  const content = (moduleData?.content_json ?? {}) as ChannelAdaptationsContent;
  const isLocked = isModuleLocked('channel_adaptations');
  const ctaRulesLocked =
    isLocked ||
    decisions.some((decision) => decision.module === 'channel_adaptations' && decision.decision_key === 'channel_cta_rules_locked' && decision.locked);
  const doDontLocked =
    isLocked ||
    decisions.some((decision) => decision.module === 'channel_adaptations' && decision.decision_key === 'channel_do_dont_locked' && decision.locked);

  const [localContent, setLocalContent] = useState<ChannelAdaptationsContent>(content);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelConfig | null>(null);
  const [saveError, setSaveError] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const positioning = modules.find((mod) => mod.module === "positioning")?.content_json as PositioningContent | undefined;
  const pillars = modules.find((mod) => mod.module === "pillars")?.content_json as PillarsContent | undefined;

  const defaultGuidance = useMemo(() => {
    const positioningLine = positioning?.finalSentence?.trim() || "";
    const pillarLines = (pillars?.pillars ?? [])
      .map((pillar) => `- ${pillar.name}${pillar.coreMessage ? `: ${pillar.coreMessage}` : ""}`)
      .join("\n");
    const parts = [
      positioningLine ? `Positioning:\n${positioningLine}` : "",
      pillarLines ? `Pillars:\n${pillarLines}` : "",
      "Channel intent: Adapt tone, cadence, and formats without changing the core message.",
    ].filter(Boolean);
    return parts.join("\n\n");
  }, [positioning?.finalSentence, pillars?.pillars]);

  const updateLocal = (updates: Partial<ChannelAdaptationsContent>) => {
    setLocalContent((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
    setSaveError(false);
  };

  const updateChannel = (id: string, updates: Partial<ChannelConfig>) => {
    updateLocal({
      channels: (localContent.channels ?? []).map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    });
    if (editingChannel?.id === id) {
      setEditingChannel((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const addTranslationRow = () => {
    updateLocal({
      translationTable: [
        ...(localContent.translationTable ?? []),
        { coreMessage: '', variants: {} },
      ],
    });
  };

  const updateTranslationRow = (index: number, updates: Partial<ChannelAdaptationsContent['translationTable'][number]>) => {
    const rows = [...(localContent.translationTable ?? [])];
    rows[index] = { ...rows[index], ...updates };
    updateLocal({ translationTable: rows });
  };

  const removeTranslationRow = (index: number) => {
    const rows = [...(localContent.translationTable ?? [])];
    rows.splice(index, 1);
    updateLocal({ translationTable: rows });
  };

  const handleSave = async () => {
    if (!moduleData?.id) return;

    try {
      await updateContent.mutateAsync({
        moduleId: moduleData.id,
        clientId,
        module: 'channel_adaptations',
        contentJson: localContent,
        modules: Object.fromEntries(modules.map((mod) => [mod.module, mod.content_json])),
        currentStatus: moduleData.status,
        isLocked: false,
      });

      await addHistoryEvent.mutateAsync({
        clientId,
        strategyId,
        moduleId: moduleData.id,
        module: 'channel_adaptations',
        eventType: 'updated',
      });

      setHasChanges(false);
      setSaveError(false);
      toast.success('Channel adaptations saved');
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

  const enabledChannels = (localContent.channels ?? []).filter((c) => c.enabled);

  return (
    <div className="p-4 space-y-6">
      {/* Channel Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Channels
          </CardTitle>
          <CardDescription>
            Enable channels and configure platform-specific adaptations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Auto guidance
            </div>
            <Textarea
              value={localContent.defaultGuidance ?? defaultGuidance}
              onChange={(event) => updateLocal({ defaultGuidance: event.target.value })}
              className="min-h-[120px] text-sm"
              placeholder="Auto guidance will appear here."
              disabled={isLocked}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(localContent.channels ?? []).map((channel) => {
              const platformDef = getPlatformDefinition(channel.platform);
              return (
                <Card
                  key={channel.id}
                  className={cn(
                    'transition-all duration-200',
                    !channel.enabled && 'opacity-50',
                    channel.enabled && 'hover:border-primary/50 cursor-pointer'
                  )}
                  onClick={() => channel.enabled && !isLocked && setEditingChannel(channel)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-xs', platformDef?.color)}>
                          {platformDef?.label}
                        </Badge>
                      </div>
                      <Switch
                        checked={channel.enabled}
                        onCheckedChange={(enabled) => updateChannel(channel.id, { enabled })}
                        disabled={isLocked}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {channel.enabled ? (
                      <>
                        {channel.role && (
                          <p className="text-sm text-muted-foreground mb-2">{channel.role}</p>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {channel.cadence || 'No cadence set'}
                        </div>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {channel.formats.slice(0, 3).map((format, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">
                              {format}
                            </Badge>
                          ))}
                          {channel.formats.length > 3 && (
                            <Badge variant="secondary" className="text-[10px]">
                              +{channel.formats.length - 3}
                            </Badge>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Channel disabled</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Translation Table */}
      <Accordion type="single" collapsible className="space-y-4">
        <AccordionItem value="advanced" className="border-border/60">
          <AccordionTrigger className="text-base font-semibold">
            Advanced: Translation table
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Translation Table</CardTitle>
                  <CardDescription>
                    How core messages adapt across channels
                  </CardDescription>
                </div>
                <Button onClick={addTranslationRow} size="sm" variant="outline" disabled={isLocked}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Row
                </Button>
              </CardHeader>
              <CardContent>
                {(localContent.translationTable ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No translations added yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {(localContent.translationTable ?? []).map((row, idx) => (
                      <div key={idx} className="space-y-3 p-4 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Row {idx + 1}</Label>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTranslationRow(idx)}
                            disabled={isLocked}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Core Message</Label>
                          <Input
                            value={row.coreMessage}
                            onChange={(e) => updateTranslationRow(idx, { coreMessage: e.target.value })}
                            placeholder="Core message..."
                            disabled={isLocked}
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3 mt-2">
                          {enabledChannels.map((channel) => (
                            <div key={channel.id} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                {getPlatformDefinition(channel.platform)?.label}
                              </Label>
                              <Input
                                value={row.variants[channel.platform] ?? ''}
                                onChange={(e) =>
                                  updateTranslationRow(idx, {
                                    variants: { ...row.variants, [channel.platform]: e.target.value },
                                  })
                                }
                                placeholder="Variant..."
                                disabled={isLocked}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Channel Detail Sheet */}
      <Sheet open={!!editingChannel} onOpenChange={() => setEditingChannel(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {getPlatformDefinition(editingChannel?.platform as Platform)?.label} Settings
            </SheetTitle>
            <SheetDescription>Configure channel-specific rules</SheetDescription>
          </SheetHeader>

          {editingChannel && (
            <Tabs defaultValue="basics" className="mt-6">
              <TabsList className="w-full">
                <TabsTrigger value="basics" className="flex-1">Basics</TabsTrigger>
                <TabsTrigger value="rules" className="flex-1">Rules</TabsTrigger>
                <TabsTrigger value="dos" className="flex-1">Do/Don't</TabsTrigger>
              </TabsList>

              <TabsContent value="basics" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    value={editingChannel.role}
                    onChange={(e) => updateChannel(editingChannel.id, { role: e.target.value })}
                    placeholder="What's this channel's strategic role?"
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cadence</Label>
                  <Input
                    value={editingChannel.cadence}
                    onChange={(e) => updateChannel(editingChannel.id, { cadence: e.target.value })}
                    placeholder="e.g., 5-7 posts/week"
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Formats (one per line)</Label>
                  <Textarea
                    value={editingChannel.formats.join('\n')}
                    onChange={(e) =>
                      updateChannel(editingChannel.id, {
                        formats: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    placeholder="Reels&#10;Carousels&#10;Stories"
                    disabled={isLocked}
                  />
                </div>
              </TabsContent>

              <TabsContent value="rules" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Hook Rules (one per line)</Label>
                  <Textarea
                    value={editingChannel.hookRules.join('\n')}
                    onChange={(e) =>
                      updateChannel(editingChannel.id, {
                        hookRules: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    placeholder="Start with movement&#10;First 3 seconds critical"
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CTA Rules (one per line)</Label>
                  <Textarea
                    value={editingChannel.ctaRules.join('\n')}
                    onChange={(e) =>
                      updateChannel(editingChannel.id, {
                        ctaRules: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    placeholder="Link in bio&#10;DM for details"
                    disabled={ctaRulesLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Visual Rules (one per line)</Label>
                  <Textarea
                    value={editingChannel.visualRules.join('\n')}
                    onChange={(e) =>
                      updateChannel(editingChannel.id, {
                        visualRules: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    placeholder="On-brand colors&#10;High contrast"
                    disabled={isLocked}
                  />
                </div>
              </TabsContent>

              <TabsContent value="dos" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-success">Do's (one per line)</Label>
                  <Textarea
                    value={editingChannel.dos.join('\n')}
                    onChange={(e) =>
                      updateChannel(editingChannel.id, {
                        dos: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    placeholder="Use trending audio&#10;Engage in comments"
                    disabled={doDontLocked}
                    className="border-success/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-destructive">Don'ts (one per line)</Label>
                  <Textarea
                    value={editingChannel.donts.join('\n')}
                    onChange={(e) =>
                      updateChannel(editingChannel.id, {
                        donts: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    placeholder="Ignore DMs&#10;Post blurry content"
                    disabled={doDontLocked}
                    className="border-destructive/30"
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {/* Autosave Status */}
      <div className="sticky bottom-4">
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-4 py-3 text-sm">
          <div>
            <div className="font-medium">Channel adaptations</div>
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

export default ChannelAdaptationsModule;
