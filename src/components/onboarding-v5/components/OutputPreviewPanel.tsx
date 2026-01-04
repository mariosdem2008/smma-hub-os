import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { OnboardingProfile, OnboardingV5Meta, V5ScanResult } from '@/types/onboarding';
import { mapProfileToPreview } from '../lib/previewMapper';
import { cn } from '@/lib/utils';

interface OutputPreviewPanelProps {
  profile: Partial<OnboardingProfile>;
  meta: OnboardingV5Meta | null | undefined;
  scan: V5ScanResult | null;
}

const PLACEHOLDERS = {
  positioning: 'Add primary customer to generate positioning.',
  pillars: 'Add 3 pain points to unlock pillars.',
  cta: 'Add a conversion path to complete this preview.',
  cadence: 'Select platforms and cadence to show weekly plan.',
};

export function OutputPreviewPanel({ profile, meta, scan }: OutputPreviewPanelProps) {
  const preview = mapProfileToPreview(profile, meta, scan);
  const visiblePillars = preview.pillars.filter((pillar) => pillar.line);
  const cadenceMissing = Object.keys(preview.cadence_snapshot).length === 0;
  let hint: string | null = null;

  if (!preview.positioning_sentence) {
    hint = PLACEHOLDERS.positioning;
  } else if (visiblePillars.length === 0) {
    hint = PLACEHOLDERS.pillars;
  } else if (!preview.cta) {
    hint = PLACEHOLDERS.cta;
  } else if (cadenceMissing) {
    hint = PLACEHOLDERS.cadence;
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Output Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Positioning</div>
            <p className={cn('mt-2 text-sm', preview.positioning_sentence ? 'text-foreground' : 'text-muted-foreground')}>
              {preview.positioning_sentence ?? (hint === PLACEHOLDERS.positioning ? hint : '')}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">3 Pillars</div>
            {visiblePillars.length > 0 ? (
              <div className="mt-2 space-y-2">
                {visiblePillars.map((pillar, index) => (
                  <div key={`${pillar.title ?? 'pillar'}-${index}`} className="rounded-lg border bg-muted/30 px-3 py-2">
                    <div className="text-xs font-medium text-muted-foreground">Pillar {index + 1}</div>
                    <div className={cn('text-sm', pillar.line ? 'text-foreground' : 'text-muted-foreground')}>
                      {pillar.line}
                    </div>
                  </div>
                ))}
              </div>
            ) : hint === PLACEHOLDERS.pillars ? (
              <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
            ) : null}
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Conversion + Cadence</div>
            <div className="mt-2 space-y-2">
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <div className="text-xs font-medium text-muted-foreground">Conversion path</div>
                <div className={cn('text-sm', preview.cta ? 'text-foreground' : 'text-muted-foreground')}>
                  {preview.cta ?? (hint === PLACEHOLDERS.cta ? hint : '')}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <div className="text-xs font-medium text-muted-foreground">Weekly cadence</div>
                {Object.keys(preview.cadence_snapshot).length > 0 ? (
                  <div className="mt-1 space-y-1 text-sm">
                    {Object.entries(preview.cadence_snapshot).map(([platform, value]) => (
                      <div key={platform} className="flex items-center justify-between">
                        <span className="capitalize text-muted-foreground">{platform.replace('_', ' ')}</span>
                        <span className="font-medium text-foreground">{value} / week</span>
                      </div>
                    ))}
                  </div>
                ) : hint === PLACEHOLDERS.cadence ? (
                  <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Confidence</div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{preview.confidence}% ready</span>
                <div className="flex items-center gap-2">
                  {preview.sources.map((source) => (
                    <Badge key={source} variant="outline" className="text-[10px] uppercase">
                      {source.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
              <Progress value={preview.confidence} className="mt-2 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
