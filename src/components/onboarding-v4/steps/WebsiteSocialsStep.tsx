// ============================================================================
// Q2: Website + Social Links Step
// ============================================================================

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Globe, Instagram, Linkedin, Facebook } from 'lucide-react';
import { StepLayout, StepField, StepSection } from '../components/StepLayout';
import { useOnboarding } from '../OnboardingContext';
import { cn } from '@/lib/utils';

function isValidUrl(url: string): boolean {
  if (!url.trim()) return true; // Empty is valid for optional fields
  try {
    new URL(url.startsWith('http') ? url : `https://${url}`);
    return true;
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  if (!url.trim()) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

export function WebsiteSocialsStep() {
  const { state, updateProfile, nextStep, prevStep, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  const [website, setWebsite] = useState(state.profile.q2_website ?? '');
  const [socialLinks, setSocialLinks] = useState<string[]>(
    state.profile.q2_social_links ?? ['']
  );
  const [errors, setErrors] = useState<{ website?: string; socials?: string[] }>({});

  // Sync local state with profile
  useEffect(() => {
    setWebsite(state.profile.q2_website ?? '');
    setSocialLinks(state.profile.q2_social_links?.length ? state.profile.q2_social_links : ['']);
  }, [state.profile.q2_website, state.profile.q2_social_links]);

  const validate = (): boolean => {
    const newErrors: { website?: string; socials?: string[] } = {};

    if (!website.trim()) {
      newErrors.website = 'Website is required';
    } else if (!isValidUrl(website)) {
      newErrors.website = 'Please enter a valid URL';
    }

    const socialErrors: string[] = [];
    socialLinks.forEach((link, i) => {
      if (link.trim() && !isValidUrl(link)) {
        socialErrors[i] = 'Invalid URL or handle';
      }
    });
    if (socialErrors.some(Boolean)) {
      newErrors.socials = socialErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;

    const filteredSocials = socialLinks
      .map((s) => normalizeUrl(s.trim()))
      .filter(Boolean);

    updateProfile({
      q2_website: normalizeUrl(website.trim()),
      q2_social_links: filteredSocials.length > 0 ? filteredSocials : null,
      q2_provenance: 'user_typed',
    });

    nextStep();
  };

  const addSocialLink = () => {
    if (socialLinks.length < 3) {
      setSocialLinks([...socialLinks, '']);
    }
  };

  const removeSocialLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  };

  const updateSocialLink = (index: number, value: string) => {
    const updated = [...socialLinks];
    updated[index] = value;
    setSocialLinks(updated);
    // Clear error for this field
    if (errors.socials) {
      const newErrors = [...errors.socials];
      newErrors[index] = '';
      setErrors({ ...errors, socials: newErrors });
    }
  };

  const canProceed = website.trim().length > 0 && isValidUrl(website);

  return (
    <StepLayout
      title={currentStep?.title ?? 'Enter the website and top social profiles'}
      description="We'll analyze these to understand the business better"
      stepNumber={currentStep?.stepNumber ?? 2}
      totalSteps={state.steps.length}
      canGoBack={true}
      canProceed={canProceed}
      isSaving={state.isSaving}
      onBack={prevStep}
      onNext={handleNext}
    >
      <div className="space-y-6">
        {/* Website */}
        <StepField
          label="Website URL"
          required
          error={errors.website}
          hint="Enter the main business website"
        >
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={website}
              onChange={(e) => {
                setWebsite(e.target.value);
                setErrors({ ...errors, website: undefined });
              }}
              placeholder="example.com"
              className="pl-10"
              autoFocus
            />
          </div>
        </StepField>

        {/* Social Links */}
        <StepSection
          title="Social Profiles (optional)"
          description="Add up to 3 social media links or handles"
        >
          <div className="space-y-3">
            {socialLinks.map((link, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={link}
                  onChange={(e) => updateSocialLink(index, e.target.value)}
                  placeholder="instagram.com/handle or @handle"
                  className={cn(
                    errors.socials?.[index] && 'border-destructive'
                  )}
                />
                {socialLinks.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSocialLink(index)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}

            {socialLinks.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSocialLink}
                className="text-muted-foreground"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add social link
              </Button>
            )}
          </div>
        </StepSection>
      </div>
    </StepLayout>
  );
}
