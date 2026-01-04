import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { V5ScanResult } from '@/types/onboarding';
import { CONVERSION_PATH_OPTIONS, INDUSTRY_NICHE_OPTIONS, PLATFORM_OPTIONS } from '@/types/onboarding';
import { cn } from '@/lib/utils';

interface AIScanReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  scanResult: V5ScanResult | null;
  onApplyAll: () => void;
  onApplyField: (fieldKey: string) => void;
  fieldStatus: Record<string, { hasValue: boolean }>;
}

export function AIScanReviewDialog({
  open,
  onOpenChange,
  isLoading,
  scanResult,
  onApplyAll,
  onApplyField,
  fieldStatus,
}: AIScanReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review suggestions</DialogTitle>
          <DialogDescription>Apply any suggestions you want to keep.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {scanResult?.confidence != null && (
            <Badge variant="outline">{scanResult.confidence}% confidence</Badge>
          )}

          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {!isLoading && scanResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Suggestions
                </div>
                <Button type="button" size="sm" onClick={onApplyAll}>
                  Apply all
                </Button>
              </div>

              {[
                {
                  key: 'industry_niche',
                  label: 'Industry / niche',
                  value:
                    INDUSTRY_NICHE_OPTIONS.find((option) => option.id === scanResult.industry_niche)?.label ??
                    scanResult.industry_niche,
                },
                { key: 'offers', label: 'Offer ideas', value: scanResult.offer_ideas?.join(', ') },
                { key: 'primary_customer', label: 'Primary customer', value: scanResult.primary_customer?.join(', ') },
                { key: 'q9_pain_points', label: 'Pain points', value: scanResult.pain_points?.join(', ') },
                { key: 'q13_differentiators', label: 'Proof cues', value: scanResult.proof_cues?.join(', ') },
                {
                  key: 'platforms',
                  label: 'Recommended platforms',
                  value: scanResult.recommended_platforms
                    ?.map((value) => PLATFORM_OPTIONS.find((option) => option.id === value)?.label ?? value)
                    .join(', '),
                },
                {
                  key: 'conversion_path',
                  label: 'Conversion path',
                  value: CONVERSION_PATH_OPTIONS.find((option) => option.id === scanResult.conversion_path)?.label,
                },
              ].map((item) => (
                <div key={item.key} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">{item.label}</div>
                      <div className={cn('text-sm', item.value ? 'text-foreground' : 'text-muted-foreground')}>
                        {item.value || 'No suggestion'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onApplyField(item.key)}
                      disabled={!item.value}
                    >
                      {fieldStatus[item.key]?.hasValue ? 'Apply (overwrite)' : 'Apply'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && !scanResult && (
            <div className="text-sm text-muted-foreground">No scan results yet.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
