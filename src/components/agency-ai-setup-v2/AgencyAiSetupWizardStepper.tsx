import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export type AgencyAiSetupWizardStep = {
  label: string;
  route: string;
  status: "done" | "current" | "upcoming";
};

export function AgencyAiSetupWizardStepper({
  steps,
  currentIndex,
  onBack,
  onNext,
  advancedLink,
}: {
  steps: AgencyAiSetupWizardStep[];
  currentIndex: number;
  onBack?: string | null;
  onNext?: string | null;
  advancedLink: string;
}) {
  const currentLabel = steps[currentIndex]?.label ?? "";

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="hidden items-center gap-3 md:flex">
        {steps.map((step, index) => {
          const isDone = step.status === "done";
          const isCurrent = step.status === "current";
          const body = (
            <div
              className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 ${
                isCurrent
                  ? "border-primary/40 bg-primary/10"
                  : isDone
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-border/60 bg-background/50 opacity-70"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isCurrent ? "bg-primary text-primary-foreground" : isDone ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <div className="min-w-0 text-sm font-medium text-foreground">{step.label}</div>
            </div>
          );

          return (
            <div key={step.route} className="flex min-w-0 flex-1 items-center gap-3">
              {isDone ? <Link to={step.route}>{body}</Link> : body}
              {index < steps.length - 1 ? <div className="h-px flex-1 bg-border/60" /> : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-3 md:hidden">
        <div className="text-sm font-medium text-foreground">
          Step {currentIndex + 1} of {steps.length}: {currentLabel}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" disabled={!onBack}>
            <Link to={onBack ?? "#"}>Back</Link>
          </Button>
          <Button asChild size="sm" disabled={!onNext}>
            <Link to={onNext ?? "#"}>Next</Link>
          </Button>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to={advancedLink}>Switch to advanced setup</Link>
        </Button>
      </div>
    </div>
  );
}
