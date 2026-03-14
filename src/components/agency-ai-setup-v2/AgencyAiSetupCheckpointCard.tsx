import { ArrowRight, FlaskConical } from "lucide-react";
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
}

export function AgencyAiSetupCheckpointCard({
  title,
  reliableNow,
  stillWeak,
  nextAction,
  previewPath,
  previewLabel,
}: AgencyAiSetupCheckpointCardProps) {
  return (
    <Card className="border-border/60 bg-card/40">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">Use this checkpoint before you move on. It should tell you what the AI can trust now and what still needs tightening.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Reliable now</div>
            <div className="mt-2 text-sm text-foreground">{reliableNow}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Still weak</div>
            <div className="mt-2 text-sm text-foreground">{stillWeak}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/60 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Best next step</div>
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
