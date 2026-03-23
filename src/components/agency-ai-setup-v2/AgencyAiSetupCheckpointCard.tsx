import { ArrowRight, CheckCircle2, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AgencyAiSetupCheckpointCardProps {
  title: string;
  reliableNow: string;
  stillWeak: string;
  nextAction: string;
  previewPath: string;
  previewLabel: string;
  milestoneLabel?: string;
  updatedNote?: string;
}

export function AgencyAiSetupCheckpointCard({
  title,
  reliableNow,
  stillWeak,
  nextAction,
  previewPath,
  previewLabel,
  milestoneLabel,
  updatedNote,
}: AgencyAiSetupCheckpointCardProps) {
  return (
    <Card className="border-border/60 bg-card/40">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">Use this checkpoint before you move on. It should tell you what is solid, what still needs attention, and the clearest next move.</p>
            </div>
          </div>
          {milestoneLabel ? (
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-primary">
              {milestoneLabel}
            </div>
          ) : null}
        </div>
        {updatedNote ? (
          <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
            {updatedNote}
          </div>
        ) : null}
        {milestoneLabel ? (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
              <div>
                <div className="text-sm font-medium text-foreground">{milestoneLabel}</div>
                <div className="mt-1 text-sm text-muted-foreground">{reliableNow}</div>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to={previewPath}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">What&apos;s solid</div>
            <div className="mt-2 text-sm text-foreground">{reliableNow}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">What needs attention</div>
            <div className="mt-2 text-sm text-foreground">{stillWeak}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Recommended next</div>
            <div className="mt-2 text-sm text-foreground">{nextAction}</div>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to={previewPath}>
            {previewLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
