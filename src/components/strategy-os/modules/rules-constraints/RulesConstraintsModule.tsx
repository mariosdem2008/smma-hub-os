// Strategy OS - Rules / Constraints Module

import { useEffect, useRef, useState } from 'react';
import { useStrategyOS } from '../../StrategyOSContext';
import { useUpdateModuleContent } from '@/hooks/useStrategyModules';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import type { RulesConstraintsContent, ClaimPolicy, ApprovalTrigger, ClaimStatus } from '@/lib/strategy/types';
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
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Shield, AlertTriangle, CheckCircle, XCircle, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAutosaveLabel } from "@/components/strategy-os/shared/autosave";

const STATUS_STYLES: Record<ClaimStatus, { icon: typeof CheckCircle; color: string }> = {
  allowed: { icon: CheckCircle, color: 'text-success' },
  proof_required: { icon: AlertTriangle, color: 'text-warning' },
  forbidden: { icon: XCircle, color: 'text-destructive' },
};

const STATUS_LABELS: Record<ClaimStatus, string> = {
  allowed: 'Allowed',
  proof_required: 'Proof required',
  forbidden: 'Forbidden',
};

export function RulesConstraintsModule() {
  const { clientId, strategyId, getModuleData, isModuleLocked, modules } = useStrategyOS();
  const moduleData = getModuleData('rules_constraints');
  const updateContent = useUpdateModuleContent();
  const addHistoryEvent = useAddHistoryEvent();
  const { data: decisions = [] } = useStrategyDecisions(clientId, strategyId);

  const content = (moduleData?.content_json ?? {}) as RulesConstraintsContent;
  const isLocked = isModuleLocked('rules_constraints');
  const forbiddenClaimsLocked =
    isLocked ||
    decisions.some((decision) => decision.module === 'rules_constraints' && decision.decision_key === 'forbidden_claims_locked' && decision.locked);
  const bannedTermsLocked =
    isLocked ||
    decisions.some((decision) => decision.module === 'rules_constraints' && decision.decision_key === 'banned_terms_locked' && decision.locked);

  const [localContent, setLocalContent] = useState<RulesConstraintsContent>(content);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateLocal = (updates: Partial<RulesConstraintsContent>) => {
    setLocalContent((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
    setSaveError(false);
  };

  // Claims Policy
  const addClaim = () => {
    const newClaim: ClaimPolicy = {
      id: Date.now().toString(),
      claim: '',
      status: 'allowed',
    };
    updateLocal({ claimsPolicy: [...(localContent.claimsPolicy ?? []), newClaim] });
  };

  const updateClaim = (id: string, updates: Partial<ClaimPolicy>) => {
    updateLocal({
      claimsPolicy: (localContent.claimsPolicy ?? []).map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    });
  };

  const removeClaim = (id: string) => {
    updateLocal({
      claimsPolicy: (localContent.claimsPolicy ?? []).filter((c) => c.id !== id),
    });
  };

  // Approval Triggers
  const addTrigger = () => {
    const newTrigger: ApprovalTrigger = {
      id: Date.now().toString(),
      condition: '',
      action: '',
    };
    updateLocal({ approvalTriggers: [...(localContent.approvalTriggers ?? []), newTrigger] });
  };

  const updateTrigger = (id: string, updates: Partial<ApprovalTrigger>) => {
    updateLocal({
      approvalTriggers: (localContent.approvalTriggers ?? []).map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    });
  };

  const removeTrigger = (id: string) => {
    updateLocal({
      approvalTriggers: (localContent.approvalTriggers ?? []).filter((t) => t.id !== id),
    });
  };

  const handleSave = async () => {
    if (!moduleData?.id) return;

    try {
      await updateContent.mutateAsync({
        moduleId: moduleData.id,
        clientId,
        module: 'rules_constraints',
        contentJson: localContent,
        modules: Object.fromEntries(modules.map((mod) => [mod.module, mod.content_json])),
        currentStatus: moduleData.status,
        isLocked: false,
      });

      await addHistoryEvent.mutateAsync({
        clientId,
        strategyId,
        moduleId: moduleData.id,
        module: 'rules_constraints',
        eventType: 'updated',
      });

      setHasChanges(false);
      setSaveError(false);
      toast.success('Rules saved');
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

  return (
    <div className="p-6 space-y-8">
      {/* Claims Policy */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Claims Policy
            </CardTitle>
            <CardDescription>
              Define which claims are allowed, require proof, or are forbidden
            </CardDescription>
          </div>
          <Button onClick={addClaim} size="sm" variant="outline" disabled={forbiddenClaimsLocked}>
            <Plus className="h-4 w-4 mr-1" />
            Add Claim
          </Button>
        </CardHeader>
        <CardContent>
          {(localContent.claimsPolicy ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No claims defined yet
            </p>
           ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/40">
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Status</TableHead>
                    <TableHead>Claim</TableHead>
                    <TableHead className="w-[360px]">Proof link</TableHead>
                    <TableHead className="w-14"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(localContent.claimsPolicy ?? []).map((claim) => {
                    const StatusIcon = STATUS_STYLES[claim.status].icon;
                    const statusLabel = STATUS_LABELS[claim.status];
                    return (
                      <TableRow key={claim.id}>
                        <TableCell>
                          <Select
                            value={claim.status}
                            onValueChange={(v) => updateClaim(claim.id, { status: v as ClaimStatus })}
                            disabled={forbiddenClaimsLocked}
                          >
                            <SelectTrigger className="h-9 w-[170px]">
                              <span className="flex items-center gap-2">
                                <StatusIcon
                                  className={cn('h-4 w-4', STATUS_STYLES[claim.status].color)}
                                />
                                <span className="text-sm">{statusLabel}</span>
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="allowed">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-success" />
                                  Allowed
                                </div>
                              </SelectItem>
                              <SelectItem value="proof_required">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-warning" />
                                  Proof required
                                </div>
                              </SelectItem>
                              <SelectItem value="forbidden">
                                <div className="flex items-center gap-2">
                                  <XCircle className="h-4 w-4 text-destructive" />
                                  Forbidden
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={claim.claim}
                            onChange={(e) => updateClaim(claim.id, { claim: e.target.value })}
                            placeholder='e.g., "We guarantee results."'
                            disabled={forbiddenClaimsLocked}
                          />
                        </TableCell>
                        <TableCell>
                          {claim.status === 'proof_required' ? (
                            <div className="flex items-center gap-2">
                              <Link2 className="h-4 w-4 text-muted-foreground" />
                              <Input
                                value={claim.proofLink ?? ''}
                                onChange={(e) => updateClaim(claim.id, { proofLink: e.target.value })}
                                placeholder="Add a link to proof / source"
                                disabled={forbiddenClaimsLocked}
                                className="text-xs"
                              />
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeClaim(claim.id)}
                            disabled={forbiddenClaimsLocked}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
           )}
         </CardContent>
       </Card>

      {/* Banned Words */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Banned words / phrases
          </CardTitle>
          <CardDescription>Words and phrases that must never appear in content</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={(localContent.bannedWords ?? []).join('\n')}
            onChange={(e) =>
              updateLocal({ bannedWords: e.target.value.split('\n').filter(Boolean) })
            }
            placeholder="One per line...&#10;Guaranteed&#10;Miracle&#10;Cure"
            disabled={bannedTermsLocked}
            className="min-h-[120px]"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Tip: keep this list short and specific. Use it as a hard "no" filter for copywriting.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {(localContent.bannedWords ?? []).slice(0, 5).map((word, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="border border-destructive/20 bg-destructive/10 text-destructive"
              >
                {word}
              </Badge>
            ))}
            {(localContent.bannedWords ?? []).length > 5 && (
              <Badge variant="secondary">+{(localContent.bannedWords ?? []).length - 5} more</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Required Disclaimers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Required Disclaimers</CardTitle>
          <CardDescription>Disclaimers that must appear in certain contexts</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={(localContent.requiredDisclaimers ?? []).join('\n')}
            onChange={(e) =>
              updateLocal({ requiredDisclaimers: e.target.value.split('\n').filter(Boolean) })
            }
            placeholder="One per line...&#10;Results may vary&#10;Past performance not indicative of future results"
            disabled={isLocked}
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      {/* Approval Triggers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Approval Triggers</CardTitle>
            <CardDescription>Conditions that require additional approval</CardDescription>
          </div>
          <Button onClick={addTrigger} size="sm" variant="outline" disabled={isLocked}>
            <Plus className="h-4 w-4 mr-1" />
            Add Trigger
          </Button>
        </CardHeader>
        <CardContent>
          {(localContent.approvalTriggers ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No approval triggers defined
            </p>
          ) : (
            <div className="space-y-3">
              {(localContent.approvalTriggers ?? []).map((trigger) => (
                <div
                  key={trigger.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex-1 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">If...</Label>
                      <Input
                        value={trigger.condition}
                        onChange={(e) =>
                          updateTrigger(trigger.id, { condition: e.target.value })
                        }
                        placeholder="Income claims"
                        disabled={isLocked}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Then...</Label>
                      <Input
                        value={trigger.action}
                        onChange={(e) =>
                          updateTrigger(trigger.id, { action: e.target.value })
                        }
                        placeholder="Require legal review"
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTrigger(trigger.id)}
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

      {/* Autosave Status */}
      <div className="sticky bottom-4">
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-4 py-3 text-sm">
          <div>
            <div className="font-medium">Rules and constraints</div>
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

export default RulesConstraintsModule;
