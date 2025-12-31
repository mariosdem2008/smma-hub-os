// ============================================================================
// Q16: Enabled Channels Step (HARD BLOCKER)
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { MultiSelectChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { CHANNEL_OPTIONS } from '@/types/onboarding';
import { AlertTriangle, Instagram, Youtube, Linkedin, Facebook } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// TikTok icon (custom)
const TikTokIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-4 w-4"
  >
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
  </svg>
);

// Channel icons map
const channelIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  tiktok: <TikTokIcon />,
  youtube_shorts: <Youtube className="h-4 w-4" />,
  linkedin: <Linkedin className="h-4 w-4" />,
  facebook: <Facebook className="h-4 w-4" />,
};

export function EnabledChannelsStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [channels, setChannels] = useState<string[]>(
    state.profile.q16_enabled_channels ?? []
  );
  const [error, setError] = useState<string | undefined>();

  // Sync local state with profile
  useEffect(() => {
    setChannels(state.profile.q16_enabled_channels ?? []);
  }, [state.profile.q16_enabled_channels]);

  const validate = (): boolean => {
    if (channels.length === 0) {
      setError('Please select at least one channel');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q16_enabled_channels: channels,
      q16_provenance: 'user_selected',
    });

    nextStep();
  };

  const handleChange = (values: string[]) => {
    setChannels(values);
    if (error && values.length > 0) {
      setError(undefined);
    }
  };

  const isHardBlocker = channels.length === 0;
  const canProceed = channels.length > 0;

  // Enhanced options with icons
  const optionsWithIcons = CHANNEL_OPTIONS.map((opt) => ({
    id: opt.id,
    label: opt.label,
    icon: channelIcons[opt.id],
  }));

  return (
    <StepLayout
      title={currentStep?.title ?? 'Which social platforms will be active?'}
      description="Select all platforms where content will be published"
      stepNumber={currentStep?.stepNumber ?? 17}
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
              At least one channel is required to complete onboarding.
            </AlertDescription>
          </Alert>
        )}

        <StepField
          label="Social Channels"
          required
          error={error}
          hint={`${channels.length} channel${channels.length !== 1 ? 's' : ''} selected`}
        >
          <MultiSelectChips
            options={optionsWithIcons}
            values={channels}
            onChange={handleChange}
            minSelections={1}
          />
        </StepField>

        {/* Selected channels preview with recommendations */}
        {channels.length > 0 && (
          <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
            <p className="text-sm font-medium">Selected channels:</p>
            <div className="grid gap-2">
              {channels.map((channel) => {
                const opt = CHANNEL_OPTIONS.find((o) => o.id === channel);
                return (
                  <div
                    key={channel}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="text-primary">{channelIcons[channel]}</span>
                    <span className="font-medium">{opt?.label}</span>
                    <span className="text-muted-foreground">
                      {channel === 'instagram' && '— Best for visual content & stories'}
                      {channel === 'tiktok' && '— Best for short-form video & trends'}
                      {channel === 'youtube_shorts' && '— Best for evergreen short content'}
                      {channel === 'linkedin' && '— Best for B2B & professional content'}
                      {channel === 'facebook' && '— Best for community & groups'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </StepLayout>
  );
}
