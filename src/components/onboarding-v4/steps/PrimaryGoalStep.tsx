// ============================================================================
// Q17: Primary Goal Step
// ============================================================================

import { useState, useEffect } from 'react';
import { StepLayout, StepField } from '../components/StepLayout';
import { SingleSelectChips } from '../components/AiSuggestionChips';
import { useOnboarding } from '../OnboardingContext';
import { PRIMARY_GOAL_OPTIONS } from '@/types/onboarding';
import { Eye, Shield, Users, Target, ShoppingCart } from 'lucide-react';

// Goal icons map
const goalIcons: Record<string, React.ReactNode> = {
  discovery: <Eye className="h-5 w-5" />,
  trust: <Shield className="h-5 w-5" />,
  leads: <Target className="h-5 w-5" />,
  community: <Users className="h-5 w-5" />,
  sales: <ShoppingCart className="h-5 w-5" />,
};

// Goal descriptions
const goalDescriptions: Record<string, { title: string; description: string; tactics: string[] }> = {
  discovery: {
    title: 'Discovery & Awareness',
    description: 'Focus on reaching new audiences and building brand awareness.',
    tactics: [
      'Trend-based content',
      'Shareable/viral content',
      'Hashtag strategies',
      'Collaborations',
    ],
  },
  trust: {
    title: 'Trust & Authority',
    description: 'Establish expertise and credibility in the industry.',
    tactics: [
      'Educational content',
      'Case studies',
      'Thought leadership',
      'Client testimonials',
    ],
  },
  leads: {
    title: 'Lead Generation',
    description: 'Focus on capturing leads and building email lists.',
    tactics: [
      'Lead magnets',
      'Clear CTAs',
      'Landing page traffic',
      'DM strategies',
    ],
  },
  community: {
    title: 'Community Building',
    description: 'Create engaged followers who advocate for the brand.',
    tactics: [
      'Interactive content',
      'Q&A sessions',
      'User-generated content',
      'Behind-the-scenes',
    ],
  },
  sales: {
    title: 'Direct Sales',
    description: 'Drive immediate purchases and conversions.',
    tactics: [
      'Product showcases',
      'Limited offers',
      'Social commerce',
      'Review/unboxing content',
    ],
  },
};

export function PrimaryGoalStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [goal, setGoal] = useState(state.profile.q17_primary_goal ?? '');
  const [error, setError] = useState<string | undefined>();

  // Sync local state with profile
  useEffect(() => {
    setGoal(state.profile.q17_primary_goal ?? '');
  }, [state.profile.q17_primary_goal]);

  const validate = (): boolean => {
    if (!goal) {
      setError('Please select a primary goal');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    updateProfile({
      q17_primary_goal: goal as 'discovery' | 'trust' | 'leads' | 'community' | 'sales',
      q17_provenance: 'user_selected',
    });

    nextStep();
  };

  const handleChange = (value: string) => {
    setGoal(value);
    if (error) setError(undefined);
  };

  const canProceed = !!goal;
  const selectedGoal = goal ? goalDescriptions[goal] : null;

  // Enhanced options with icons
  const optionsWithIcons = PRIMARY_GOAL_OPTIONS.map((opt) => ({
    id: opt.id,
    label: opt.label,
    icon: goalIcons[opt.id],
  }));

  return (
    <StepLayout
      title={currentStep?.title ?? "What's the primary goal for social content?"}
      description="Choose the main objective for social media strategy"
      stepNumber={currentStep?.stepNumber ?? 18}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        <StepField
          label="Primary Goal"
          required
          error={error}
        >
          <SingleSelectChips
            options={optionsWithIcons}
            value={goal}
            onChange={handleChange}
          />
        </StepField>

        {/* Goal details */}
        {selectedGoal && (
          <div className="p-4 border rounded-lg bg-card space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {goalIcons[goal]}
              </div>
              <div>
                <h4 className="font-medium">{selectedGoal.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedGoal.description}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Recommended tactics:</p>
              <div className="grid grid-cols-2 gap-2">
                {selectedGoal.tactics.map((tactic, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {tactic}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Platform-specific hints */}
        {goal && state.profile.q16_enabled_channels?.length && (
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">Platform focus for "{PRIMARY_GOAL_OPTIONS.find((o) => o.id === goal)?.label}":</p>
            {state.profile.q16_enabled_channels.includes('instagram') && (
              <p>- <strong>Instagram:</strong> {goal === 'discovery' ? 'Reels & hashtags' : goal === 'trust' ? 'Carousels & guides' : goal === 'leads' ? 'Stories with CTAs' : goal === 'community' ? 'Lives & Q&A' : 'Shop & product tags'}</p>
            )}
            {state.profile.q16_enabled_channels.includes('linkedin') && (
              <p>- <strong>LinkedIn:</strong> {goal === 'discovery' ? 'Thought leadership posts' : goal === 'trust' ? 'Articles & case studies' : goal === 'leads' ? 'Lead gen forms' : goal === 'community' ? 'Groups & discussions' : 'Direct outreach'}</p>
            )}
            {state.profile.q16_enabled_channels.includes('tiktok') && (
              <p>- <strong>TikTok:</strong> {goal === 'discovery' ? 'Trending sounds & duets' : goal === 'trust' ? 'Educational content' : goal === 'leads' ? 'Link in bio CTAs' : goal === 'community' ? 'Stitches & comments' : 'TikTok Shop'}</p>
            )}
          </div>
        )}
      </div>
    </StepLayout>
  );
}


