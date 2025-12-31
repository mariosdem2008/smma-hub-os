// ============================================================================
// Live Preview Panel Component
// Shows draft positioning and pillars updating in real-time (agency flow)
// ============================================================================

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';
import { cn } from '@/lib/utils';

export function LivePreviewPanel() {
  const { state } = useOnboarding();
  const { profile } = state;

  // Compute draft positioning statement
  const positioning = useMemo(() => {
    const parts: string[] = [];

    if (profile.q8_ideal_customer) {
      parts.push(`We help ${profile.q8_ideal_customer}`);
    }

    if (profile.q10_desired_outcome) {
      parts.push(`achieve ${profile.q10_desired_outcome}`);
    }

    if (profile.q6_offer_name) {
      parts.push(`through ${profile.q6_offer_name}`);
    }

    if (profile.q13_differentiators?.[0]) {
      parts.push(`with ${profile.q13_differentiators[0]}`);
    }

    if (parts.length === 0) {
      return null;
    }

    return parts.join(' ');
  }, [profile.q8_ideal_customer, profile.q10_desired_outcome, profile.q6_offer_name, profile.q13_differentiators]);

  // Infer top 3 pillars from pain points + differentiators
  const pillars = useMemo(() => {
    const inferred: string[] = [];

    // Add from pain points (transform to content themes)
    if (profile.q9_pain_points?.length) {
      profile.q9_pain_points.slice(0, 2).forEach((pain) => {
        inferred.push(`Solving: ${pain}`);
      });
    }

    // Add from differentiators
    if (profile.q13_differentiators?.length) {
      profile.q13_differentiators.slice(0, 2).forEach((diff) => {
        inferred.push(diff);
      });
    }

    // Add offer focus if we have it
    if (profile.q6_offer_name && inferred.length < 3) {
      inferred.push(`${profile.q6_offer_name} focus`);
    }

    return inferred.slice(0, 3);
  }, [profile.q9_pain_points, profile.q13_differentiators, profile.q6_offer_name]);

  // Check if we have enough data to show preview
  const hasData = positioning || pillars.length > 0;

  if (!hasData) {
    return (
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Strategy Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Complete more questions to see a preview of your strategy...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Positioning */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Draft Positioning
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positioning ? (
            <p className="text-sm leading-relaxed">"{positioning}"</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Complete Q6-Q10 to generate positioning...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pillars */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Top Content Pillars</CardTitle>
        </CardHeader>
        <CardContent>
          {pillars.length > 0 ? (
            <div className="space-y-2">
              {pillars.map((pillar, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2"
                >
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    {i + 1}
                  </div>
                  <span className="text-sm">{pillar}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Complete Q9 and Q13 to infer pillars...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Business</span>
            <span className="font-medium">{profile.q1_business_name || '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Model</span>
            <span className="font-medium">
              {profile.q7_business_model?.toUpperCase() || '—'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Channels</span>
            <span className="font-medium">
              {profile.q16_enabled_channels?.length || 0} active
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Proof Level</span>
            <span className="font-medium capitalize">
              {profile.q14_proof_level || '—'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* AI assumptions indicator */}
      {state.blockers.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">
              Missing Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {state.blockers.slice(0, 3).map((blocker) => (
                <Badge key={blocker.field} variant="outline" className="text-xs">
                  {blocker.field.replace(/_/g, ' ').replace(/^q\d+\s/, '')}
                </Badge>
              ))}
              {state.blockers.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{state.blockers.length - 3} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
