// ============================================================================
// Review Step - Final review with 6-module tile grid
// ============================================================================

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StepLayout } from '../components/StepLayout';
import { useOnboarding } from '../OnboardingContext';
import { calculateReadiness, getBlockers, areBlockersCleared, getReadinessLevel } from '@/lib/onboarding/readiness';
import { useToast } from '@/hooks/use-toast';
import { getMissingFieldMeta } from '@/data';
import {
  Target,
  Layers,
  Calendar,
  BarChart3,
  Share2,
  Shield,
  Check,
  AlertTriangle,
  Sparkles,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Strategy module definitions
const STRATEGY_MODULES = [
  {
    key: 'positioning',
    title: 'Positioning',
    description: 'Who you help and how',
    icon: Target,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    dependencies: ['q6_offer_name', 'q8_ideal_customer', 'q10_desired_outcome', 'q13_differentiators'],
  },
  {
    key: 'pillars',
    title: 'Content Pillars',
    description: '3-5 core content themes',
    icon: Layers,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    dependencies: ['q9_pain_points', 'q13_differentiators'],
  },
  {
    key: 'campaign_plan',
    title: 'Campaign Plan',
    description: 'Offers and launches',
    icon: Calendar,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    dependencies: ['q6_offer_name', 'q6_main_cta', 'q8_ideal_customer'],
  },
  {
    key: 'weekly_plan',
    title: 'Weekly Plan',
    description: 'Content cadence',
    icon: BarChart3,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    dependencies: ['q16_enabled_channels', 'q18_cadence'],
  },
  {
    key: 'channel_adaptations',
    title: 'Channel Strategy',
    description: 'Platform-specific tactics',
    icon: Share2,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    dependencies: ['q16_enabled_channels', 'q17_primary_goal'],
  },
  {
    key: 'rules_constraints',
    title: 'Rules & Proof',
    description: 'Claims and evidence',
    icon: Shield,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    dependencies: ['q14_proof_level', 'q15_proof_points'],
  },
];

export function ReviewStep() {
  const { state, prevStep, completeOnboarding, goToStep } = useOnboarding();
  const navigate = useNavigate();
  const { toast } = useToast();
  const currentStep = state.steps.find((s) => s.id === 'review');

  const [isGenerating, setIsGenerating] = useState(false);

  // Calculate readiness and blockers
  const readiness = useMemo(() => calculateReadiness(state.profile), [state.profile]);
  const readinessLevel = useMemo(() => getReadinessLevel(readiness.percentage), [readiness.percentage]);
  const blockers = useMemo(() => getBlockers(state.profile), [state.profile]);
  const canComplete = areBlockersCleared(state.profile);

  // Calculate module completion for each tile
  const moduleCompletions = useMemo(() => {
    return STRATEGY_MODULES.map((module) => {
      const filledDeps = module.dependencies.filter((dep) => {
        const value = state.profile[dep as keyof typeof state.profile];
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
        return value !== null && value !== undefined && value !== '';
      });

      const completion = Math.round((filledDeps.length / module.dependencies.length) * 100);
      const missingFields = module.dependencies.filter((dep) => {
        const value = state.profile[dep as keyof typeof state.profile];
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object' && value !== null) return Object.keys(value).length === 0;
        return value === null || value === undefined || value === '';
      });

      return {
        ...module,
        completion,
        missingFields,
        isComplete: completion === 100,
      };
    });
  }, [state.profile]);

  // Count AI assumptions
  const aiAssumptions = useMemo(() => {
    const provenanceFields = [
      'q1_provenance', 'q2_provenance', 'q3_provenance', 'q4_provenance',
      'q5_provenance', 'q6_provenance', 'q7_provenance', 'q8_provenance',
      'q9_provenance', 'q10_provenance', 'q11_provenance', 'q12_provenance',
      'q13_provenance', 'q14_provenance', 'q15_provenance', 'q16_provenance',
      'q17_provenance', 'q18_provenance',
    ];

    return provenanceFields.filter(
      (field) => state.profile[field as keyof typeof state.profile] === 'ai_assumed'
    ).length;
  }, [state.profile]);

  const getStepIdFromHref = (href: string | null | undefined) => {
    if (!href) return null;
    const [prefix, value] = href.split(':');
    if (prefix === 'onboarding') return value || null;
    return null;
  };

  const handleFixNow = (href: string) => {
    const stepId = getStepIdFromHref(href);
    const targetStepId = stepId === 'start' ? state.steps[0]?.id : stepId;
    if (targetStepId) {
      const targetIndex = state.steps.findIndex((step) => step.id === targetStepId);
      if (targetIndex >= 0) {
        goToStep(targetIndex);
        return;
      }
    }

    if (state.profile.client_id) {
      navigate(`/onboarding/client/${state.profile.client_id}`);
    }
  };

  const handleGenerateStrategy = async () => {
    if (!canComplete) return;

    setIsGenerating(true);
    try {
      await completeOnboarding();

      toast({
        title: 'Onboarding Complete!',
        description: 'Your strategy has been generated. Redirecting to strategy hub...',
      });

      // Navigate to client strategy page
      navigate(`/clients/${state.profile.client_id}`, { replace: true });
    } catch (error) {
      console.error('Failed to generate strategy:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete onboarding. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <StepLayout
      title={currentStep?.title ?? 'Review & Generate Strategy'}
      description="Review your answers and generate your content strategy"
      stepNumber={currentStep?.stepNumber ?? 20}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={false}
      isSaving={false}
      onBack={prevStep}
      onNext={() => {}}
      hideNextButton
    >
      <div className="space-y-8">
        {/* Readiness Summary */}
        <Card className={cn(
          'border-2',
          readiness.percentage >= 70 ? 'border-green-500/50 bg-green-500/5' :
          readiness.percentage >= 40 ? 'border-yellow-500/50 bg-yellow-500/5' :
          'border-destructive/50 bg-destructive/5'
        )}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Strategy Readiness</h3>
                <p className="text-sm text-muted-foreground">
                  {readinessLevel.description}
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold">{readiness.percentage}%</span>
                <p className="text-xs text-muted-foreground">{readinessLevel.label}</p>
              </div>
            </div>
            <Progress value={readiness.percentage} className="h-3" />

            {/* AI Assumptions warning */}
            {aiAssumptions > 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                {aiAssumptions} field{aiAssumptions > 1 ? 's' : ''} marked as "AI will decide"
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hard Blockers */}
        {blockers.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Required Fields Missing ({blockers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {blockers.map((blocker) => (
                  <div
                    key={blocker.field}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{blocker.message}</span>
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 6-Module Tile Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {moduleCompletions.map((module) => {
            const Icon = module.icon;

            return (
              <Card
                key={module.key}
                className={cn(
                  'transition-all duration-200',
                  module.isComplete
                    ? 'border-green-500/50 bg-green-500/5'
                    : module.completion > 0
                    ? 'border-yellow-500/30'
                    : ''
                )}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('p-2 rounded-lg', module.bgColor)}>
                      <Icon className={cn('h-5 w-5', module.color)} />
                    </div>
                    {module.isComplete ? (
                      <Badge className="bg-green-500 text-white gap-1">
                        <Check className="h-3 w-3" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {module.completion}%
                      </Badge>
                    )}
                  </div>

                  <h4 className="font-medium text-sm">{module.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {module.description}
                  </p>

                  {/* Mini progress bar */}
                  <Progress
                    value={module.completion}
                    className="h-1 mt-3"
                  />

                  {/* Missing fields */}
                  {module.missingFields.length > 0 && module.completion < 100 && (
                    <div className="mt-3 space-y-2">
                      {module.missingFields.map((field) => {
                        const meta = getMissingFieldMeta(field) ?? {
                          label: "Required information",
                          reason: "Complete this step to finish the strategy setup.",
                          ctaLabel: "Fix now",
                          href: "onboarding:start",
                        };

                        return (
                          <div
                            key={`${module.key}-${field}`}
                            className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-2 text-left"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-foreground">
                                {meta.label}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {meta.reason}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleFixNow(meta.href)}
                            >
                              {meta.ctaLabel || "Fix now"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Profile Quick Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Profile Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Business:</span>
                <p className="font-medium">{state.profile.q1_business_name || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Offer:</span>
                <p className="font-medium">{state.profile.q6_offer_name || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Customer:</span>
                <p className="font-medium">{state.profile.q8_ideal_customer || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Outcome:</span>
                <p className="font-medium">{state.profile.q10_desired_outcome || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Channels:</span>
                <p className="font-medium">
                  {state.profile.q16_enabled_channels?.length ?? 0} active
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Weekly Posts:</span>
                <p className="font-medium">
                  {state.profile.q18_cadence
                    ? Object.values(state.profile.q18_cadence as Record<string, number>).reduce(
                        (a, b) => a + b,
                        0
                      )
                    : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generate Strategy Button */}
        <div className="flex flex-col items-center gap-4 pt-4">
          <Button
            size="lg"
            onClick={handleGenerateStrategy}
            disabled={!canComplete || isGenerating}
            className="gap-2 px-8"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Strategy...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Strategy v1
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>

          {!canComplete && (
            <p className="text-sm text-muted-foreground text-center">
              Complete all required fields above to generate your strategy
            </p>
          )}

          {canComplete && !isGenerating && (
            <p className="text-sm text-muted-foreground text-center max-w-md">
              This will create your initial content strategy based on your answers.
              You can refine each module after generation.
            </p>
          )}
        </div>
      </div>
    </StepLayout>
  );
}
