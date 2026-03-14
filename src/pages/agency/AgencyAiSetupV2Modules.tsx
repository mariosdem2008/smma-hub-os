import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileText, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgency } from "@/hooks/useAgency";
import { useRole } from "@/hooks/useRole";
import { useTouchAgencyAiSetupStatusV2 } from "@/hooks/useAgencyAiSetupV2";
import {
  useEnsureAgencyOperatingModuleDraftV2,
  useLatestAgencyOperatingModulesV2,
} from "@/hooks/useAgencyOperatingModulesV2";
import { AGENCY_AI_SETUP_CORE_MODULES, assessAgencyAiSetupModuleContent } from "@/lib/agency-ai-setup-v2/modules";

function formatStatus(status: string | null | undefined) {
  switch (status) {
    case "approved":
      return "Approved";
    case "review":
      return "In Review";
    case "draft":
      return "Draft";
    case "archived":
      return "Archived";
    default:
      return "Not Started";
  }
}

export default function AgencyAiSetupV2Modules() {
  const { agencyId } = useAgency();
  const { canEditContent } = useRole();
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const modulesQuery = useLatestAgencyOperatingModulesV2();
  const ensureDraft = useEnsureAgencyOperatingModuleDraftV2();

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "modules", step: "modules", state: "in_progress" });
    }
  }, [agencyId, canEditContent]);

  if (modulesQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-52 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const approvedCount = AGENCY_AI_SETUP_CORE_MODULES.filter((module) => modulesQuery.latestByKey.get(module.key)?.status === "approved").length;

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-semibold text-foreground">Operating Modules</h1>
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                These modules are the governed source of truth for how your AI team should think and work. Start from suggested drafts built from your setup evidence, then tighten and approve them like playbooks.
              </p>
            </div>
            <Badge variant="secondary">
              {approvedCount}/{AGENCY_AI_SETUP_CORE_MODULES.length} approved
            </Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link to="/agency/ai-setup/foundations">Back to foundations</Link>
            </Button>
            <Button asChild>
              <Link to="/agency/ai-setup/guardrails">
                Continue to guardrails
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AGENCY_AI_SETUP_CORE_MODULES.map((module) => {
          const current = modulesQuery.latestByKey.get(module.key);
          const currentStatus = current?.status ?? null;
          const confidence = current?.confidence ?? current?.content_json?.confidence ?? 0;
          const assessment = current?.content_json ? assessAgencyAiSetupModuleContent(module.key, current.content_json) : null;
          const missingRequirements = assessment?.missingRequirements ?? [];

          return (
            <Card key={module.key} className="border-border/60 bg-card/40">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-foreground">{module.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{module.description}</div>
                  </div>
                  <Badge variant={currentStatus === "approved" ? "default" : "secondary"}>{formatStatus(currentStatus)}</Badge>
                </div>

                <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-medium text-foreground">{current?.version ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className="font-medium text-foreground">{confidence}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Rules</span>
                    <span className="font-medium text-foreground">{current?.content_json?.rules?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Proof readiness</span>
                    <span className="font-medium text-foreground">
                      {current?.content_json ? (assessment?.readyForApproval ? "Ready" : "Missing proof") : "Not started"}
                    </span>
                  </div>
                </div>

                {missingRequirements.length ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="text-xs font-medium text-foreground">Still needed before trusted approval</div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {missingRequirements.slice(0, 3).map((requirement) => (
                        <div key={requirement.key}>
                          {requirement.label}: {requirement.actualCount}/{requirement.minCount}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link to={`/agency/ai-setup/modules/${module.key}`}>
                      {current ? "Open module" : "Review suggested draft"}
                    </Link>
                  </Button>
                  {!current && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canEditContent || ensureDraft.isPending}
                      onClick={() => ensureDraft.mutate({ moduleKey: module.key })}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Draft
                    </Button>
                  )}
                  {currentStatus === "approved" && (
                    <div className="inline-flex items-center gap-2 text-xs text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Counts toward readiness
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
