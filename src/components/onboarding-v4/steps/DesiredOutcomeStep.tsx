// ============================================================================
// Q10: Desired Outcome Step (HARD BLOCKER with AI suggestions)
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { AiSuggestionChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Default outcome suggestions
const DEFAULT_OUTCOMES = [
  { id: 'mr', label: 'More revenue' },
  { id: 'ml', label: 'More leads' },
  { id: 'ba', label: 'Better brand awareness' },
  { id: 'mc', label: 'More customers' },
  { id: 'ts', label: 'Time savings' },
  { id: 'cl', label: 'Customer loyalty' },
  { id: 'me', label: 'Market expansion' },
  { id: 'ca', label: 'Competitive advantage' },
];

export function DesiredOutcomeStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [outcome, setOutcome] = useState(state.profile.q10_desired_outcome ?? '');
  const [provenance, setProvenance] = useState(state.profile.q10_provenance ?? 'user_selected');
  const [error, setError] = useState<string | undefined>();
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [suggestions, setSuggestions] = useState(DEFAULT_OUTCOMES);

  // Sync local state with profile
  useEffect(() => {
    setOutcome(state.profile.q10_desired_outcome ?? '');
  }, [state.profile.q10_desired_outcome]);

  // Generate AI suggestions based on pain points
  useEffect(() => {
    const generateSuggestions = async () => {
      if (!state.profile.q9_pain_points?.length) return;

      setIsLoadingAi(true);
      try {
        // TODO: Call ai-onboarding-suggest edge function
        // For now, infer outcomes from pain points
        const painToOutcome: Record<string, { id: string; label: string }> = {
          'Low engagement on social media': { id: 'he', label: 'Higher engagement rates' },
          'No clear content strategy': { id: 'cs', label: 'Clear content roadmap' },
          'Inconsistent posting schedule': { id: 'cp', label: 'Consistent publishing' },
          'No visible growth': { id: 'sg', label: 'Sustainable growth' },
          'Low quality leads': { id: 'ql', label: 'Quality leads' },
          'Too much competition': { id: 'sd', label: 'Stand out from competitors' },
          'No brand differentiation': { id: 'ub', label: 'Unique brand identity' },
          'Too time-consuming': { id: 'ts', label: 'Time savings' },
        };

        const inferredOutcomes = state.profile.q9_pain_points
          .map((pain) => painToOutcome[pain])
          .filter(Boolean);

        const combinedSuggestions = [
          ...inferredOutcomes,
          ...DEFAULT_OUTCOMES.filter(
            (d) => !inferredOutcomes.find((io) => io.id === d.id)
          ),
        ].slice(0, 8);

        setSuggestions(combinedSuggestions);
      } catch (err) {
        console.error('Failed to generate suggestions:', err);
      } finally {
        setIsLoadingAi(false);
      }
    };

    generateSuggestions();
  }, [state.profile.q9_pain_points]);

  const validate = (): boolean => {
    if (!outcome.trim()) {
      setError('Desired outcome is required');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q10_desired_outcome: outcome.trim(),
      q10_provenance: provenance,
    });

    nextStep();
  };

  const handleSelect = (values: string[], prov: 'user_selected' | 'user_typed' | 'ai_assumed') => {
    setOutcome(values[0] ?? '');
    setProvenance(prov);
    if (error) setError(undefined);
  };

  const isHardBlocker = !outcome.trim();
  const canProceed = outcome.trim().length > 0;

  return (
    <StepLayout
      title={currentStep?.title ?? "What's the #1 outcome customers want?"}
      description="The primary result customers are seeking"
      stepNumber={currentStep?.stepNumber ?? 11}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        {/* Hard blocker alert */}
        {isHardBlocker && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This step is required to complete onboarding.
            </AlertDescription>
          </Alert>
        )}

        <StepField
          label="Primary Desired Outcome"
          required
          error={error}
          hint="What transformation do customers want to achieve?"
        >
          <AiSuggestionChips
            suggestions={suggestions}
            selected={outcome ? [outcome] : []}
            onSelect={handleSelect}
            isLoading={isLoadingAi}
            allowCustom
            customPlaceholder="Describe the desired outcome"
            allowNotSure
            notSureLabel="Let AI determine based on pain points"
          />
        </StepField>

        {/* Show provenance indicator */}
        {outcome && provenance === 'ai_assumed' && (
          <p className="text-sm text-yellow-600">
            ⚠️ AI will determine the best outcome based on pain points
          </p>
        )}
      </div>
    </StepLayout>
  );
}

