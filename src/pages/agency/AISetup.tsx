import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ModuleCard } from "@/components/ai-setup/ModuleCard";
import { QuickSetupBanner } from "@/components/ai-setup/QuickSetup/QuickSetupBanner";
import { useAgency } from "@/hooks/useAgency";
import { useRole } from "@/hooks/useRole";
import { useDocumentsByModule } from "@/hooks/useBrainDocuments";
import type { BrainDocument } from "@/lib/ai/brainDocuments";
import type { BrainModule } from "@/lib/ai/brainModules";
import { CATEGORY_LABELS, CATEGORY_ORDER, MODULE_CONFIG, type ModuleCategory } from "@/lib/brain/moduleConfig";
import { computeDisplayStatus, type ModuleStatus } from "@/lib/brain/statusTypes";
import { useDefaultBrainPackIngestionHealth } from "@/hooks/useDefaultBrainPackIngestionHealth";

type ModuleWithStatus = {
  moduleKey: BrainModule;
  config: (typeof MODULE_CONFIG)[BrainModule];
  document: BrainDocument | null;
  status: ModuleStatus;
};

export default function AISetup() {
  const { agencyId } = useAgency();
  const { canEditContent } = useRole();
  const { byModule, documents, isLoading, error, refetch } = useDocumentsByModule();

  const approvedCoreModules = useMemo(() => {
    const core: BrainModule[] = ["bootstrap", "rep_policy", "quality_bar"];
    return core.filter((m) => documents.some((d) => d.module === m && d.status === "approved"));
  }, [documents]);

  const { data: ingestionHealth } = useDefaultBrainPackIngestionHealth({
    agencyId: agencyId ?? undefined,
    approvedModules: approvedCoreModules,
  });

  const missingRagModules = ingestionHealth?.missingModules ?? [];

  const modulesByCategory = useMemo(() => {
    const grouped: Record<ModuleCategory, ModuleWithStatus[]> = {
      core: [],
      templates: [],
      advanced: [],
    };

    (Object.keys(MODULE_CONFIG) as BrainModule[]).forEach((moduleKey) => {
      const config = MODULE_CONFIG[moduleKey];
      const docs = byModule[moduleKey] ?? [];
      const latestDraft =
        docs
          .filter((d) => d.status === "draft" || d.status === "pending_approval")
          .slice()
          .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null;
      const latestApproved =
        docs
          .filter((d) => d.status === "approved")
          .slice()
          .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null;

      const document = latestDraft ?? latestApproved ?? null;
      const hasIngestionError = Boolean(document && document.status === "approved" && missingRagModules.includes(moduleKey));
      const status = computeDisplayStatus(document, hasIngestionError);

      grouped[config.category].push({
        moduleKey,
        config,
        document,
        status,
      });
    });

    // Stable ordering within categories: default modules first, then name.
    for (const category of Object.keys(grouped) as ModuleCategory[]) {
      grouped[category] = grouped[category].slice().sort((a, b) => {
        if (a.config.isDefault !== b.config.isDefault) return a.config.isDefault ? -1 : 1;
        return a.config.name.localeCompare(b.config.name);
      });
    }

    return grouped;
  }, [byModule, missingRagModules]);

  const coreProgress = useMemo(() => {
    const coreModules = modulesByCategory.core;
    const activeCount = coreModules.filter((m) => m.status === "active").length;
    return { completed: activeCount, total: coreModules.length };
  }, [modulesByCategory.core]);

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Couldn’t load AI Setup</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <Button onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">AI Setup</h1>
        <p className="text-muted-foreground">
          Configure how your AI assistant represents your agency.
        </p>
        {!canEditContent && (
          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <span>
              You can view these settings, but only an admin can edit or activate them.
            </span>
          </div>
        )}
      </div>

      {coreProgress.completed < coreProgress.total && agencyId && (
        <QuickSetupBanner agencyId={agencyId} canRun={canEditContent} progress={coreProgress} />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={["core"]} className="space-y-2">
          {CATEGORY_ORDER.map((category) => {
            const label = CATEGORY_LABELS[category];
            const modules = modulesByCategory[category];
            return (
              <AccordionItem key={category} value={category} className="border border-border/60 rounded-lg bg-card/30">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="text-left">
                    <div className="text-base text-foreground font-medium">{label.title}</div>
                    <div className="text-sm text-muted-foreground">{label.description}</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3">
                    {modules.map((m) => (
                      <ModuleCard
                        key={m.moduleKey}
                        moduleKey={m.moduleKey}
                        config={m.config}
                        status={m.status}
                        lastUpdatedLabel={m.document ? `Updated ${new Date(m.document.updated_at).toLocaleDateString()}` : undefined}
                      />
                    ))}
                    {category === "core" && (
                      <p className="text-xs text-muted-foreground">
                        Need help? See <Link className="text-primary hover:underline" to="/ai/admin">Agency AI</Link>.
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
