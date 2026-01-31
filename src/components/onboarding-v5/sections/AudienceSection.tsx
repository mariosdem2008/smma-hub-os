import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AiSuggestionChips, MultiSelectChips, SingleSelectChips } from '@/components/onboarding-v5/components/AiSuggestionChips';
import type { OnboardingProfile } from '@/types/onboarding';
import {
  AUDIENCE_TYPE_OPTIONS,
  MAIN_OBJECTION_OPTIONS,
  SMMA_PAIN_POINT_OPTIONS,
} from '@/types/onboarding';
import { getFieldLabel } from '../lib/labels';

const DEFAULT_CUSTOMER_SUGGESTIONS = [
  'Local families',
  'Busy professionals',
  'Young professionals',
  'Small business owners',
  'Homeowners in the area',
  'Health-conscious locals',
  'New residents moving nearby',
  'Parents looking for convenience',
  'Decision-makers at SMEs',
  'Ecommerce shoppers',
];

function buildCustomerSuggestions(profile: Partial<OnboardingProfile>): string[] {
  const suggestions = [...DEFAULT_CUSTOMER_SUGGESTIONS];
  if (profile.industry_niche === 'restaurant_cafe') {
    suggestions.unshift('Foodies looking for local spots');
  }
  if (profile.industry_niche === 'gym_fitness_studio') {
    suggestions.unshift('Locals wanting fitness accountability');
  }
  if (profile.industry_niche === 'beauty_salon_barber') {
    suggestions.unshift('Clients seeking premium grooming');
  }
  if (profile.industry_niche === 'clinic_medical') {
    suggestions.unshift('Patients looking for trusted care');
  }
  if (profile.industry_niche === 'real_estate') {
    suggestions.unshift('Home buyers in the area');
  }
  if (profile.industry_niche === 'ecommerce_dtc') {
    suggestions.unshift('Online shoppers seeking value');
  }
  if (profile.industry_niche === 'saas_tech') {
    suggestions.unshift('Teams evaluating SaaS tools');
  }
  if (profile.audience_type === 'b2b_decision_makers') {
    suggestions.unshift('Business owners evaluating services');
  }
  return suggestions.slice(0, 12);
}

export function AudienceSection({
  profile,
  onFieldChange,
  missingFields,
  onFocusField,
  onNext,
  onBack,
}: {
  profile: Partial<OnboardingProfile>;
  onFieldChange: (updates: Partial<OnboardingProfile>) => void;
  missingFields: string[];
  onFocusField: (fieldKey: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>(DEFAULT_CUSTOMER_SUGGESTIONS);
  const missing = new Set(missingFields);
  const nextMissing = missingFields[0];
  const focusMap: Record<string, string> = {
    audience_type: 'audience_type',
    primary_customer: 'primary_customer',
    main_objection: 'main_objection',
    q9_pain_points: 'q9_pain_points',
  };

  const customerChips = useMemo(
    () => customerSuggestions.map((label, index) => ({ id: `cust-${index}`, label })),
    [customerSuggestions]
  );
  const painPointOptions = useMemo(
    () => SMMA_PAIN_POINT_OPTIONS.map((option) => ({ ...option, id: option.label })),
    []
  );

  const painPoints = profile.q9_pain_points ?? [];
  const customPainPoints = painPoints.filter((value) => !SMMA_PAIN_POINT_OPTIONS.some((opt) => opt.label === value));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Audience</h2>
        <p className="text-sm text-muted-foreground">Clarify who you serve and what they want to solve.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Audience profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Audience type</Label>
            <div data-field-key="audience_type" tabIndex={-1}>
              <SingleSelectChips
                options={AUDIENCE_TYPE_OPTIONS}
                selected={profile.audience_type ?? null}
                onSelect={(value) => onFieldChange({ audience_type: value as OnboardingProfile['audience_type'] })}
                className="grid gap-2"
              />
            </div>
            {missing.has('audience_type') && (
              <div className="text-xs text-muted-foreground">
                Example: Local consumers. Needed for targeting.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Primary customer</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setCustomerSuggestions(buildCustomerSuggestions(profile))}
              >
                Suggest for me
              </Button>
            </div>
            <div data-field-key="primary_customer" tabIndex={-1}>
              <AiSuggestionChips
                suggestions={customerChips}
                value={profile.primary_customer ?? null}
                onSelect={(values) => onFieldChange({ primary_customer: values[0] })}
                allowCustom
                allowNotSure={false}
                customPlaceholder="Write custom customer"
              />
            </div>
            {missing.has('primary_customer') && (
              <div className="text-xs text-muted-foreground">
                Example: Local families. Needed for positioning.
              </div>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Main objection</Label>
            <div data-field-key="main_objection" tabIndex={-1}>
              <SingleSelectChips
                options={MAIN_OBJECTION_OPTIONS}
                selected={profile.main_objection ?? null}
                onSelect={(value) => onFieldChange({ main_objection: value as OnboardingProfile['main_objection'] })}
                className="grid gap-2 md:grid-cols-2"
              />
            </div>
            {missing.has('main_objection') && (
              <div className="text-xs text-muted-foreground">
                Example: Price too high. Helps build objections content.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Pain points (pick 3)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Choose pain points</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onFieldChange({ q9_pain_points: SMMA_PAIN_POINT_OPTIONS.slice(0, 3).map((opt) => opt.label) })}
            >
              Suggest for me
            </Button>
          </div>
          <div data-field-key="q9_pain_points" tabIndex={-1}>
            <MultiSelectChips
              options={painPointOptions}
              values={painPoints}
              onChange={(values) => onFieldChange({ q9_pain_points: values.length ? values : null })}
              minSelections={3}
              maxSelections={3}
              allowCustom={customPainPoints.length < 1}
              customPlaceholder="Add custom pain point"
            />
          </div>
          {missing.has('q9_pain_points') && (
            <div className="text-xs text-muted-foreground">
              Example: Not enough customers/leads. Needed to build pillars.
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
            Next: Brand + Content
          </Button>
        </div>
      </div>
    </div>
  );
}
