import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import type { OnboardingProfile } from '@/types/onboarding';
import { getV5ProgressSummary } from '../lib/progress';
import { getFieldLabel } from '../lib/labels';

interface ReviewSectionProps {
  profile: Partial<OnboardingProfile>;
  isGenerating: boolean;
  onGenerate: () => void;
  onBack: () => void;
  onNavigate: (sectionId: string, fieldKey?: string) => void;
}

export function ReviewSection({ profile, isGenerating, onGenerate, onBack, onNavigate }: ReviewSectionProps) {
  const progress = useMemo(() => getV5ProgressSummary(profile), [profile]);
  const missingFields = progress.missingFields.slice(0, 5);
  const canGenerate = missingFields.length === 0;

  const blockers = missingFields.map((field) => ({
    key: mapFocusField(field),
    label: getFieldLabel(field),
    section: mapFieldToSection(field),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Review</h2>
        <p className="text-sm text-muted-foreground">Confirm the essentials and generate the strategy.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Ready to generate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{progress.totalPercent}% complete</Badge>
            <span>{canGenerate ? 'All required items complete.' : 'Finish the items below.'}</span>
          </div>
          {!canGenerate && (
            <div className="flex flex-wrap gap-2">
              {blockers.map((item) => (
                <Button key={item.key} variant="outline" size="sm" onClick={() => onNavigate(item.section, item.key)}>
                  {item.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onGenerate} disabled={isGenerating || !canGenerate}>
          <Sparkles className="mr-2 h-4 w-4" />
          {isGenerating ? 'Generating.' : 'Generate Strategy'}
        </Button>
      </div>
    </div>
  );
}

function mapFieldToSection(field: string): string {
  if (['q1_business_name', 'industry_niche', 'q3_market_scope', 'q3_geo', 'q2_website_or_socials', 'q4_languages'].includes(field)) {
    return 'basics';
  }
  if (['primary_goal', 'conversion_path', 'conversion_link_required'].includes(field)) {
    return 'goal';
  }
  if (['offers'].includes(field)) {
    return 'offers';
  }
  if (['audience_type', 'primary_customer', 'main_objection', 'q9_pain_points'].includes(field)) {
    return 'audience';
  }
  if (['brand_voice', 'content_style', 'on_camera_availability', 'available_assets'].includes(field)) {
    return 'brand';
  }
  if (['proof_types', 'competitor_link', 'q13_differentiators'].includes(field)) {
    return 'proof';
  }
  if (['platforms', 'formats', 'cadence_requirement'].includes(field)) {
    return 'channels';
  }
  return 'basics';
}

function mapFocusField(field: string): string {
  if (field === 'conversion_link_required') return 'conversion_link';
  if (field === 'cadence_requirement') return 'cadence_preset';
  if (field === 'q3_geo') return 'q3_country';
  if (field === 'q2_website_or_socials') return 'q2_website';
  return field;
}
