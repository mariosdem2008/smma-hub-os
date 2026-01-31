import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MultiSelectChips, SingleSelectChips } from '@/components/onboarding-v5/components/AiSuggestionChips';
import type { OnboardingProfile } from '@/types/onboarding';
import {
  BRAND_VOICE_OPTIONS,
  CONTENT_STYLE_OPTIONS,
  ON_CAMERA_OPTIONS,
  ASSET_OPTIONS,
} from '@/types/onboarding';
import { getFieldLabel } from '../lib/labels';

interface BrandSectionProps {
  profile: Partial<OnboardingProfile>;
  onFieldChange: (updates: Partial<OnboardingProfile>) => void;
  missingFields: string[];
  onFocusField: (fieldKey: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BrandSection({ profile, onFieldChange, missingFields, onFocusField, onNext, onBack }: BrandSectionProps) {
  const missing = new Set(missingFields);
  const nextMissing = missingFields[0];
  const focusMap: Record<string, string> = {
    brand_voice: 'brand_voice',
    content_style: 'content_style',
    on_camera_availability: 'on_camera_availability',
    available_assets: 'available_assets',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Brand + Content</h2>
          <p className="text-sm text-muted-foreground">Set the voice, style, and content resources.</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const nextVoice = profile.brand_voice?.length ? profile.brand_voice : ['friendly', 'educational'];
            const nextStyle = profile.content_style?.length ? profile.content_style : ['educational_tips'];
            onFieldChange({ brand_voice: nextVoice, content_style: nextStyle });
          }}
        >
          Suggest for me
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Brand voice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div data-field-key="brand_voice" tabIndex={-1}>
            <MultiSelectChips
              options={BRAND_VOICE_OPTIONS}
              values={profile.brand_voice ?? []}
              onChange={(values) => onFieldChange({ brand_voice: values.length ? values : null })}
              minSelections={2}
              maxSelections={3}
            />
          </div>
          {missing.has('brand_voice') && (
            <div className="text-xs text-muted-foreground">
              Example: Friendly + Educational. Needed for tone.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Content style</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div data-field-key="content_style" tabIndex={-1}>
            <MultiSelectChips
              options={CONTENT_STYLE_OPTIONS}
              values={profile.content_style ?? []}
              onChange={(values) => onFieldChange({ content_style: values.length ? values : null })}
              minSelections={1}
              maxSelections={2}
            />
          </div>
          {missing.has('content_style') && (
            <div className="text-xs text-muted-foreground">
              Example: Educational tips. Shapes the content mix.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">On-camera availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div data-field-key="on_camera_availability" tabIndex={-1}>
            <SingleSelectChips
              options={ON_CAMERA_OPTIONS}
              selected={profile.on_camera_availability ?? null}
              onSelect={(value) =>
                onFieldChange({ on_camera_availability: value as OnboardingProfile['on_camera_availability'] })
              }
              className="grid gap-2 md:grid-cols-2"
            />
          </div>
          {missing.has('on_camera_availability') && (
            <div className="text-xs text-muted-foreground">
              Example: Yes (owner). Needed for content planning.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Available assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div data-field-key="available_assets" tabIndex={-1}>
            <MultiSelectChips
              options={ASSET_OPTIONS}
              values={profile.available_assets ?? []}
              onChange={(values) => onFieldChange({ available_assets: values.length ? values : null })}
              minSelections={1}
              maxSelections={6}
            />
          </div>
          {missing.has('available_assets') && (
            <div className="text-xs text-muted-foreground">
              Example: Photos + Logo/brand kit. Helps plan assets quickly.
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
            Next: Proof
          </Button>
        </div>
      </div>
    </div>
  );
}
