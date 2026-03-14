import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AiWorkflowBlockState } from "@/lib/aiWorkflowBlock";

export function AiWorkflowBlockNotice({
  block,
  fallbackLink,
  fallbackLabel = "Open AI Setup",
  secondaryLink,
  secondaryLabel,
  onRetry,
}: {
  block: AiWorkflowBlockState;
  fallbackLink?: string;
  fallbackLabel?: string;
  secondaryLink?: string;
  secondaryLabel?: string;
  onRetry?: () => void;
}) {
  const primaryLink = block.deepLink ?? fallbackLink;
  const portalSupportNote = !block.hasAgencySession
    ? block.title === "Certification required"
      ? "Your agency needs to certify this AI workflow before it can be used in the client portal."
      : block.title === "Setup not ready"
        ? "Your agency still needs to finish setup before this AI workflow can be used here."
        : "Your agency needs to activate this AI workflow before it can be used in the client portal."
    : null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5 p-4">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{block.title}</p>
          <p className="text-sm text-muted-foreground">{block.message}</p>
          {block.note ? <p className="mt-1 text-xs text-muted-foreground">{block.note}</p> : null}
          {block.requiredMode ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Required rollout mode:{" "}
              <span className="font-medium text-foreground">{block.requiredMode.replace(/_/g, " ")}</span>
            </p>
          ) : null}
          {portalSupportNote ? <p className="mt-1 text-xs text-muted-foreground">{portalSupportNote}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {block.hasAgencySession && primaryLink ? (
            <Button asChild size="sm">
              <Link to={primaryLink}>{fallbackLabel}</Link>
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled>
              Contact your agency team
            </Button>
          )}

          {block.hasAgencySession && secondaryLink && secondaryLabel ? (
            <Button size="sm" variant="outline" asChild>
              <Link to={secondaryLink}>{secondaryLabel}</Link>
            </Button>
          ) : null}

          {onRetry ? (
            <Button size="sm" variant="ghost" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
