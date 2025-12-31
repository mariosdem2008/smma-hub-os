// ============================================================================
// Q6: Offer Details Step (HARD BLOCKER)
// ============================================================================

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { StepLayout, StepField, StepSection } from '../components/StepLayout';
import { SingleSelectChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { CTA_OPTIONS } from '@/types/onboarding';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function OfferDetailsStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [offerName, setOfferName] = useState(state.profile.q6_offer_name ?? '');
  const [priceMin, setPriceMin] = useState<string>(
    state.profile.q6_price_min?.toString() ?? ''
  );
  const [priceMax, setPriceMax] = useState<string>(
    state.profile.q6_price_max?.toString() ?? ''
  );
  const [mainCta, setMainCta] = useState(state.profile.q6_main_cta ?? '');
  const [errors, setErrors] = useState<{ offerName?: string; mainCta?: string }>({});

  // Sync local state with profile
  useEffect(() => {
    setOfferName(state.profile.q6_offer_name ?? '');
    setPriceMin(state.profile.q6_price_min?.toString() ?? '');
    setPriceMax(state.profile.q6_price_max?.toString() ?? '');
    setMainCta(state.profile.q6_main_cta ?? '');
  }, [
    state.profile.q6_offer_name,
    state.profile.q6_price_min,
    state.profile.q6_price_max,
    state.profile.q6_main_cta,
  ]);

  const validate = (): boolean => {
    const newErrors: { offerName?: string; mainCta?: string } = {};

    if (!offerName.trim()) {
      newErrors.offerName = 'Offer name is required';
    }

    if (!mainCta) {
      newErrors.mainCta = 'Main CTA is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q6_offer_name: offerName.trim(),
      q6_price_min: priceMin ? parseFloat(priceMin) : null,
      q6_price_max: priceMax ? parseFloat(priceMax) : null,
      q6_main_cta: mainCta,
      q6_provenance: 'user_typed',
    });

    nextStep();
  };

  const isHardBlocker = !offerName.trim() || !mainCta;
  const canProceed = offerName.trim().length > 0 && !!mainCta;

  return (
    <StepLayout
      title={currentStep?.title ?? 'Tell us about the main offer'}
      description="Define the primary offer and call-to-action"
      stepNumber={currentStep?.stepNumber ?? 7}
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
              This step is required to complete onboarding. Fill in all required fields.
            </AlertDescription>
          </Alert>
        )}

        {/* Offer Name */}
        <StepField
          label="Offer Name"
          required
          error={errors.offerName}
          hint="The name of the primary product or service"
        >
          <Input
            value={offerName}
            onChange={(e) => {
              setOfferName(e.target.value);
              if (errors.offerName) setErrors({ ...errors, offerName: undefined });
            }}
            placeholder="e.g., Social Media Management Package"
            autoFocus
          />
        </StepField>

        {/* Price Range */}
        <StepSection
          title="Price Range (optional)"
          description="Helps tailor content to the price point"
        >
          <div className="grid grid-cols-2 gap-4">
            <StepField label="Minimum">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="0"
                  className="pl-7"
                  min={0}
                />
              </div>
            </StepField>
            <StepField label="Maximum">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="10,000"
                  className="pl-7"
                  min={0}
                />
              </div>
            </StepField>
          </div>
        </StepSection>

        {/* Main CTA */}
        <StepField
          label="Main Call-to-Action"
          required
          error={errors.mainCta}
          hint="What should the audience do after seeing content?"
        >
          <SingleSelectChips
            options={CTA_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            value={mainCta}
            onChange={(value) => {
              setMainCta(value);
              if (errors.mainCta) setErrors({ ...errors, mainCta: undefined });
            }}
            allowCustom
            customPlaceholder="Other CTA"
          />
        </StepField>
      </div>
    </StepLayout>
  );
}
