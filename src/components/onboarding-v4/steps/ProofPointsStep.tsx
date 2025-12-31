// ============================================================================
// Q15: Proof Points Step (Dynamic table based on Q14)
// ============================================================================

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StepLayout, StepField } from '../components/StepLayout';
import { useOnboarding } from '../OnboardingContext';
import { Plus, X, Star, StarOff, Link as LinkIcon, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProofPoint {
  claim: string;
  evidence: string;
  confidence: number; // 1-5
}

export function ProofPointsStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const proofLevel = state.profile.q14_proof_level ?? 'none';
  const minRows = proofLevel === 'none' ? 0 : proofLevel === 'some' ? 1 : 3;

  const [proofPoints, setProofPoints] = useState<ProofPoint[]>(
    (state.profile.q15_proof_points as ProofPoint[]) ?? []
  );
  const [error, setError] = useState<string | undefined>();

  // Sync local state with profile
  useEffect(() => {
    const profilePoints = state.profile.q15_proof_points as ProofPoint[] | undefined;
    if (profilePoints?.length) {
      setProofPoints(profilePoints);
    } else if (minRows > 0 && proofPoints.length === 0) {
      // Initialize with empty rows based on minimum
      setProofPoints(
        Array.from({ length: minRows }, () => ({
          claim: '',
          evidence: '',
          confidence: 3,
        }))
      );
    }
  }, [state.profile.q15_proof_points, minRows]);

  const validate = (): boolean => {
    const filledPoints = proofPoints.filter((p) => p.claim.trim() && p.evidence.trim());

    if (filledPoints.length < minRows) {
      setError(`Please add at least ${minRows} proof point${minRows > 1 ? 's' : ''}`);
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    const validPoints = proofPoints.filter((p) => p.claim.trim() && p.evidence.trim());

    updateProfile({
      q15_proof_points: validPoints.length > 0 ? validPoints : null,
      q15_provenance: 'user_typed',
    });

    nextStep();
  };

  const updateProofPoint = (index: number, field: keyof ProofPoint, value: string | number) => {
    const updated = [...proofPoints];
    updated[index] = { ...updated[index], [field]: value };
    setProofPoints(updated);
  };

  const addProofPoint = () => {
    setProofPoints([...proofPoints, { claim: '', evidence: '', confidence: 3 }]);
  };

  const removeProofPoint = (index: number) => {
    if (proofPoints.length > minRows) {
      setProofPoints(proofPoints.filter((_, i) => i !== index));
    }
  };

  const filledCount = proofPoints.filter((p) => p.claim.trim() && p.evidence.trim()).length;
  const canProceed = filledCount >= minRows;

  // Skip message for "none" proof level
  if (proofLevel === 'none') {
    return (
      <StepLayout
        title={currentStep?.title ?? 'Add proof points'}
        description="No proof points required based on your selection"
        stepNumber={currentStep?.stepNumber ?? 16}
        totalSteps={state.steps.length}
        canGoBack={true}
        canProceed={true}
        isSaving={state.isSaving}
        onBack={prevStep}
        onNext={() => {
          updateProfile({
            q15_proof_points: null,
            q15_provenance: 'user_selected',
          });
          nextStep();
        }}
      >
        <div className="p-6 text-center border-2 border-dashed rounded-lg bg-muted/20">
          <p className="text-muted-foreground">
            Since you selected "No proof available," you can skip this step.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Come back later when you have testimonials or case studies to add.
          </p>
          <Button variant="outline" className="mt-4" onClick={addProofPoint}>
            <Plus className="h-4 w-4 mr-2" />
            Add proof point anyway
          </Button>
        </div>
      </StepLayout>
    );
  }

  return (
    <StepLayout
      title={currentStep?.title ?? 'Add proof points for claims'}
      description={`Add at least ${minRows} proof point${minRows > 1 ? 's' : ''} to support your claims`}
      stepNumber={currentStep?.stepNumber ?? 16}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        <StepField
          label={`Proof Points (${filledCount}/${minRows} minimum)`}
          required={minRows > 0}
          error={error}
        >
          <div className="space-y-4">
            {proofPoints.map((point, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg bg-card space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Proof Point {index + 1}</span>
                  {proofPoints.length > minRows && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProofPoint(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Claim */}
                  <StepField label="Claim" hint="What claim or result can you make?">
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={point.claim}
                        onChange={(e) => updateProofPoint(index, 'claim', e.target.value)}
                        placeholder="e.g., Increased revenue by 50%"
                        className="pl-10"
                      />
                    </div>
                  </StepField>

                  {/* Evidence */}
                  <StepField label="Evidence" hint="Link or description of proof">
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={point.evidence}
                        onChange={(e) => updateProofPoint(index, 'evidence', e.target.value)}
                        placeholder="https://... or 'Client testimonial from John Doe'"
                        className="pl-10"
                      />
                    </div>
                  </StepField>

                  {/* Confidence */}
                  <StepField label="Confidence Level">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => updateProofPoint(index, 'confidence', level)}
                          className={cn(
                            'p-1 rounded transition-colors',
                            level <= point.confidence
                              ? 'text-yellow-500'
                              : 'text-muted-foreground hover:text-yellow-400'
                          )}
                        >
                          {level <= point.confidence ? (
                            <Star className="h-6 w-6 fill-current" />
                          ) : (
                            <StarOff className="h-6 w-6" />
                          )}
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-muted-foreground">
                        {point.confidence === 5
                          ? 'Very strong'
                          : point.confidence === 4
                          ? 'Strong'
                          : point.confidence === 3
                          ? 'Moderate'
                          : point.confidence === 2
                          ? 'Weak'
                          : 'Very weak'}
                      </span>
                    </div>
                  </StepField>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addProofPoint}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add another proof point
            </Button>
          </div>
        </StepField>
      </div>
    </StepLayout>
  );
}
