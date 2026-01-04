// Strategy OS - Campaign Plan Module

import { useEffect, useRef, useState } from 'react';
import { useStrategyOS } from '../../StrategyOSContext';
import { useUpdateModuleContent } from '@/hooks/useStrategyModules';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import type { CampaignPlanContent, Campaign, CampaignStatus } from '@/lib/strategy/types';
import { useStrategyDecisions } from '@/hooks/useStrategyDecisions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Trash2, ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { getAutosaveLabel } from "@/components/strategy-os/shared/autosave";

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_COLORS: Record<CampaignStatus, string> = {
  planned: 'bg-blue-500/20 text-blue-400',
  active: 'bg-green-500/20 text-green-400',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-500/20 text-red-400',
};

export function CampaignPlanModule() {
  const { clientId, strategyId, getModuleData, isModuleLocked, modules } = useStrategyOS();
  const moduleData = getModuleData('campaign_plan');
  const updateContent = useUpdateModuleContent();
  const addHistoryEvent = useAddHistoryEvent();
  const { data: decisions = [] } = useStrategyDecisions(clientId, strategyId);

  const content = (moduleData?.content_json ?? {}) as CampaignPlanContent;
  const isLocked = isModuleLocked('campaign_plan');
  const offersLocked =
    isLocked ||
    decisions.some((decision) => decision.module === 'campaign_plan' && decision.decision_key === 'monthly_offers_locked' && decision.locked);
  const campaignsLocked =
    isLocked ||
    decisions.some((decision) => decision.module === 'campaign_plan' && decision.decision_key === 'active_campaigns_locked' && decision.locked);

  const [localContent, setLocalContent] = useState<CampaignPlanContent>(content);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [saveError, setSaveError] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse selected month
  const [year, month] = (localContent.selectedMonth || '').split('-').map(Number);
  const currentDate = new Date();
  const selectedYear = year || currentDate.getFullYear();
  const selectedMonth = (month || currentDate.getMonth() + 1) - 1;

  const updateLocal = (updates: Partial<CampaignPlanContent>) => {
    setLocalContent((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
    setSaveError(false);
  };

  const navigateMonth = (direction: -1 | 1) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    updateLocal({ selectedMonth: `${newYear}-${String(newMonth + 1).padStart(2, '0')}` });
  };

  const addCampaign = () => {
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: 'New Campaign',
      goal: '',
      offer: '',
      cta: '',
      icp: '',
      pillarIds: [],
      angle: '',
      assets: [],
      kpiTargets: {},
      startDate: localContent.selectedMonth + '-01',
      endDate: localContent.selectedMonth + '-28',
      status: 'planned',
    };
    updateLocal({ campaigns: [...(localContent.campaigns ?? []), newCampaign] });
    setEditingCampaign(newCampaign);
  };

  const updateCampaign = (id: string, updates: Partial<Campaign>) => {
    updateLocal({
      campaigns: (localContent.campaigns ?? []).map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    });
    if (editingCampaign?.id === id) {
      setEditingCampaign((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const removeCampaign = (id: string) => {
    updateLocal({
      campaigns: (localContent.campaigns ?? []).filter((c) => c.id !== id),
    });
    if (editingCampaign?.id === id) {
      setEditingCampaign(null);
    }
  };

  const handleSave = async () => {
    if (!moduleData?.id) return;

    try {
      await updateContent.mutateAsync({
        moduleId: moduleData.id,
        clientId,
        module: 'campaign_plan',
        contentJson: localContent,
        modules: Object.fromEntries(modules.map((mod) => [mod.module, mod.content_json])),
        currentStatus: moduleData.status,
        isLocked: false,
      });

      await addHistoryEvent.mutateAsync({
        clientId,
        strategyId,
        moduleId: moduleData.id,
        module: 'campaign_plan',
        eventType: 'updated',
      });

      setHasChanges(false);
      setSaveError(false);
      toast.success('Campaign plan saved');
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

  // Filter campaigns for selected month
  const monthCampaigns = (localContent.campaigns ?? []).filter((c) =>
    c.startDate?.startsWith(localContent.selectedMonth)
  );

  return (
    <div className="p-4 space-y-6">
      {/* Month Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth(-1)}
              disabled={isLocked}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <h2 className="text-xl font-semibold">
                {MONTHS[selectedMonth]} {selectedYear}
              </h2>
              <p className="text-sm text-muted-foreground">
                {monthCampaigns.length} campaign(s) planned
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth(1)}
              disabled={isLocked}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Campaigns</CardTitle>
            <CardDescription>Monthly campaigns, offers, and priorities</CardDescription>
          </div>
          <Button onClick={addCampaign} size="sm" variant="outline" disabled={campaignsLocked}>
            <Plus className="h-4 w-4 mr-1" />
            Add Campaign
          </Button>
        </CardHeader>
        <CardContent>
          {monthCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No campaigns planned for {MONTHS[selectedMonth]}
            </p>
          ) : (
            <div className="space-y-3">
              {monthCampaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => !campaignsLocked && setEditingCampaign(campaign)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Target className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">{campaign.name}</h4>
                          {campaign.goal && (
                            <p className="text-sm text-muted-foreground">{campaign.goal}</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <Badge className={STATUS_COLORS[campaign.status]}>
                              {campaign.status}
                            </Badge>
                            {campaign.offer && (
                              <Badge variant="outline">{campaign.offer}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {!isLocked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCampaign(campaign.id);
                          }}
                          disabled={campaignsLocked}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stop Doing List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-red-400">Stop Doing</CardTitle>
          <CardDescription>Things we've decided to stop doing</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={(localContent.stopDoing ?? []).join('\n')}
            onChange={(e) =>
              updateLocal({ stopDoing: e.target.value.split('\n').filter(Boolean) })
            }
            placeholder="One item per line..."
            disabled={isLocked}
            className="min-h-[100px] border-red-500/30"
          />
        </CardContent>
      </Card>

      {/* Campaign Detail Sheet */}
      <Sheet open={!!editingCampaign} onOpenChange={() => setEditingCampaign(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Campaign</SheetTitle>
            <SheetDescription>Configure campaign details</SheetDescription>
          </SheetHeader>

          {editingCampaign && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input
                  value={editingCampaign.name}
                  onChange={(e) => updateCampaign(editingCampaign.id, { name: e.target.value })}
                  disabled={campaignsLocked}
                />
              </div>

              <div className="space-y-2">
                <Label>Goal</Label>
                <Input
                  value={editingCampaign.goal}
                  onChange={(e) => updateCampaign(editingCampaign.id, { goal: e.target.value })}
                  placeholder="What's the campaign goal?"
                  disabled={campaignsLocked}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Offer</Label>
                  <Input
                    value={editingCampaign.offer}
                    onChange={(e) => updateCampaign(editingCampaign.id, { offer: e.target.value })}
                    placeholder="e.g., 20% off"
                    disabled={offersLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CTA</Label>
                  <Input
                    value={editingCampaign.cta}
                    onChange={(e) => updateCampaign(editingCampaign.id, { cta: e.target.value })}
                    placeholder="e.g., Sign up now"
                    disabled={offersLocked}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingCampaign.status}
                  onValueChange={(v) =>
                    updateCampaign(editingCampaign.id, { status: v as CampaignStatus })
                  }
                  disabled={campaignsLocked}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target ICP</Label>
                <Input
                  value={editingCampaign.icp}
                  onChange={(e) => updateCampaign(editingCampaign.id, { icp: e.target.value })}
                  placeholder="Who is this campaign for?"
                  disabled={campaignsLocked}
                />
              </div>

              <div className="space-y-2">
                <Label>Angle</Label>
                <Textarea
                  value={editingCampaign.angle}
                  onChange={(e) => updateCampaign(editingCampaign.id, { angle: e.target.value })}
                  placeholder="What's the unique angle?"
                  disabled={campaignsLocked}
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
            <div className="font-medium">Campaign plan</div>
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

export default CampaignPlanModule;
