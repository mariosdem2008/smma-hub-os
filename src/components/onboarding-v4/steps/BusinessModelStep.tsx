// ============================================================================
// Q7: Business Model Step
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { SingleSelectChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { BUSINESS_MODEL_OPTIONS } from '@/types/onboarding';

export function BusinessModelStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [businessModel, setBusinessModel] = useState(state.profile.q7_business_model ?? '');
  const [error, setError] = useState<string | undefined>();

  // Check if AI prefilled this
  const isPrefilled = state.profile.q7_provenance === 'ai_prefilled';

  // Sync local state with profile
  useEffect(() => {
    setBusinessModel(state.profile.q7_business_model ?? '');
  }, [state.profile.q7_business_model]);

  const validate = (): boolean => {
    if (!businessModel) {
      setError('Please select a business model');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q7_business_model: businessModel as 'b2b' | 'b2c' | 'both',
      q7_provenance: isPrefilled && businessModel === state.profile.q7_business_model
        ? 'ai_prefilled'
        : 'user_selected',
    });

    nextStep();
  };

  const handleChange = (value: string) => {
    setBusinessModel(value);
    if (error) setError(undefined);
  };

  const canProceed = !!businessModel;

  return (
    <StepLayout
      title={currentStep?.title ?? 'Who does this business sell to?'}
      description="Define the primary customer type"
      stepNumber={currentStep?.stepNumber ?? 8}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        <StepField
          label="Business Model"
          required
          error={error}
          hint={isPrefilled ? 'AI prefilled from scan - verify or change' : undefined}
        >
          <SingleSelectChips
            options={BUSINESS_MODEL_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            value={businessModel}
            onChange={handleChange}
          />
        </StepField>

        {/* Helper text for each option */}
        <div className="text-sm text-muted-foreground space-y-1">
          {businessModel === 'b2b' && (
            <p>
              <strong>B2B:</strong> Selling to other businesses, agencies, or professionals.
            </p>
          )}
          {businessModel === 'b2c' && (
            <p>
              <strong>B2C:</strong> Selling directly to consumers and individual customers.
            </p>
          )}
          {businessModel === 'both' && (
            <p>
              <strong>Both:</strong> Serving both business clients and individual consumers.
            </p>
          )}
        </div>
      </div>
    </StepLayout>
  );
}
