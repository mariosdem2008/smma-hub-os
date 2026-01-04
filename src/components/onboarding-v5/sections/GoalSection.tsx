import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SingleSelectChips } from '@/components/onboarding-v4/components/AiSuggestionChips';
import { Button } from '@/components/ui/button';
import type { OnboardingProfile } from '@/types/onboarding';
import { CONVERSION_PATH_OPTIONS, ONBOARDING_PRIMARY_GOAL_OPTIONS } from '@/types/onboarding';
import { getFieldLabel } from '../lib/labels';

interface GoalSectionProps {
  profile: Partial<OnboardingProfile>;
  onFieldChange: (updates: Partial<OnboardingProfile>) => void;
  missingFields: string[];
  onFocusField: (fieldKey: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function GoalSection({ profile, onFieldChange, missingFields, onFocusField, onNext, onBack }: GoalSectionProps) {
  const missing = new Set(missingFields);
  const nextMissing = missingFields[0];
  const focusMap: Record<string, string> = {
    primary_goal: 'primary_goal',
    conversion_path: 'conversion_path',
    conversion_link_required: 'conversion_link',
  };
  const conversionPath = profile.conversion_path ?? '';
  const requiresLink = ['book_call', 'book_appointment', 'website_checkout'].includes(conversionPath);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Goal + Conversion</h2>
        <p className="text-sm text-muted-foreground">Define the primary outcome and conversion path.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Primary goal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div data-field-key="primary_goal" tabIndex={-1}>
            <SingleSelectChips
              options={ONBOARDING_PRIMARY_GOAL_OPTIONS}
              selected={profile.primary_goal ?? null}
              onSelect={(value) => onFieldChange({ primary_goal: value as OnboardingProfile['primary_goal'] })}
              className="grid gap-2 md:grid-cols-2"
            />
          </div>
          {missing.has('primary_goal') && (
            <div className="text-xs text-muted-foreground">
              Example: More bookings/appointments. Needed to shape the plan.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Conversion path</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div data-field-key="conversion_path" tabIndex={-1}>
            <SingleSelectChips
              options={CONVERSION_PATH_OPTIONS}
              selected={conversionPath || null}
              onSelect={(value) => onFieldChange({ conversion_path: value as OnboardingProfile['conversion_path'] })}
              className="grid gap-2 md:grid-cols-2"
            />
          </div>
          {missing.has('conversion_path') && (
            <div className="text-xs text-muted-foreground">
              Example: Book appointment. Needed to align CTA and offers.
            </div>
          )}

          {requiresLink && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="conversion-link">Conversion link</Label>
              <Input
                id="conversion-link"
                value={profile.conversion_link ?? ''}
                onChange={(event) => onFieldChange({ conversion_link: event.target.value })}
                placeholder="https://calendly.com/..."
                data-field-key="conversion_link"
              />
              {missing.has('conversion_link_required') && (
                <div className="text-xs text-muted-foreground">
                  Example: https://calendly.com/brand. Required for this conversion path.
                </div>
              )}
            </div>
          )}
        </CardContent>
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
            Next: Offers
          </Button>
        </div>
      </div>
    </div>
  );
}
