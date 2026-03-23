import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, FileText, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AgencyAiSetupCheckpointCard } from "@/components/agency-ai-setup-v2/AgencyAiSetupCheckpointCard";
import { useAgency } from "@/hooks/useAgency";
import { useRole } from "@/hooks/useRole";
import {
  useAgencyAiSetupResolvedState,
  usePersistAgencyAiSetupCheckpointV2,
  useTouchAgencyAiSetupStatusV2,
} from "@/hooks/useAgencyAiSetupV2";
import {
  useEnsureAgencyOperatingModuleDraftV2,
  useLatestAgencyOperatingModulesV2,
} from "@/hooks/useAgencyOperatingModulesV2";
import {
  AGENCY_AI_SETUP_CORE_MODULES,
  STRATEGY_AI_MINIMUM_PROOF_MODULES,
  assessAgencyAiSetupModuleContent,
} from "@/lib/agency-ai-setup-v2/modules";
import { buildAgencyAiSetupModulesCheckpoint } from "@/lib/agency-ai-setup-v2/adoption";

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
  const { status } = useAgencyAiSetupResolvedState(agencyId);
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const persistCheckpoint = usePersistAgencyAiSetupCheckpointV2(agencyId);
  const modulesQuery = useLatestAgencyOperatingModulesV2();
  const ensureDraft = useEnsureAgencyOperatingModuleDraftV2();
  const [showAdvancedModules, setShowAdvancedModules] = useState(false);

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "modules", step: "modules", state: "in_progress" });
    }
  }, [agencyId, canEditContent]);

  const approvedCount = AGENCY_AI_SETUP_CORE_MODULES.filter((module) => modulesQuery.latestByKey.get(module.key)?.status === "approved").length;
  const minimumModules = AGENCY_AI_SETUP_CORE_MODULES.filter((module) => STRATEGY_AI_MINIMUM_PROOF_MODULES.includes(module.key));
  const advancedModules = AGENCY_AI_SETUP_CORE_MODULES.filter((module) => !STRATEGY_AI_MINIMUM_PROOF_MODULES.includes(module.key));
  const minimumApprovedCount = minimumModules.filter((module) => modulesQuery.latestByKey.get(module.key)?.status === "approved").length;
  const nextGuidedModule =
    minimumModules.find((module) => modulesQuery.latestByKey.get(module.key)?.status !== "approved") ?? minimumModules[0];
  const modulesCheckpoint =
    ((status?.meta_json ?? {}) as Record<string, any>)?.checkpoints?.modules ??
    buildAgencyAiSetupModulesCheckpoint({
      approvedMinimumCount: minimumApprovedCount,
      totalMinimumCount: minimumModules.length,
      nextModuleTitle: nextGuidedModule?.title ?? null,
    });

  useEffect(() => {
    if (!agencyId) return;
    persistCheckpoint.mutate({
      stage: "modules",
      checkpoint: buildAgencyAiSetupModulesCheckpoint({
        approvedMinimumCount: minimumApprovedCount,
        totalMinimumCount: minimumModules.length,
        nextModuleTitle: nextGuidedModule?.title ?? null,
      }),
    });
  }, [agencyId, minimumApprovedCount, minimumModules.length, nextGuidedModule?.title]);

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

  const renderModuleCard = (module: (typeof AGENCY_AI_SETUP_CORE_MODULES)[number], guided = false) => {
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
              <div className="flex items-center gap-2">
                <div className="text-base font-semibold text-foreground">{module.title}</div>
                {guided ? <Badge variant="outline">Minimum Strategy AI proof</Badge> : null}
              </div>
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
  };

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
                These modules are the governed source of truth for how your AI team should think and work. Start with the minimum Strategy AI proof first, then open the full module system after that path is understandable.
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

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-base font-semibold text-foreground">Minimum Strategy AI proof</div>
              <div className="max-w-3xl text-sm text-muted-foreground">
                Do not try to approve every module first. These are the minimum modules needed to get Strategy AI to a trustworthy internal-assist baseline.
              </div>
            </div>
            <Badge variant="secondary">
              {minimumApprovedCount}/{minimumModules.length} minimum modules approved
            </Badge>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-sm font-medium text-foreground">Best next action</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Review and tighten <span className="font-medium text-foreground">{nextGuidedModule.title}</span> next. Get these four approved before worrying about the broader module system.
            </div>
            <div className="mt-3">
              <Button asChild>
                <Link to={`/agency/ai-setup/modules/${nextGuidedModule.key}`}>
                  Open next required module
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {minimumModules.map((module) => renderModuleCard(module, true))}
          </div>
        </CardContent>
      </Card>

      <AgencyAiSetupCheckpointCard
        title="Minimum Strategy AI proof checkpoint"
        reliableNow={modulesCheckpoint.reliableNow as string}
        stillWeak={modulesCheckpoint.stillWeak as string}
        nextAction={modulesCheckpoint.nextAction as string}
        previewPath="/agency/ai-setup/readiness/preview/strategy"
        previewLabel="Open the first Strategy AI preview"
      />

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-4 p-5">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setShowAdvancedModules((current) => !current)}
          >
            <div>
              <div className="text-base font-semibold text-foreground">Advanced modules</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Open the broader module system after the minimum Strategy AI path is understandable.
              </div>
            </div>
            {showAdvancedModules ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </button>

          {showAdvancedModules ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {advancedModules.map((module) => renderModuleCard(module))}
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
              The rest of the module system is still available, but it is intentionally hidden at first so setup does not feel like six equally urgent playbooks.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
