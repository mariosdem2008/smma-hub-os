import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MultiSelectChips } from '@/components/onboarding-v5/components/AiSuggestionChips';
import type { OnboardingProfile, V5ScanResult } from '@/types/onboarding';
import { INDUSTRY_NICHE_OPTIONS, MARKET_SCOPE_OPTIONS } from '@/types/onboarding';
import { getFieldLabel } from '../lib/labels';
import { cn } from '@/lib/utils';

const LANGUAGE_OPTIONS = [
  { id: 'english', label: 'English' },
  { id: 'greek', label: 'Greek' },
  { id: 'both', label: 'Both' },
  { id: 'other', label: 'Other' },
];

interface BasicsSectionProps {
  profile: Partial<OnboardingProfile>;
  scanResult: V5ScanResult | null;
  scanLoading: boolean;
  onScan: () => void;
  scanReviewOpen: boolean;
  onScanReviewOpenChange: (open: boolean) => void;
  onFieldChange: (updates: Partial<OnboardingProfile>) => void;
  missingFields: string[];
  onFocusField: (fieldKey: string) => void;
  onNext: () => void;
}

export function BasicsSection({
  profile,
  scanResult,
  scanLoading,
  onScan,
  scanReviewOpen,
  onScanReviewOpenChange,
  onFieldChange,
  missingFields,
  onFocusField,
  onNext,
}: BasicsSectionProps) {
  const socialLinks = [...(profile.q2_social_links ?? [])];
  while (socialLinks.length < 3) socialLinks.push('');
  const missing = new Set(missingFields);
  const hasWebsiteOrSocial =
    Boolean(profile.q2_website?.trim()) || socialLinks.some((value) => value.trim().length > 0);
  const nextMissing = missingFields[0];
  const focusMap: Record<string, string> = {
    q1_business_name: 'q1_business_name',
    industry_niche: 'industry_niche',
    q2_website_or_socials: 'q2_website',
    q3_market_scope: 'q3_market_scope',
    q3_geo: 'q3_country',
    q4_languages: 'q4_languages',
  };
  const isLocal = profile.q3_market_scope === 'local';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Basics</h2>
        <p className="text-sm text-muted-foreground">Set the core profile details.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Business essentials</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business name</Label>
            <Input
              id="business-name"
              value={profile.q1_business_name ?? ''}
              onChange={(event) => onFieldChange({ q1_business_name: event.target.value })}
              placeholder="e.g. Horizon Creative Studio"
              data-field-key="q1_business_name"
            />
            {missing.has('q1_business_name') && (
              <div className="text-xs text-muted-foreground">
                Example: Horizon Creative Studio. Used in strategy outputs.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Industry / niche</Label>
            <Select
              value={profile.industry_niche ?? ''}
              onValueChange={(value) => onFieldChange({ industry_niche: value as OnboardingProfile['industry_niche'] })}
            >
              <SelectTrigger data-field-key="industry_niche">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_NICHE_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {missing.has('industry_niche') && (
              <div className="text-xs text-muted-foreground">
                Example: Restaurant / Cafe. Helps personalize content ideas.
              </div>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="website-url">Website URL (optional)</Label>
            <Input
              id="website-url"
              value={profile.q2_website ?? ''}
              onChange={(event) => onFieldChange({ q2_website: event.target.value })}
              placeholder="https://example.com"
              data-field-key="q2_website"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Main social profile (required if no website)</Label>
            <Input
              value={socialLinks[0]}
              onChange={(event) => {
                const next = [...socialLinks];
                next[0] = event.target.value;
                const cleaned = next.map((value) => value.trim()).filter(Boolean);
                onFieldChange({ q2_social_links: cleaned.length > 0 ? cleaned : null });
              }}
              placeholder="https://instagram.com/..."
              data-field-key="q2_website_or_socials"
            />
            {missing.has('q2_website_or_socials') && (
              <div className="text-xs text-muted-foreground">
                Example: https://instagram.com/brand. Required to scan or tailor suggestions.
              </div>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Additional social profiles (optional)</Label>
            <div className="grid gap-2 md:grid-cols-2">
              {socialLinks.slice(1).map((link, index) => (
                <Input
                  key={`social-${index + 1}`}
                  value={link}
                  onChange={(event) => {
                    const next = [...socialLinks];
                    next[index + 1] = event.target.value;
                    const cleaned = next.map((value) => value.trim()).filter(Boolean);
                    onFieldChange({ q2_social_links: cleaned.length > 0 ? cleaned : null });
                  }}
                  placeholder="https://tiktok.com/@..."
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={cn('border-primary/40', hasWebsiteOrSocial ? 'bg-primary/5' : 'border-dashed')}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <div className="text-sm font-semibold">Scan website/profile</div>
            <div className="text-xs text-muted-foreground">Pull quick suggestions for offers and audience.</div>
          </div>
          <div className="flex items-center gap-2">
            {scanResult && (
              <Button type="button" variant="outline" onClick={() => onScanReviewOpenChange(!scanReviewOpen)}>
                Review suggestions
              </Button>
            )}
            <Button type="button" onClick={onScan} disabled={!hasWebsiteOrSocial || scanLoading}>
              {scanLoading ? 'Scanning.' : 'Scan website/profile (45s)'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Market scope</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select
              value={profile.q3_market_scope ?? ''}
              onValueChange={(value) => onFieldChange({ q3_market_scope: value as OnboardingProfile['q3_market_scope'] })}
            >
              <SelectTrigger data-field-key="q3_market_scope">
                <SelectValue placeholder="Select market scope" />
              </SelectTrigger>
              <SelectContent>
                {MARKET_SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {missing.has('q3_market_scope') && (
              <div className="text-xs text-muted-foreground">
                Example: Local. Used for location-focused content.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Country</Label>
            <Input
              value={profile.q3_country ?? ''}
              onChange={(event) => onFieldChange({ q3_country: event.target.value })}
              placeholder="United States"
              data-field-key="q3_country"
            />
            {missing.has('q3_geo') && isLocal && (
              <div className="text-xs text-muted-foreground">
                Example: United States. Required for local targeting.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>City/Region</Label>
            <Input
              value={profile.q3_city ?? ''}
              onChange={(event) => onFieldChange({ q3_city: event.target.value })}
              placeholder="Austin, TX"
              data-field-key="q3_city"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Language</CardTitle>
        </CardHeader>
        <CardContent>
          <div data-field-key="q4_languages" tabIndex={-1}>
            <MultiSelectChips
              options={LANGUAGE_OPTIONS}
              values={profile.q4_languages ?? []}
              onChange={(values) => onFieldChange({ q4_languages: values.length ? values : null })}
              minSelections={1}
              maxSelections={2}
            />
          </div>
          {missing.has('q4_languages') && (
            <div className="mt-2 text-xs text-muted-foreground">
              Example: English. Needed to align tone and copy.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
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
            Next: Goal
          </Button>
        </div>
      </div>
    </div>
  );
}
