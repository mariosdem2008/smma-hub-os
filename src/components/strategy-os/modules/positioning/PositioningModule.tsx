// Strategy OS - Positioning Module (Redesigned) - FIXED VERSION
import { useEffect, useRef, useState } from 'react';
import { useStrategyOS } from '../../StrategyOSContext';
import { useUpdateModuleContent } from '@/hooks/useStrategyModules';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import type { PositioningContent, ProofPoint, Differentiator } from '@/lib/strategy/types';
import { useStrategyDecisions } from '@/hooks/useStrategyDecisions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Lock, 
  Unlock, 
  Target, 
  Shield, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Plus,
  Trash2,
  Star,
  MessageSquare,
  Award,
  GitCompare
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getAutosaveLabel } from "@/components/strategy-os/shared/autosave";

export function PositioningModule() {
  const { clientId, strategyId, getModuleData, isModuleLocked, modules } = useStrategyOS();
  const moduleData = getModuleData('positioning');
  const updateContent = useUpdateModuleContent();
  const addHistoryEvent = useAddHistoryEvent();
  const { data: decisions = [] } = useStrategyDecisions(clientId, strategyId);

  const content = (moduleData?.content_json ?? {}) as PositioningContent;
  const isLocked = isModuleLocked('positioning');
  
  // Get decision lock states from context
  const sentenceLocked = decisions.some(
    (decision) => decision.module === 'positioning' && 
    decision.decision_key === 'positioning_sentence_locked' && 
    decision.locked
  );
  
  const differentiatorsLocked = decisions.some(
    (decision) => decision.module === 'positioning' && 
    decision.decision_key === 'top_differentiators_locked' && 
    decision.locked
  );
  
  // Initialize with proper default values including missing properties
  const [localContent, setLocalContent] = useState<PositioningContent>(() => {
    // Start with content if it exists, otherwise create proper defaults
    if (Object.keys(content).length > 0) {
      return {
        sentence: content.sentence || { target: '', category: '', differentiator: '', benefit: '' },
        finalSentence: content.finalSentence || '',
        proofPoints: content.proofPoints || [],
        differentiators: content.differentiators || [],
        boundaries: content.boundaries || { 
          allowedPromises: [], 
          riskyPromises: [], 
          forbiddenPromises: [] 
        },
        decisions: content.decisions || { 
          sentenceLocked: sentenceLocked, 
          differentiatorsLocked: differentiatorsLocked 
        }
      };
    }
    
    // Default structure with proper decisions object
    return {
      sentence: { target: '', category: '', differentiator: '', benefit: '' },
      finalSentence: '',
      proofPoints: [],
      differentiators: [],
      boundaries: { 
        allowedPromises: [], 
        riskyPromises: [], 
        forbiddenPromises: [] 
      },
      decisions: { 
        sentenceLocked: sentenceLocked, 
        differentiatorsLocked: differentiatorsLocked 
      }
    };
  });
  
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateLocal = (updates: Partial<PositioningContent>) => {
    setLocalContent((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
    setSaveError(false);
  };

  // Helper function to safely update nested properties
  const updateSentenceField = (field: keyof typeof localContent.sentence, value: string) => {
    const newSentence = { ...localContent.sentence, [field]: value };
    const finalSentence = `For ${newSentence.target || '[target audience]'} who need ${newSentence.category || '[market category]'}, we are the only ${newSentence.differentiator || '[differentiator]'} that ${newSentence.benefit || '[core benefit]'}.`;
    
    updateLocal({ 
      sentence: newSentence, 
      finalSentence 
    });
  };

  const handleSave = async () => {
    if (!moduleData?.id) return;

    try {
      await updateContent.mutateAsync({
        moduleId: moduleData.id,
        clientId,
        module: 'positioning',
        contentJson: {
          ...localContent,
          // Ensure decisions object is included with current lock states
          decisions: {
            sentenceLocked: sentenceLocked,
            differentiatorsLocked: differentiatorsLocked
          }
        },
        modules: Object.fromEntries(modules.map((mod) => [mod.module, mod.content_json])),
        currentStatus: moduleData.status,
        isLocked: false,
      });

      await addHistoryEvent.mutateAsync({
        clientId,
        strategyId,
        moduleId: moduleData.id,
        module: 'positioning',
        eventType: 'updated',
      });

      setHasChanges(false);
      setSaveError(false);
      toast.success('Positioning strategy updated', {
        description: 'Your positioning framework has been saved.'
      });
    } catch (err) {
      setSaveError(true);
      toast.error('Save failed', {
        description: 'Please check your connection and try again.'
      });
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Positioning Strategy</h1>
          <p className="text-muted-foreground mt-1">
            Define how the brand stands out in the market
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className={`gap-1 border ${isLocked ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}
          >
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {isLocked ? 'Locked' : 'Editable'}
          </Badge>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["sentence", "proof", "differentiators", "boundaries"]} className="space-y-6">
        <AccordionItem value="sentence" className="border-border/60">
          <AccordionTrigger className="text-base font-semibold">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Core Statement
            </span>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <CardTitle>Positioning Statement</CardTitle>
              </div>
              <CardDescription>
                Craft your definitive market position. This statement will guide all messaging and positioning.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Target className="h-4 w-4" />
                      Target Audience
                    </Label>
                    <Input
                      value={localContent.sentence.target}
                      onChange={(e) => updateSentenceField('target', e.target.value)}
                      placeholder="Social media agencies with 5+ clients"
                      className="h-11"
                      disabled={isLocked || localContent.decisions?.sentenceLocked}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <TrendingUp className="h-4 w-4" />
                      Core Benefit
                    </Label>
                    <Input
                      value={localContent.sentence.benefit}
                      onChange={(e) => updateSentenceField('benefit', e.target.value)}
                      placeholder="Double client capacity without adding team members"
                      className="h-11"
                      disabled={isLocked || localContent.decisions?.sentenceLocked}
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Market Category</Label>
                    <Input
                      value={localContent.sentence.category}
                      onChange={(e) => updateSentenceField('category', e.target.value)}
                      placeholder="Agency operations platform"
                      className="h-11"
                      disabled={isLocked || localContent.decisions?.sentenceLocked}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Primary Differentiator</Label>
                    <Input
                      value={localContent.sentence.differentiator}
                      onChange={(e) => updateSentenceField('differentiator', e.target.value)}
                      placeholder="AI-assisted operating system"
                      className="h-11"
                      disabled={isLocked || localContent.decisions?.sentenceLocked}
                    />
                  </div>
                </div>
              </div>

              <Separator />
              
              <div className="bg-gradient-to-r  p-6 rounded-lg border">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Positioning Statement Preview
                </Label>
                <p className="mt-3 text-lg font-medium leading-relaxed">
                  For {localContent.sentence.target || '[target audience]'} who need {localContent.sentence.category || '[market category]'}, 
                  we are the only {localContent.sentence.differentiator || '[differentiator]'} that {localContent.sentence.benefit || '[core benefit]'}.
                </p>
                {localContent.finalSentence && (
                  <div className="mt-4 p-4 bg-white border rounded-md">
                    <p className="text-sm font-medium text-gray-900">{localContent.finalSentence}</p>
                    {localContent.decisions?.sentenceLocked && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        This statement is locked and cannot be edited
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="proof" className="border-border/60">
          <AccordionTrigger className="text-base font-semibold">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Evidence
            </span>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Evidence Framework</CardTitle>
                  <CardDescription>
                    Support your positioning with verifiable proof points
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => updateLocal({
                    proofPoints: [...localContent.proofPoints, {
                      id: Date.now().toString(),
                      claim: '',
                      evidence: '',
                      confidence: 3
                    }]
                  })}
                  size="sm"
                  variant="outline"
                  disabled={isLocked}
                  className="h-9"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Proof Point
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {localContent.proofPoints.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">No proof points added</p>
                    <p className="text-sm text-muted-foreground mt-1">Add evidence to strengthen your positioning</p>
                  </div>
                ) : (
                  localContent.proofPoints.map((point, index) => (
                    <div key={point.id} className="p-4 border rounded-lg hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Proof Point #{index + 1}</Label>
                            <div className="flex items-center gap-2 mt-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => updateLocal({
                                    proofPoints: localContent.proofPoints.map(p => 
                                      p.id === point.id ? { ...p, confidence: star as any } : p
                                    )
                                  })}
                                  disabled={isLocked}
                                >
                                  <Star className={`h-4 w-4 ${star <= point.confidence ? 'fill-primary text-primary' : 'text-gray-300'}`} />
                                </button>
                              ))}
                              <span className="text-xs text-muted-foreground ml-2">
                                Confidence: {point.confidence}/5
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateLocal({
                            proofPoints: localContent.proofPoints.filter(p => p.id !== point.id)
                          })}
                          disabled={isLocked}
                          className="h-8 w-8 text-gray-400 hover:text-gray-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-sm">Claim</Label>
                          <Textarea
                            value={point.claim}
                            onChange={(e) => updateLocal({
                              proofPoints: localContent.proofPoints.map(p => 
                                p.id === point.id ? { ...p, claim: e.target.value } : p
                              )
                            })}
                            placeholder="What we claim to be true..."
                            className="min-h-[80px] resize-none"
                            disabled={isLocked}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Evidence</Label>
                          <Textarea
                            value={point.evidence}
                            onChange={(e) => updateLocal({
                              proofPoints: localContent.proofPoints.map(p => 
                                p.id === point.id ? { ...p, evidence: e.target.value } : p
                              )
                            })}
                            placeholder="Supporting data, testimonials, or metrics..."
                            className="min-h-[80px] resize-none"
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="differentiators" className="border-border/60">
          <AccordionTrigger className="text-base font-semibold">
            <span className="flex items-center gap-2">
              <GitCompare className="h-4 w-4" />
              Differentiators
            </span>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Competitive Differentiation</CardTitle>
                  <CardDescription>
                    Define approved and banned language for your unique value
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => updateLocal({
                    differentiators: [...localContent.differentiators, {
                      id: Date.now().toString(),
                      rank: localContent.differentiators.length + 1,
                      approvedPhrasing: '',
                      bannedPhrasing: []
                    }]
                  })}
                  size="sm"
                  variant="outline"
                  disabled={isLocked || localContent.decisions?.differentiatorsLocked}
                  className="h-9"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Differentiator
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {localContent.differentiators.map((diff, index) => (
                  <div key={diff.id} className="p-5 border rounded-lg ">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          #{index + 1}
                        </Badge>
                        <span className="text-sm font-medium text-muted-foreground">
                          Rank {diff.rank} Differentiator
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateLocal({
                          differentiators: localContent.differentiators.filter(d => d.id !== diff.id)
                        })}
                        disabled={isLocked || localContent.decisions?.differentiatorsLocked}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm font-medium">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Approved Language
                        </Label>
                        <Textarea
                          value={diff.approvedPhrasing}
                          onChange={(e) => updateLocal({
                            differentiators: localContent.differentiators.map(d => 
                              d.id === diff.id ? { ...d, approvedPhrasing: e.target.value } : d
                            )
                          })}
                          placeholder="How we describe this differentiator..."
                          className="min-h-[100px] resize-none"
                          disabled={isLocked || localContent.decisions?.differentiatorsLocked}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm font-medium">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Banned Language
                        </Label>
                        <Textarea
                          value={diff.bannedPhrasing.join('\n')}
                          onChange={(e) => updateLocal({
                            differentiators: localContent.differentiators.map(d => 
                              d.id === diff.id ? { 
                                ...d, 
                                bannedPhrasing: e.target.value.split('\n').filter(Boolean) 
                              } : d
                            )
                          })}
                          placeholder="One phrase per line. Language to avoid..."
                          className="min-h-[80px] resize-none"
                          disabled={isLocked || localContent.decisions?.differentiatorsLocked}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="boundaries" className="border-border/60">
          <AccordionTrigger className="text-base font-semibold">
            <span className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Boundaries
            </span>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-green-200">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-base">Core Promises</CardTitle>
                </div>
                <CardDescription>
                  What we guarantee to deliver
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={localContent.boundaries.allowedPromises.join('\n')}
                  onChange={(e) => updateLocal({
                    boundaries: {
                      ...localContent.boundaries,
                      allowedPromises: e.target.value.split('\n').filter(Boolean)
                    }
                  })}
                  placeholder="• 2x client capacity with same team\n• Unified strategy + content workflow\n• AI-assisted content generation\n• Real-time client approvals"
                  className="min-h-[200px] font-mono text-sm"
                  disabled={isLocked}
                />
              </CardContent>
            </Card>
            
            <Card className="border-yellow-200">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <CardTitle className="text-base">Qualified Claims</CardTitle>
                </div>
                <CardDescription>
                  Results dependent on specific conditions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={localContent.boundaries.riskyPromises.join('\n')}
                  onChange={(e) => updateLocal({
                    boundaries: {
                      ...localContent.boundaries,
                      riskyPromises: e.target.value.split('\n').filter(Boolean)
                    }
                  })}
                  placeholder="• 3x ROI when following best practices\n• 50% time savings after 30 days\n• Client satisfaction scores above 4.5/5"
                  className="min-h-[200px] font-mono text-sm"
                  disabled={isLocked}
                />
              </CardContent>
            </Card>
            
            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-base">Exclusions</CardTitle>
                </div>
                <CardDescription>
                  What we explicitly don't promise
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={localContent.boundaries.forbiddenPromises.join('\n')}
                  onChange={(e) => updateLocal({
                    boundaries: {
                      ...localContent.boundaries,
                      forbiddenPromises: e.target.value.split('\n').filter(Boolean)
                    }
                  })}
                  placeholder="• Instant overnight success\n• Zero effort required\n• Replacement of human strategists\n• Guaranteed viral content"
                  className="min-h-[200px] font-mono text-sm"
                  disabled={isLocked}
                />
              </CardContent>
            </Card>
          </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Save Section */}
      <div className="sticky bottom-6 mt-8">
        <div className="flex items-center justify-between p-4  backdrop-blur-sm border rounded-lg shadow-lg">
          <div className="text-sm">
            <div className="font-medium">Positioning Strategy</div>
            <div className="text-muted-foreground">
              {statusLabel}
              {localContent.decisions?.sentenceLocked && ' • Sentence locked'}
              {localContent.decisions?.differentiatorsLocked && ' • Differentiators locked'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setLocalContent(content);
                setHasChanges(false);
                setSaveError(false);
              }}
              disabled={!hasChanges || isLocked}
              className="h-10"
            >
              Reset
            </Button>
            {saveError && !updateContent.isPending && (
              <Button
                onClick={handleSave}
                disabled={isLocked}
                className="h-10 px-6"
              >
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PositioningModule;
