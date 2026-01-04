import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AiSuggestionChips, MultiSelectChips } from '@/components/onboarding-v4/components/AiSuggestionChips';
import type { OnboardingProfile } from '@/types/onboarding';
import { PROOF_TYPE_OPTIONS } from '@/types/onboarding';
import { getFieldLabel } from '../lib/labels';

const DIFFERENTIATOR_OPTIONS = [
  { id: 'location_convenience', label: 'Better location / convenience' },
  { id: 'faster_turnaround', label: 'Faster turnaround' },
  { id: 'better_pricing', label: 'Better pricing / value' },
  { id: 'higher_quality', label: 'Higher quality materials' },
  { id: 'unique_method', label: 'Unique method / expertise' },
  { id: 'better_guarantee', label: 'Better guarantee' },
  { id: 'better_results', label: 'Better results proof' },
  { id: 'better_experience', label: 'Better experience / hospitality' },
  { id: 'larger_selection', label: 'Larger selection' },
  { id: 'local_authority', label: 'Local authority / awards' },
  { id: 'other', label: 'Other (custom)' },
];

function buildDifferentiatorSuggestions(profile: Partial<OnboardingProfile>): string[] {
  const base = DIFFERENTIATOR_OPTIONS.map((option) => option.label);
  if (profile.industry_niche === 'real_estate') {
    base.unshift('Local market expertise');
  }
  if (profile.industry_niche === 'clinic_medical') {
    base.unshift('Trusted patient outcomes');
  }
  return base.slice(0, 10);
}

interface ProofSectionProps {
  profile: Partial<OnboardingProfile>;
  onFieldChange: (updates: Partial<OnboardingProfile>) => void;
  missingFields: string[];
  onFocusField: (fieldKey: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ProofSection({ profile, onFieldChange, missingFields, onFocusField, onNext, onBack }: ProofSectionProps) {
  const missing = new Set(missingFields);
  const nextMissing = missingFields[0];
  const focusMap: Record<string, string> = {
    proof_types: 'proof_types',
    competitor_link: 'competitor_link',
    q13_differentiators: 'q13_differentiators',
  };

  const differentiators = profile.q13_differentiators ?? [];
  const [showDetails, setShowDetails] = useState(() => differentiators.length > 0);
  const [suggestions, setSuggestions] = useState<string[]>(() => buildDifferentiatorSuggestions(profile));
  const chips = useMemo(
    () => suggestions.map((label, index) => ({ id: `diff-${index}`, label })),
    [suggestions]
  );

  const handleDifferentiatorSelect = (values: string[]) => {
    const trimmed = values.map((value) => value.trim()).filter(Boolean);
    onFieldChange({ q13_differentiators: trimmed.length ? trimmed : null });
  };

  const handleDifferentiatorDrag = (result: DropResult) => {
    if (!result.destination) return;
    const next = [...differentiators];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onFieldChange({ q13_differentiators: next });
  };

  const handleProofTypesChange = (values: string[]) => {
    if (values.includes('none')) {
      onFieldChange({ proof_types: ['none'] });
      return;
    }
    onFieldChange({ proof_types: values.length ? values : null });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Proof + Competitors</h2>
        <p className="text-sm text-muted-foreground">Capture proof assets and who you want to beat.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Proof you can show</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div data-field-key="proof_types" tabIndex={-1}>
            <MultiSelectChips
              options={PROOF_TYPE_OPTIONS}
              values={profile.proof_types ?? []}
              onChange={handleProofTypesChange}
              minSelections={1}
              maxSelections={6}
            />
          </div>
          {missing.has('proof_types') && (
            <div className="text-xs text-muted-foreground">
              Example: Reviews + Testimonials. Helps build trust content.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Competitor/account link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="competitor-link">1 competitor I want to beat (or account I admire)</Label>
          <Input
            id="competitor-link"
            value={profile.competitor_link ?? ''}
            onChange={(event) => onFieldChange({ competitor_link: event.target.value })}
            placeholder="https://instagram.com/competitor"
            data-field-key="competitor_link"
          />
          {missing.has('competitor_link') && (
            <div className="text-xs text-muted-foreground">
              Example: https://instagram.com/competitor. Used for benchmarking.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Details (optional)</CardTitle>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowDetails((current) => !current)}>
              {showDetails ? 'Hide details' : 'Add details'}
            </Button>
          </div>
        </CardHeader>
        {showDetails && (
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Client differentiators</Label>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSuggestions(buildDifferentiatorSuggestions(profile))}>
                Suggest for me
              </Button>
            </div>
            <AiSuggestionChips
              suggestions={chips}
              selected={differentiators}
              onSelect={(values) => handleDifferentiatorSelect(values)}
              multiSelect
              minSelect={1}
              maxSelect={5}
              allowCustom
              allowNotSure={false}
              customPlaceholder="Write custom differentiator"
              className="pt-2"
            />
            <div data-field-key="q13_differentiators" tabIndex={-1} />
            {differentiators.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Rank your top 3 (optional)</div>
                <DragDropContext onDragEnd={handleDifferentiatorDrag}>
                  <Droppable droppableId="differentiators">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                        {differentiators.map((diff, index) => (
                          <Draggable key={`${diff}-${index}`} draggableId={`${diff}-${index}`} index={index}>
                            {(draggable) => (
                              <div
                                ref={draggable.innerRef}
                                {...draggable.draggableProps}
                                className={cn('flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2')}
                              >
                                <span {...draggable.dragHandleProps} className="text-muted-foreground">
                                  <GripVertical className="h-4 w-4" />
                                </span>
                                <div className="flex-1 text-sm">{diff}</div>
                                <Button type="button" size="icon" variant="ghost" onClick={() => handleDifferentiatorSelect(differentiators.filter((_, idx) => idx !== index))}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            )}
            {missing.has('q13_differentiators') && (
              <div className="text-xs text-muted-foreground">
                Example: Better pricing / value. Helps positioning.
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-col items-end gap-2">
          {missingFields.length > 0 && (
            <button
              type="button"
              onClick={() => onFocusField(focusMap[nextMissing] ?? nextMissing)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Add {getFieldLabel(nextMissing)} to continue.
            </button>
          )}
          <Button type="button" onClick={onNext} disabled={missingFields.length > 0}>
            Next: Channels
          </Button>
        </div>
      </div>
    </div>
  );
}
