// ============================================================================
// Q4: Languages Step
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { MultiSelectChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { LANGUAGE_OPTIONS } from '@/types/onboarding';

export function LanguagesStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [languages, setLanguages] = useState<string[]>(
    state.profile.q4_languages ?? ['en']
  );
  const [error, setError] = useState<string | undefined>();

  // Sync local state with profile
  useEffect(() => {
    setLanguages(state.profile.q4_languages?.length ? state.profile.q4_languages : ['en']);
  }, [state.profile.q4_languages]);

  const validate = (): boolean => {
    if (languages.length === 0) {
      setError('Please select at least one language');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q4_languages: languages,
      q4_provenance: 'user_selected',
    });

    nextStep();
  };

  const handleChange = (values: string[]) => {
    setLanguages(values);
    if (error && values.length > 0) {
      setError(undefined);
    }
  };

  const canProceed = languages.length > 0;

  return (
    <StepLayout
      title={currentStep?.title ?? 'What language(s) should content be in?'}
      description="Select all languages for content creation"
      stepNumber={currentStep?.stepNumber ?? 5}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        <StepField
          label="Content Languages"
          required
          error={error}
          hint="Select all languages you want content created in"
        >
          <MultiSelectChips
            options={LANGUAGE_OPTIONS.map((lang) => ({ id: lang.id, label: lang.label }))}
            values={languages}
            onChange={handleChange}
            minSelections={1}
            allowCustom
            customPlaceholder="Add another language"
          />
        </StepField>
      </div>
    </StepLayout>
  );
}
