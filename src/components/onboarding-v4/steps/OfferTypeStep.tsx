// ============================================================================
// Q5: Offer Type Step
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { SingleSelectChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { OFFER_TYPE_OPTIONS } from '@/types/onboarding';

export function OfferTypeStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [offerType, setOfferType] = useState(state.profile.q5_offer_type ?? '');
  const [error, setError] = useState<string | undefined>();

  // Sync local state with profile
  useEffect(() => {
    setOfferType(state.profile.q5_offer_type ?? '');
  }, [state.profile.q5_offer_type]);

  const validate = (): boolean => {
    if (!offerType) {
      setError('Please select an offer type');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q5_offer_type: offerType as 'service' | 'product' | 'subscription' | 'app' | 'other',
      q5_provenance: 'user_selected',
    });

    nextStep();
  };

  const handleChange = (value: string) => {
    setOfferType(value);
    if (error) setError(undefined);
  };

  const canProceed = !!offerType;

  return (
    <StepLayout
      title={currentStep?.title ?? 'What type of offer is this?'}
      description="Select the primary type of offer"
      stepNumber={currentStep?.stepNumber ?? 6}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        <StepField
          label="Offer Type"
          required
          error={error}
        >
          <SingleSelectChips
            options={OFFER_TYPE_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            value={offerType}
            onChange={handleChange}
            allowCustom
            customPlaceholder="Other (specify)"
          />
        </StepField>
      </div>
    </StepLayout>
  );
}
