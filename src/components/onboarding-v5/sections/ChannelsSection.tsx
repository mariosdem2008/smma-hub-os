import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MultiSelectChips, SingleSelectChips } from '@/components/onboarding-v5/components/AiSuggestionChips';
import type { OnboardingProfile, SocialChannel } from '@/types/onboarding';
import { CADENCE_PRESET_OPTIONS, FORMAT_OPTIONS, PLATFORM_OPTIONS, RESPONSE_HANDLING_OPTIONS } from '@/types/onboarding';
import { getFieldLabel } from '../lib/labels';

interface ChannelsSectionProps {
  profile: Partial<OnboardingProfile>;
  onFieldChange: (updates: Partial<OnboardingProfile>) => void;
  missingFields: string[];
  onFocusField: (fieldKey: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const PRESET_CADENCE_MAP: Record<string, number> = {
  light: 3,
  standard: 5,
  aggressive: 8,
};

function suggestPlatforms(profile: Partial<OnboardingProfile>): SocialChannel[] {
  if (profile.industry_niche === 'ecommerce_dtc') {
    return ['instagram', 'tiktok', 'pinterest'];
  }
  if (profile.industry_niche === 'b2b_service' || profile.industry_niche === 'saas_tech') {
    return ['linkedin', 'youtube'];
  }
  if (profile.industry_niche === 'clinic_medical' || profile.industry_niche === 'home_services') {
    return ['google_business_profile', 'instagram', 'facebook'];
  }
  return ['instagram', 'tiktok'];
}

export function ChannelsSection({ profile, onFieldChange, missingFields, onFocusField, onNext, onBack }: ChannelsSectionProps) {
  const missing = new Set(missingFields);
  const nextMissing = missingFields[0];
  const focusMap: Record<string, string> = {
    platforms: 'platforms',
    formats: 'formats',
    cadence_requirement: 'cadence_preset',
  };

  const platforms = profile.platforms ?? profile.q16_enabled_channels ?? [];
  const formats = profile.formats ?? [];
  const cadencePreset = profile.cadence_preset ?? '';
  const cadencePerPlatform = profile.cadence_per_platform ?? profile.q18_cadence ?? {};

  const handlePlatformsChange = (values: string[]) => {
    const nextPlatforms = values as SocialChannel[];
    onFieldChange({
      platforms: nextPlatforms.length ? nextPlatforms : null,
      q16_enabled_channels: nextPlatforms.length ? nextPlatforms : null,
    });
  };

  const handleCadencePreset = (value: string) => {
    const presetValue = value as OnboardingProfile['cadence_preset'];
    if (!presetValue) return;
    const cadenceDefaults =
      presetValue === 'custom'
        ? cadencePerPlatform
        : (platforms ?? []).reduce((acc, channel) => {
            acc[channel] = PRESET_CADENCE_MAP[presetValue] ?? 3;
            return acc;
          }, {} as Record<SocialChannel, number>);

    onFieldChange({
      cadence_preset: presetValue,
      cadence_per_platform: cadenceDefaults,
      q18_cadence: cadenceDefaults,
    });
  };

  const updateCadence = (channel: SocialChannel, value: number) => {
    const next = { ...(cadencePerPlatform ?? {}), [channel]: value };
    onFieldChange({ cadence_per_platform: next, q18_cadence: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Channels + Cadence</h2>
        <p className="text-sm text-muted-foreground">Pick platforms, formats, and posting rhythm.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Platforms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Recommended platforms</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                const suggestions = suggestPlatforms(profile);
                handlePlatformsChange(suggestions);
              }}
            >
              Suggest for me
            </Button>
          </div>
          <div data-field-key="platforms" tabIndex={-1}>
            <MultiSelectChips
              options={PLATFORM_OPTIONS}
              values={platforms}
              onChange={handlePlatformsChange}
              minSelections={1}
              maxSelections={8}
            />
          </div>
          {missing.has('platforms') && (
            <div className="text-xs text-muted-foreground">
              Example: Instagram + TikTok. Needed for channel plan.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Content formats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Recommended formats</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onFieldChange({ formats: ['short_video', 'carousels'] })}
            >
              Suggest for me
            </Button>
          </div>
          <div data-field-key="formats" tabIndex={-1}>
            <MultiSelectChips
              options={FORMAT_OPTIONS}
              values={formats}
              onChange={(values) => onFieldChange({ formats: values.length ? values : null })}
              minSelections={1}
              maxSelections={5}
            />
          </div>
          {missing.has('formats') && (
            <div className="text-xs text-muted-foreground">
              Example: Short video + Carousels. Needed for content planning.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Cadence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div data-field-key="cadence_preset" tabIndex={-1}>
            <SingleSelectChips
              options={CADENCE_PRESET_OPTIONS}
              selected={cadencePreset || null}
              onSelect={(value) => handleCadencePreset(value)}
              className="grid gap-2 md:grid-cols-2"
            />
          </div>
          {missing.has('cadence_requirement') && (
            <div className="text-xs text-muted-foreground">
              Example: Standard (5/wk). Needed to set a weekly plan.
            </div>
          )}

          {cadencePreset === 'custom' && platforms.length > 0 && (
            <div className="space-y-2">
              {platforms.map((platform) => (
                <div key={platform} className="flex items-center justify-between gap-3">
                  <Label className="capitalize">{platform.replace('_', ' ')}</Label>
                  <Input
                    type="number"
                    value={cadencePerPlatform?.[platform] ?? ''}
                    onChange={(event) => updateCadence(platform, Number(event.target.value || 0))}
                    placeholder="Posts / week"
                    className="w-32"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Response handling (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <SingleSelectChips
            options={RESPONSE_HANDLING_OPTIONS}
            selected={profile.response_handling ?? null}
            onSelect={(value) => onFieldChange({ response_handling: value as OnboardingProfile['response_handling'] })}
            className="grid gap-2 md:grid-cols-2"
          />
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
            Next: Review
          </Button>
        </div>
      </div>
    </div>
  );
}
