// ============================================================================
// Q8: Ideal Customer Step (HARD BLOCKER with AI suggestions)
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { AiSuggestionChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Default suggestions (will be replaced by AI)
const DEFAULT_SUGGESTIONS = [
  { id: 'sbo', label: 'Small business owners' },
  { id: 'mm', label: 'Marketing managers' },
  { id: 'sf', label: 'Startup founders' },
  { id: 'eco', label: 'E-commerce brand owners' },
  { id: 'edm', label: 'Enterprise decision makers' },
  { id: 'fc', label: 'Freelance consultants' },
  { id: 'ceo', label: 'CEOs and executives' },
];

export function IdealCustomerStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [customer, setCustomer] = useState(state.profile.q8_ideal_customer ?? '');
  const [provenance, setProvenance] = useState(state.profile.q8_provenance ?? 'user_selected');
  const [error, setError] = useState<string | undefined>();
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(DEFAULT_SUGGESTIONS);

  // Sync local state with profile
  useEffect(() => {
    setCustomer(state.profile.q8_ideal_customer ?? '');
  }, [state.profile.q8_ideal_customer]);

  // Generate AI suggestions based on prior answers
  useEffect(() => {
    const generateSuggestions = async () => {
      // Only generate if we have enough context
      if (!state.profile.q5_offer_type && !state.profile.q7_business_model) {
        return;
      }

      setIsLoadingAi(true);
      try {
        // TODO: Call ai-onboarding-suggest edge function
        // For now, customize based on business model
        let suggestions = [...DEFAULT_SUGGESTIONS];

        if (state.profile.q7_business_model === 'b2b') {
          suggestions = [
            { id: 'sbo', label: 'Small business owners' },
            { id: 'mm', label: 'Marketing managers' },
            { id: 'sf', label: 'Startup founders' },
            { id: 'ceo', label: 'CEOs and executives' },
            { id: 'ops', label: 'Operations managers' },
            { id: 'hr', label: 'HR directors' },
          ];
        } else if (state.profile.q7_business_model === 'b2c') {
          suggestions = [
            { id: 'yp', label: 'Young professionals (25-35)' },
            { id: 'par', label: 'Parents with children' },
            { id: 'hn', label: 'High-net-worth individuals' },
            { id: 'hc', label: 'Health-conscious consumers' },
            { id: 'te', label: 'Tech enthusiasts' },
            { id: 'eco', label: 'Eco-conscious shoppers' },
          ];
        }

        // Add from AI scan if available
        if (state.aiScanResult?.extracted?.audience) {
          const scanAudience = state.aiScanResult.extracted.audience.map((a, i) => ({
            id: `scan-${i}`,
            label: a,
          }));
          suggestions = [...scanAudience, ...suggestions.slice(0, 4)];
        }

        setAiSuggestions(suggestions.slice(0, 8));
      } catch (err) {
        console.error('Failed to generate suggestions:', err);
      } finally {
        setIsLoadingAi(false);
      }
    };

    generateSuggestions();
  }, [state.profile.q5_offer_type, state.profile.q7_business_model, state.aiScanResult]);

  const validate = (): boolean => {
    if (!customer.trim()) {
      setError('Ideal customer is required');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q8_ideal_customer: customer.trim(),
      q8_provenance: provenance,
    });

    nextStep();
  };

  const handleSelect = (values: string[], prov: 'user_selected' | 'user_typed' | 'ai_assumed') => {
    setCustomer(values[0] ?? '');
    setProvenance(prov);
    if (error) setError(undefined);
  };

  const isHardBlocker = !customer.trim();
  const canProceed = customer.trim().length > 0;

  return (
    <StepLayout
      title={currentStep?.title ?? 'Who is the ideal customer?'}
      description="Define the target audience for content"
      stepNumber={currentStep?.stepNumber ?? 9}
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
          label="Ideal Customer Profile"
          required
          error={error}
          hint="Select from AI suggestions or describe in your own words"
        >
          <AiSuggestionChips
            suggestions={aiSuggestions}
            selected={customer ? [customer] : []}
            onSelect={handleSelect}
            isLoading={isLoadingAi}
            allowCustom
            customPlaceholder="Describe your ideal customer"
            allowNotSure
            notSureLabel="Let AI decide based on context"
          />
        </StepField>

        {/* Show provenance indicator */}
        {customer && provenance === 'ai_assumed' && (
          <p className="text-sm text-yellow-600">
            ⚠️ AI will determine the best customer profile based on other answers
          </p>
        )}
      </div>
    </StepLayout>
  );
}

