// ============================================================================
// Q14: Proof Level Step
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { SingleSelectChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { PROOF_LEVEL_OPTIONS } from '@/types/onboarding';
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';

export function ProofLevelStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [proofLevel, setProofLevel] = useState(state.profile.q14_proof_level ?? '');
  const [error, setError] = useState<string | undefined>();

  // Sync local state with profile
  useEffect(() => {
    setProofLevel(state.profile.q14_proof_level ?? '');
  }, [state.profile.q14_proof_level]);

  const validate = (): boolean => {
    if (!proofLevel) {
      setError('Please select a proof level');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q14_proof_level: proofLevel as 'none' | 'some' | 'strong',
      q14_provenance: 'user_selected',
    });

    nextStep();
  };

  const handleChange = (value: string) => {
    setProofLevel(value);
    if (error) setError(undefined);
  };

  const canProceed = !!proofLevel;

  // Get icon and description for each level
  const getProofDetails = () => {
    switch (proofLevel) {
      case 'none':
        return {
          icon: <ShieldAlert className="h-8 w-8 text-destructive" />,
          title: 'No proof available yet',
          description:
            'The business is new or hasn\'t collected testimonials, case studies, or metrics yet.',
          implications: [
            'Content will focus on expertise and methodology',
            'Avoid making specific claims without evidence',
            'Consider gathering proof points soon',
          ],
        };
      case 'some':
        return {
          icon: <Shield className="h-8 w-8 text-yellow-500" />,
          title: 'Some proof available',
          description:
            'There are a few testimonials, case studies, or results that can be referenced.',
          implications: [
            'Content can include social proof strategically',
            'Use available testimonials in key content',
            'Some claims can be made with evidence',
          ],
        };
      case 'strong':
        return {
          icon: <ShieldCheck className="h-8 w-8 text-green-500" />,
          title: 'Strong proof available',
          description:
            'Multiple case studies, testimonials, metrics, and documented results exist.',
          implications: [
            'Content can lead with proof and results',
            'Make bold claims backed by evidence',
            'Use specific numbers and testimonials',
          ],
        };
      default:
        return null;
    }
  };

  const details = getProofDetails();

  return (
    <StepLayout
      title={currentStep?.title ?? 'How much proof/evidence is available?'}
      description="This helps us know what claims can be made in content"
      stepNumber={currentStep?.stepNumber ?? 15}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        <StepField
          label="Proof Level"
          required
          error={error}
        >
          <SingleSelectChips
            options={PROOF_LEVEL_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            value={proofLevel}
            onChange={handleChange}
          />
        </StepField>

        {/* Selected level details */}
        {details && (
          <div className="p-4 border rounded-lg bg-card space-y-4">
            <div className="flex items-start gap-4">
              {details.icon}
              <div>
                <h4 className="font-medium">{details.title}</h4>
                <p className="text-sm text-muted-foreground">{details.description}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">What this means for content:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {details.implications.map((imp, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {imp}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </StepLayout>
  );
}
