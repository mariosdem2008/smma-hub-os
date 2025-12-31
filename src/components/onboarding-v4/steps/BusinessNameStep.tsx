// ============================================================================
// Q1: Business Name Step
// ============================================================================

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { StepLayout, StepField } from '../components/StepLayout';
import { useOnboarding } from '../OnboardingContext';
import type { AnswerProvenance } from '@/types/onboarding';

export function BusinessNameStep() {
  const { state, updateField, nextStep, prevStep, getProgress, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();
  const [value, setValue] = useState(state.profile.q1_business_name ?? '');
  const [error, setError] = useState<string | null>(null);

  // Sync local state with profile
  useEffect(() => {
    setValue(state.profile.q1_business_name ?? '');
  }, [state.profile.q1_business_name]);

  const validate = (): boolean => {
    if (!value.trim()) {
      setError('Business name is required');
      return false;
    }
    if (value.trim().length < 2) {
      setError('Business name must be at least 2 characters');
      return false;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    const provenance: AnswerProvenance = state.profile.q1_provenance ?? 'user_typed';
    updateField('q1_business_name', value.trim(), provenance);
    nextStep();
  };

  const canProceed = value.trim().length >= 2;

  return (
    <StepLayout
      title={currentStep?.title ?? "What's the business name?"}
      description="Enter the official business or brand name"
      stepNumber={currentStep?.stepNumber ?? 1}
      totalSteps={state.steps.length}
      canGoBack={false}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onNext={handleNext}
    >
      <StepField
        label="Business Name"
        required
        error={error ?? undefined}
        hint="This will be used throughout your strategy"
      >
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="e.g., Acme Corporation"
          className="text-lg"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canProceed) {
              handleNext();
            }
          }}
        />
      </StepField>
    </StepLayout>
  );
}
