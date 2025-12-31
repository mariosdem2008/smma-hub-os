// ============================================================================
// Q11: Sales Cycle Step
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { SingleSelectChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { SALES_CYCLE_OPTIONS } from '@/types/onboarding';

export function SalesCycleStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [salesCycle, setSalesCycle] = useState(state.profile.q11_sales_cycle ?? '');
  const [error, setError] = useState<string | undefined>();

  // Sync local state with profile
  useEffect(() => {
    setSalesCycle(state.profile.q11_sales_cycle ?? '');
  }, [state.profile.q11_sales_cycle]);

  const validate = (): boolean => {
    if (!salesCycle) {
      setError('Please select a sales cycle length');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q11_sales_cycle: salesCycle as 'same_day' | '1_7_days' | '1_4_weeks' | '1_3_months' | '3_plus_months',
      q11_provenance: 'user_selected',
    });

    nextStep();
  };

  const handleChange = (value: string) => {
    setSalesCycle(value);
    if (error) setError(undefined);
  };

  const canProceed = !!salesCycle;

  // Helper descriptions for each option
  const getDescription = () => {
    switch (salesCycle) {
      case 'same_day':
        return 'Impulse purchases, low-ticket items, or quick consultations';
      case '1_7_days':
        return 'Simple services, small purchases, or quick decisions';
      case '1_4_weeks':
        return 'Medium-ticket items requiring some consideration';
      case '1_3_months':
        return 'High-ticket services or products with multiple stakeholders';
      case '3_plus_months':
        return 'Enterprise sales, major purchases, or complex B2B deals';
      default:
        return null;
    }
  };

  return (
    <StepLayout
      title={currentStep?.title ?? 'How long is the typical sales cycle?'}
      description="From first contact to closed deal"
      stepNumber={currentStep?.stepNumber ?? 12}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        <StepField
          label="Sales Cycle Length"
          required
          error={error}
        >
          <SingleSelectChips
            options={SALES_CYCLE_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            value={salesCycle}
            onChange={handleChange}
          />
        </StepField>

        {/* Description for selected option */}
        {salesCycle && (
          <p className="text-sm text-muted-foreground">
            {getDescription()}
          </p>
        )}

        {/* Content strategy hint */}
        {salesCycle && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm">
              <strong>Content tip:</strong>{' '}
              {salesCycle === 'same_day' || salesCycle === '1_7_days'
                ? 'Focus on urgency, clear CTAs, and immediate value propositions.'
                : salesCycle === '1_4_weeks'
                ? 'Balance educational content with clear next steps and trust-building.'
                : 'Prioritize thought leadership, case studies, and nurturing content.'}
            </p>
          </div>
        )}
      </div>
    </StepLayout>
  );
}
