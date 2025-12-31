// ============================================================================
// Q18: Cadence Step (HARD BLOCKER - per enabled channel)
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { Slider } from '@/components/ui/slider';
import { useOnboarding } from '../OnboardingContext';
import { CHANNEL_OPTIONS } from '@/types/onboarding';
import { AlertTriangle, Instagram, Youtube, Linkedin, Facebook } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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
  instagram: <Instagram className="h-5 w-5" />,
  tiktok: <TikTokIcon />,
  youtube_shorts: <Youtube className="h-5 w-5" />,
  linkedin: <Linkedin className="h-5 w-5" />,
  facebook: <Facebook className="h-5 w-5" />,
};

// Recommended cadences per platform
const recommendedCadence: Record<string, { min: number; ideal: number; max: number }> = {
  instagram: { min: 3, ideal: 7, max: 14 },
  tiktok: { min: 3, ideal: 7, max: 21 },
  youtube_shorts: { min: 2, ideal: 5, max: 14 },
  linkedin: { min: 2, ideal: 5, max: 7 },
  facebook: { min: 2, ideal: 5, max: 10 },
};

export function CadenceStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const enabledChannels = state.profile.q16_enabled_channels ?? [];

  const [cadence, setCadence] = useState<Record<string, number>>(
    (state.profile.q18_cadence as Record<string, number>) ??
      Object.fromEntries(enabledChannels.map((ch) => [ch, recommendedCadence[ch]?.ideal ?? 3]))
  );
  const [error, setError] = useState<string | undefined>();

  // Initialize cadence for new channels
  useEffect(() => {
    const newCadence = { ...cadence };
    let hasChanges = false;

    for (const channel of enabledChannels) {
      if (!(channel in newCadence)) {
        newCadence[channel] = recommendedCadence[channel]?.ideal ?? 3;
        hasChanges = true;
      }
    }

    // Remove channels that are no longer enabled
    for (const channel of Object.keys(newCadence)) {
      if (!enabledChannels.includes(channel)) {
        delete newCadence[channel];
        hasChanges = true;
      }
    }

    if (hasChanges) {
      setCadence(newCadence);
    }
  }, [enabledChannels]);

  const validate = (): boolean => {
    // Check that all enabled channels have cadence > 0
    const missingCadence = enabledChannels.filter((ch) => !cadence[ch] || cadence[ch] === 0);

    if (missingCadence.length > 0) {
      const channelNames = missingCadence
        .map((ch) => CHANNEL_OPTIONS.find((o) => o.id === ch)?.label)
        .join(', ');
      setError(`Please set a posting frequency for: ${channelNames}`);
      return false;
    }

    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q18_cadence: cadence,
      q18_provenance: 'user_selected',
    });

    nextStep();
  };

  const updateCadence = (channel: string, value: number) => {
    setCadence({ ...cadence, [channel]: value });
    if (error) setError(undefined);
  };

  // Check if all enabled channels have valid cadence
  const allChannelsHaveCadence = enabledChannels.every(
    (ch) => cadence[ch] && cadence[ch] > 0
  );
  const isHardBlocker = !allChannelsHaveCadence;
  const canProceed = allChannelsHaveCadence;

  // Calculate total posts per week
  const totalPostsPerWeek = Object.values(cadence).reduce((sum, val) => sum + val, 0);

  // Format frequency text
  const getFrequencyText = (postsPerWeek: number) => {
    if (postsPerWeek === 0) return 'No posts';
    if (postsPerWeek === 1) return '1 post/week';
    if (postsPerWeek <= 7) return `${postsPerWeek} posts/week`;
    if (postsPerWeek <= 14) return `${postsPerWeek} posts/week (${Math.round(postsPerWeek / 7 * 10) / 10}/day)`;
    return `${postsPerWeek} posts/week (${Math.round(postsPerWeek / 7)}/day)`;
  };

  if (enabledChannels.length === 0) {
    return (
      <StepLayout
        title={currentStep?.title ?? 'Set posting cadence'}
        description="No channels selected"
        stepNumber={currentStep?.stepNumber ?? 19}
        totalSteps={state.steps.length}
        canGoBack={true}
        canProceed={false}
        isSaving={state.isSaving}
        onBack={prevStep}
        onNext={() => {}}
      >
        <div className="p-6 text-center border-2 border-dashed rounded-lg bg-muted/20">
          <p className="text-muted-foreground">
            Please go back and select at least one channel to set posting frequency.
          </p>
        </div>
      </StepLayout>
    );
  }

  return (
    <StepLayout
      title={currentStep?.title ?? 'How often should we post per platform?'}
      description="Set the weekly posting frequency for each channel"
      stepNumber={currentStep?.stepNumber ?? 19}
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
              Each channel must have at least 1 post per week.
            </AlertDescription>
          </Alert>
        )}

        <StepField
          label="Posting Frequency"
          required
          error={error}
          hint={`Total: ${getFrequencyText(totalPostsPerWeek)}`}
        >
          <div className="space-y-6">
            {enabledChannels.map((channel) => {
              const opt = CHANNEL_OPTIONS.find((o) => o.id === channel);
              const rec = recommendedCadence[channel] ?? { min: 1, ideal: 3, max: 14 };
              const currentValue = cadence[channel] ?? rec.ideal;

              return (
                <div
                  key={channel}
                  className={cn(
                    'p-4 border rounded-lg bg-card space-y-4',
                    currentValue === 0 && 'border-destructive/50 bg-destructive/5'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-primary">{channelIcons[channel]}</span>
                      <span className="font-medium">{opt?.label}</span>
                    </div>
                    <span className="text-lg font-bold text-primary">
                      {currentValue} / week
                    </span>
                  </div>

                  <Slider
                    value={[currentValue]}
                    onValueChange={([value]) => updateCadence(channel, value)}
                    min={0}
                    max={14}
                    step={1}
                    className="w-full"
                  />

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span className="text-primary">Ideal: {rec.ideal}/week</span>
                    <span>14</span>
                  </div>
                </div>
              );
            })}
          </div>
        </StepField>

        {/* Summary */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total weekly content:</span>
            <span className="text-lg font-bold">
              {totalPostsPerWeek} post{totalPostsPerWeek !== 1 ? 's' : ''}/week
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            That's approximately {Math.round(totalPostsPerWeek * 4.33)} posts per month
          </p>
        </div>
      </div>
    </StepLayout>
  );
}
