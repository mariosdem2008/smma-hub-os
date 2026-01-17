import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSeedDefaultBrainPack } from "@/hooks/useSeedDefaultBrainPack";
import { cn } from "@/lib/utils";

export function QuickSetupBanner({
  agencyId,
  canRun,
  progress,
}: {
  agencyId: string;
  canRun: boolean;
  progress: { completed: number; total: number };
}) {
  const seedPack = useSeedDefaultBrainPack();
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);

  const title = useMemo(() => {
    if (progress.total > 0) return `Core setup: ${progress.completed}/${progress.total} complete`;
    return "Core setup";
  }, [progress.completed, progress.total]);

  const runQuickSetup = async () => {
    setIsRunning(true);
    setSteps(["Creating core settings…"]);
    try {
      const result = await seedPack.mutateAsync({ agencyId, mode: "seed_or_repair" });
      if (result.failed_ids.length > 0) {
        setSteps([
          "Created core settings.",
          `Some items failed to process (${result.failed_ids.length}).`,
          "Try “Retry processing” inside the module that shows an error.",
        ]);
      } else {
        setSteps(["✓ Setup complete."]);
      }
    } catch (e: any) {
      setSteps([`❌ Setup failed: ${e?.message ?? "Unknown error"}`]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-r from-primary/10 to-accent/10 p-6">
      <div className="flex items-start gap-4">
        <div className="mt-0.5">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Create safe defaults for all core AI settings. You can customize everything later.
          </p>

          {steps.length > 0 && (
            <div className="mt-4 space-y-1 text-sm">
              {steps.map((s, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "text-muted-foreground",
                    s.startsWith("✓") && "text-emerald-300",
                    s.startsWith("❌") && "text-red-300",
                  )}
                >
                  {s}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <Button onClick={runQuickSetup} disabled={!canRun || seedPack.isPending || isRunning}>
              {canRun ? "Set Up Core Settings Automatically →" : "Contact an admin to run setup"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

