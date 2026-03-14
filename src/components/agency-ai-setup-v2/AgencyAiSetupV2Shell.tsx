import { Link, Outlet, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AGENCY_AI_SETUP_STAGES } from "@/lib/agency-ai-setup-v2/config";

export function AgencyAiSetupV2Shell({
  agencyName,
  readinessLabel,
}: {
  agencyName?: string | null;
  readinessLabel?: string | null;
}) {
  const location = useLocation();

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 p-6">
      <aside className="hidden w-80 shrink-0 lg:block">
        <Card className="border-border/60 bg-card/40">
          <CardContent className="space-y-5 p-5">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Agency AI Setup V2
              </div>
              <div className="text-lg font-semibold text-foreground">
                {agencyName || "Agency workspace"}
              </div>
              <div className="text-sm text-muted-foreground">
                Start by enabling one specialist capability, review imported context, and unlock agents progressively as trust becomes real.
              </div>
              {readinessLabel && <Badge variant="secondary">{readinessLabel}</Badge>}
            </div>

            <Separator />

            <nav className="space-y-1">
              {AGENCY_AI_SETUP_STAGES.map((stage) => {
                const active =
                  stage.path === "/agency/ai-setup"
                    ? location.pathname === stage.path
                    : location.pathname === stage.path || location.pathname.startsWith(`${stage.path}/`);

                return (
                  <Link
                    key={stage.key}
                    to={stage.path}
                    className={`block rounded-lg border px-3 py-3 transition-colors ${
                      active
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/50 bg-background/50 hover:bg-background/80"
                    }`}
                  >
                    <div className="text-sm font-medium text-foreground">{stage.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{stage.description}</div>
                  </Link>
                );
              })}
            </nav>

            <Separator />

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Recommended first path</div>
              <div>
                Enable <span className="font-medium text-foreground">Strategy AI</span> first, then expand into creator,
                operator, analyst, and client-facing workflows after certification.
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap gap-2 lg:hidden">
          {AGENCY_AI_SETUP_STAGES.map((stage) => (
            <Button
              key={stage.key}
              asChild
              size="sm"
              variant={location.pathname === stage.path || location.pathname.startsWith(`${stage.path}/`) ? "default" : "outline"}
            >
              <Link to={stage.path}>{stage.title}</Link>
            </Button>
          ))}
        </div>
        <Outlet />
      </div>
    </div>
  );
}
