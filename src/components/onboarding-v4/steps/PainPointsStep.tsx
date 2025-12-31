// ============================================================================
// Q9: Pain Points Step (AI suggestions)
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { MultiSelectChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { Badge } from '@/components/ui/badge';

// Default pain point suggestions
const DEFAULT_PAIN_POINTS = [
  { id: 'le', label: 'Low engagement on social media' },
  { id: 'ncs', label: 'No clear content strategy' },
  { id: 'ip', label: 'Inconsistent posting schedule' },
  { id: 'nvg', label: 'No visible growth' },
  { id: 'lq', label: 'Low quality leads' },
  { id: 'tc', label: 'Too much competition' },
  { id: 'nb', label: 'No brand differentiation' },
  { id: 'tt', label: 'Too time-consuming' },
];

export function PainPointsStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [painPoints, setPainPoints] = useState<string[]>(
    state.profile.q9_pain_points ?? []
  );
  const [error, setError] = useState<string | undefined>();
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [suggestions, setSuggestions] = useState(DEFAULT_PAIN_POINTS);

  // Sync local state with profile
  useEffect(() => {
    setPainPoints(state.profile.q9_pain_points ?? []);
  }, [state.profile.q9_pain_points]);

  // Generate AI suggestions
  useEffect(() => {
    const generateSuggestions = async () => {
      if (!state.profile.q8_ideal_customer) return;

      setIsLoadingAi(true);
      try {
        // TODO: Call ai-onboarding-suggest edge function
        // For now, use scan results if available
        let newSuggestions = [...DEFAULT_PAIN_POINTS];

        if (state.aiScanResult?.extracted?.pain_points) {
          const scanPains = state.aiScanResult.extracted.pain_points.map((p, i) => ({
            id: `scan-${i}`,
            label: p,
          }));
          newSuggestions = [...scanPains, ...newSuggestions.slice(0, 5)];
        }

        setSuggestions(newSuggestions.slice(0, 10));
      } catch (err) {
        console.error('Failed to generate suggestions:', err);
      } finally {
        setIsLoadingAi(false);
      }
    };

    generateSuggestions();
  }, [state.profile.q8_ideal_customer, state.aiScanResult]);

  const validate = (): boolean => {
    if (painPoints.length !== 3) {
      setError('Please select exactly 3 pain points');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q9_pain_points: painPoints,
      q9_provenance: 'user_selected',
    });

    nextStep();
  };

  const handleChange = (values: string[]) => {
    // Limit to 3 selections
    if (values.length > 3) {
      values = values.slice(-3);
    }
    setPainPoints(values);
    if (error && values.length === 3) {
      setError(undefined);
    }
  };

  const canProceed = painPoints.length === 3;

  return (
    <StepLayout
      title={currentStep?.title ?? 'What are the top pain points?'}
      description="Select exactly 3 pain points your audience faces"
      stepNumber={currentStep?.stepNumber ?? 10}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        <StepField
          label="Pain Points"
          required
          error={error}
          hint={`Select exactly 3 (${painPoints.length}/3 selected)`}
        >
          <MultiSelectChips
            options={suggestions}
            values={painPoints}
            onChange={handleChange}
            minSelections={3}
            maxSelections={3}
            isLoading={isLoadingAi}
            allowCustom
            customPlaceholder="Add a custom pain point"
          />
        </StepField>

        {/* Selected pain points preview */}
        {painPoints.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected pain points:</p>
            <div className="flex flex-wrap gap-2">
              {painPoints.map((pain, i) => (
                <Badge key={i} variant="default">
                  {i + 1}. {pain}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </StepLayout>
  );
}
