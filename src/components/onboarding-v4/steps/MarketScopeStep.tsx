// ============================================================================
// Q3: Market Scope Step
// ============================================================================

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { StepLayout, StepField } from '../components/StepLayout';
import { SingleSelectChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { MARKET_SCOPE_OPTIONS } from '@/types/onboarding';

export function MarketScopeStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [scope, setScope] = useState(state.profile.q3_market_scope ?? '');
  const [country, setCountry] = useState(state.profile.q3_country ?? '');
  const [city, setCity] = useState(state.profile.q3_city ?? '');
  const [errors, setErrors] = useState<{ scope?: string; city?: string }>({});

  // Sync local state with profile
  useEffect(() => {
    setScope(state.profile.q3_market_scope ?? '');
    setCountry(state.profile.q3_country ?? '');
    setCity(state.profile.q3_city ?? '');
  }, [state.profile.q3_market_scope, state.profile.q3_country, state.profile.q3_city]);

  const validate = (): boolean => {
    const newErrors: { scope?: string; city?: string } = {};

    if (!scope) {
      newErrors.scope = 'Please select a market scope';
    }

    if (scope === 'local' && !city.trim()) {
      newErrors.city = 'City is required for local markets';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q3_market_scope: scope as 'local' | 'national' | 'international',
      q3_country: country.trim() || null,
      q3_city: city.trim() || null,
      q3_provenance: 'user_selected',
    });

    nextStep();
  };

  const handleScopeChange = (value: string) => {
    setScope(value);
    setErrors({});
    // Clear city if not local
    if (value !== 'local') {
      setCity('');
    }
  };

  const canProceed = !!scope && (scope !== 'local' || city.trim().length > 0);

  return (
    <StepLayout
      title={currentStep?.title ?? 'What is the market scope?'}
      description="Define the geographic reach of the business"
      stepNumber={currentStep?.stepNumber ?? 4}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        {/* Scope Selection */}
        <StepField
          label="Market Scope"
          required
          error={errors.scope}
        >
          <SingleSelectChips
            options={MARKET_SCOPE_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            value={scope}
            onChange={handleScopeChange}
          />
        </StepField>

        {/* Country (always visible for national/international) */}
        {(scope === 'national' || scope === 'international') && (
          <StepField
            label="Primary Country"
            hint="The main country of operation"
          >
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g., United States"
            />
          </StepField>
        )}

        {/* City (required for local) */}
        {scope === 'local' && (
          <>
            <StepField
              label="Country"
              hint="The country of operation"
            >
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g., United States"
              />
            </StepField>
            <StepField
              label="City / Region"
              required
              error={errors.city}
              hint="The local area served by this business"
            >
              <Input
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  if (errors.city) setErrors({});
                }}
                placeholder="e.g., Los Angeles, CA"
                autoFocus
              />
            </StepField>
          </>
        )}
      </div>
    </StepLayout>
  );
}
