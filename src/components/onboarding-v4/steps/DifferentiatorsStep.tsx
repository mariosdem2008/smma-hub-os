// ============================================================================
// Q13: Differentiators Step (AI suggestions)
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { MultiSelectChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { Badge } from '@/components/ui/badge';

// Default differentiator suggestions
const DEFAULT_DIFFERENTIATORS = [
  { id: 'ai', label: 'AI-powered solutions' },
  { id: 'wg', label: 'White-glove service' },
  { id: 'is', label: 'Industry specialization' },
  { id: 'fp', label: 'Faster delivery' },
  { id: 'lp', label: 'Lower pricing' },
  { id: 'pp', label: 'Premium quality' },
  { id: 'cs', label: 'Custom solutions' },
  { id: 'pr', label: 'Proven track record' },
];

export function DifferentiatorsStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [differentiators, setDifferentiators] = useState<string[]>(
    state.profile.q13_differentiators ?? []
  );
  const [error, setError] = useState<string | undefined>();
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [suggestions, setSuggestions] = useState(DEFAULT_DIFFERENTIATORS);

  // Sync local state with profile
  useEffect(() => {
    setDifferentiators(state.profile.q13_differentiators ?? []);
  }, [state.profile.q13_differentiators]);

  // Generate AI suggestions
  useEffect(() => {
    const generateSuggestions = async () => {
      setIsLoadingAi(true);
      try {
        // TODO: Call ai-onboarding-suggest edge function
        // For now, use scan results if available
        let newSuggestions = [...DEFAULT_DIFFERENTIATORS];

        if (state.aiScanResult?.extracted?.differentiators) {
          const scanDiffs = state.aiScanResult.extracted.differentiators.map((d, i) => ({
            id: `scan-${i}`,
            label: d,
          }));
          newSuggestions = [...scanDiffs, ...newSuggestions.slice(0, 4)];
        }

        setSuggestions(newSuggestions.slice(0, 10));
      } catch (err) {
        console.error('Failed to generate suggestions:', err);
      } finally {
        setIsLoadingAi(false);
      }
    };

    generateSuggestions();
  }, [state.aiScanResult]);

  const validate = (): boolean => {
    if (differentiators.length < 2) {
      setError('Please select at least 2 differentiators');
      return false;
    }
    if (differentiators.length > 4) {
      setError('Please select no more than 4 differentiators');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q13_differentiators: differentiators,
      q13_provenance: 'user_selected',
    });

    nextStep();
  };

  const handleChange = (values: string[]) => {
    // Limit to 4 selections
    if (values.length > 4) {
      values = values.slice(-4);
    }
    setDifferentiators(values);
    if (error && values.length >= 2 && values.length <= 4) {
      setError(undefined);
    }
  };

  const canProceed = differentiators.length >= 2 && differentiators.length <= 4;

  return (
    <StepLayout
      title={currentStep?.title ?? 'What makes this business different?'}
      description="Select 2-4 key differentiators"
      stepNumber={currentStep?.stepNumber ?? 14}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        <StepField
          label="Differentiators"
          required
          error={error}
          hint={`Select 2-4 differentiators (${differentiators.length}/4 selected)`}
        >
          <MultiSelectChips
            options={suggestions}
            values={differentiators}
            onChange={handleChange}
            minSelections={2}
            maxSelections={4}
            isLoading={isLoadingAi}
            allowCustom
            customPlaceholder="Add a custom differentiator"
          />
        </StepField>

        {/* Selected differentiators ranked */}
        {differentiators.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected differentiators (ranked by importance):</p>
            <div className="flex flex-wrap gap-2">
              {differentiators.map((diff, i) => (
                <Badge key={i} variant="default" className="text-sm">
                  {i + 1}. {diff}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              The first differentiator will be featured most prominently in positioning.
            </p>
          </div>
        )}
      </div>
    </StepLayout>
  );
}
