import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OnboardingProfile, OnboardingV5Meta, V5ScanResult } from '@/types/onboarding';
import { mapProfileToPreview } from '../lib/previewMapper';
import { OutputPreviewPanel } from './OutputPreviewPanel';

interface RightRailProps {
  profile: Partial<OnboardingProfile>;
  meta: OnboardingV5Meta | null | undefined;
  scan: V5ScanResult | null;
  collapsed: boolean;
  onToggle: () => void;
}

const SNAPSHOT_PLACEHOLDERS = {
  positioning: 'Add primary customer to generate positioning.',
  cadence: 'Not set',
};

export function RightRail({ profile, meta, scan, collapsed, onToggle }: RightRailProps) {
  const preview = mapProfileToPreview(profile, meta, scan);
  const pillarCount = preview.pillars.filter((pillar) => pillar.line).length;
  const cadenceEntries = Object.entries(preview.cadence_snapshot).filter(([, value]) => (value ?? 0) > 0);
  const cadenceLine =
    cadenceEntries.length > 0 ? `${cadenceEntries[0][0].replace('_', ' ')}: ${cadenceEntries[0][1]} / wk` : SNAPSHOT_PLACEHOLDERS.cadence;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Strategy Preview
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Expand
            </>
          ) : (
            <>
              Collapse
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {collapsed ? (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Strategy Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Positioning</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {preview.positioning_sentence ?? SNAPSHOT_PLACEHOLDERS.positioning}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pillars</div>
              <div className="mt-1 text-sm text-muted-foreground">{pillarCount}/3</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cadence</div>
              <div className="mt-1 text-sm text-muted-foreground">{cadenceLine}</div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <OutputPreviewPanel profile={profile} meta={meta} scan={scan} />
      )}
    </div>
  );
}
