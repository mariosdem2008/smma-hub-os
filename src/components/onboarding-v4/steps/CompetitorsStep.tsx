// ============================================================================
// Q12: Competitors Step (AI suggestions)
// ============================================================================

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StepLayout, StepField, StepSection } from '../components/StepLayout';
import { useOnboarding } from '../OnboardingContext';
import { Plus, X, Building2, Globe, AtSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Competitor {
  name: string;
  handle?: string;
  url?: string;
}

// Default competitor suggestions (will be replaced by AI)
const DEFAULT_SUGGESTIONS = [
  { name: 'Competitor A', handle: '@competitora' },
  { name: 'Competitor B', url: 'https://competitorb.com' },
  { name: 'Competitor C', handle: '@competitorc' },
];

export function CompetitorsStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [competitors, setCompetitors] = useState<Competitor[]>(
    (state.profile.q12_competitors as Competitor[]) ?? [{ name: '', handle: '', url: '' }]
  );
  const [suggestions, setSuggestions] = useState<Competitor[]>(DEFAULT_SUGGESTIONS);

  // Sync local state with profile
  useEffect(() => {
    const profileCompetitors = state.profile.q12_competitors as Competitor[] | undefined;
    if (profileCompetitors?.length) {
      setCompetitors(profileCompetitors);
    }
  }, [state.profile.q12_competitors]);

  // Load AI suggestions from scan
  useEffect(() => {
    if (state.aiScanResult?.extracted?.competitors) {
      setSuggestions(state.aiScanResult.extracted.competitors);
    }
  }, [state.aiScanResult]);

  const handleNext = () => {
    const validCompetitors = competitors.filter((c) => c.name.trim());

    updateProfile({
      q12_competitors: validCompetitors.length > 0 ? validCompetitors : null,
      q12_provenance: 'user_typed',
    });

    nextStep();
  };

  const updateCompetitor = (index: number, field: keyof Competitor, value: string) => {
    const updated = [...competitors];
    updated[index] = { ...updated[index], [field]: value };
    setCompetitors(updated);
  };

  const addCompetitor = () => {
    if (competitors.length < 3) {
      setCompetitors([...competitors, { name: '', handle: '', url: '' }]);
    }
  };

  const removeCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
  };

  const addSuggestion = (suggestion: Competitor) => {
    if (competitors.length >= 3) return;

    // Check if already added
    if (competitors.some((c) => c.name === suggestion.name)) return;

    const emptyIndex = competitors.findIndex((c) => !c.name.trim());
    if (emptyIndex >= 0) {
      const updated = [...competitors];
      updated[emptyIndex] = suggestion;
      setCompetitors(updated);
    } else {
      setCompetitors([...competitors, suggestion]);
    }
  };

  const filledCount = competitors.filter((c) => c.name.trim()).length;
  const canProceed = true; // Optional step

  return (
    <StepLayout
      title={currentStep?.title ?? 'Who are the main competitors?'}
      description="Add up to 3 competitors (optional but helpful)"
      stepNumber={currentStep?.stepNumber ?? 13}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <StepSection
            title="AI Suggestions"
            description="Click to add from detected competitors"
          >
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, i) => {
                const isAdded = competitors.some((c) => c.name === suggestion.name);
                return (
                  <Badge
                    key={i}
                    variant={isAdded ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer transition-colors',
                      !isAdded && 'hover:bg-primary/10'
                    )}
                    onClick={() => !isAdded && addSuggestion(suggestion)}
                  >
                    {suggestion.name}
                    {isAdded && <span className="ml-1">✓</span>}
                  </Badge>
                );
              })}
            </div>
          </StepSection>
        )}

        {/* Competitor Inputs */}
        <StepSection
          title={`Competitors (${filledCount}/3)`}
          description="Name and optionally their social handle or website"
        >
          <div className="space-y-4">
            {competitors.map((competitor, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg bg-card space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Competitor {index + 1}</span>
                  {competitors.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCompetitor(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3">
                  <StepField label="Name">
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={competitor.name}
                        onChange={(e) => updateCompetitor(index, 'name', e.target.value)}
                        placeholder="Competitor name"
                        className="pl-10"
                      />
                    </div>
                  </StepField>

                  <div className="grid grid-cols-2 gap-3">
                    <StepField label="Handle (optional)">
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={competitor.handle ?? ''}
                          onChange={(e) => updateCompetitor(index, 'handle', e.target.value)}
                          placeholder="@handle"
                          className="pl-10"
                        />
                      </div>
                    </StepField>
                    <StepField label="Website (optional)">
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={competitor.url ?? ''}
                          onChange={(e) => updateCompetitor(index, 'url', e.target.value)}
                          placeholder="https://..."
                          className="pl-10"
                        />
                      </div>
                    </StepField>
                  </div>
                </div>
              </div>
            ))}

            {competitors.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCompetitor}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add competitor
              </Button>
            )}
          </div>
        </StepSection>
      </div>
    </StepLayout>
  );
}
