import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileStack, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgencyAiSetupCheckpointCard } from "@/components/agency-ai-setup-v2/AgencyAiSetupCheckpointCard";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyData } from "@/hooks/useAgencyData";
import { useApprovedBrainDocuments } from "@/hooks/useBrainDocuments";
import {
  useImportAgencyAiSetupContextV2,
  usePersistAgencyAiSetupCheckpointV2,
  useSelectAgencyAiSetupStrategyTemplateV2,
  useTouchAgencyAiSetupStatusV2,
  useAgencyAiSetupResolvedState,
} from "@/hooks/useAgencyAiSetupV2";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import {
  AGENCY_AI_SETUP_STRATEGY_TEMPLATES,
  buildAgencyAiSetupImportsCheckpoint,
  buildStrategyAiImportPreview,
  getAgencyAiSetupStrategyTemplate,
} from "@/lib/agency-ai-setup-v2/adoption";

export default function AgencyAiSetupV2Imports() {
  const { agencyId } = useAgency();
  const { agency } = useAgencyData();
  const { status } = useAgencyAiSetupResolvedState(agencyId);
  const { data: approvedDocs = [], isLoading } = useApprovedBrainDocuments();
  const { canEditContent } = useRole();
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const importContext = useImportAgencyAiSetupContextV2(agencyId);
  const selectTemplate = useSelectAgencyAiSetupStrategyTemplateV2(agencyId);
  const persistCheckpoint = usePersistAgencyAiSetupCheckpointV2(agencyId);
  const { toast } = useToast();
  const selectedTemplate = getAgencyAiSetupStrategyTemplate(
    (status?.meta_json as Record<string, any> | undefined)?.guided_strategy_template_key,
  );
  const importsCheckpoint = (status?.meta_json as Record<string, any> | undefined)?.checkpoints?.imports;
  const strategyPreview = useMemo(
    () =>
      buildStrategyAiImportPreview({
        agencyName: agency?.name ?? null,
        niche: agency?.niche ?? null,
        approvedDocs: approvedDocs.map((doc) => ({ id: doc.id, title: doc.title, module: doc.module })),
      }),
    [agency?.name, agency?.niche, approvedDocs],
  );

  const sources = useMemo(() => {
    return [
      {
        key: "agency_profile",
        title: "Agency profile",
        description: "Agency name, website, and niche from workspace configuration.",
        status: agency ? "available" : "missing",
      },
      {
        key: "approved_brain_documents",
        title: "Approved brain documents",
        description: `${approvedDocs.length} approved documents can be used as operating evidence.`,
        status: approvedDocs.length ? "available" : "missing",
      },
    ];
  }, [agency, approvedDocs.length]);

  const availableKeys = sources.filter((item) => item.status === "available").map((item) => item.key);

  const handleImport = async () => {
    try {
      await importContext.mutateAsync({
        acceptedSources: availableKeys,
        acceptedDocumentCount: approvedDocs.length,
        strategyTemplateKey: selectedTemplate.key,
      });
      await persistCheckpoint.mutateAsync({
        stage: "imports",
        checkpoint: buildAgencyAiSetupImportsCheckpoint(selectedTemplate, strategyPreview),
      });
      toast({
        title: "Context imported",
        description: "Imported context is now stored in AI Setup V2 and readiness has been recomputed.",
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (agencyId && canEditContent) {
      touchStatus.mutate({ stage: "imports", step: "imports", state: "in_progress" });
    }
  }, [agencyId, canEditContent]);

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/50">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <FileStack className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Import Your Context</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Pick the closest agency type, import what already exists, and let Strategy AI draft the first version of your setup. This step should create a usable draft, not another blank form.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="text-sm font-medium text-foreground">What kind of agency are you?</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Choose the closest pattern. We will use it to pre-write your foundations, guardrails, and first module drafts.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {AGENCY_AI_SETUP_STRATEGY_TEMPLATES.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => selectTemplate.mutate(template.key)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    selectedTemplate.key === template.key
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/60 bg-background/40"
                  }`}
                >
                  <span className="font-medium text-foreground">{template.title}</span>
                  {selectedTemplate.key === template.key ? <span className="ml-2 text-primary">✓</span> : null}
                </button>
              ))}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{selectedTemplate.title}</span>. {selectedTemplate.bestFor}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {sources.map((source) => (
              <div key={source.key} className="rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{source.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{source.description}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {source.key === "agency_profile"
                        ? "Used to draft foundations like agency identity, market position, and niche focus."
                        : "Used to draft operating rules, examples, and early Strategy AI context."}
                    </div>
                  </div>
                  <Badge variant={source.status === "available" ? "default" : "secondary"}>
                    {source.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="text-sm font-medium text-foreground">What Strategy AI will pre-fill for you</div>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              <div>• Agency summary</div>
              <div>• Niche focus</div>
              <div>• Service model</div>
              <div>• Market position</div>
              <div>• Primary and secondary offers</div>
              <div>• ICP segments</div>
              <div>• Guardrail rules and banned claims</div>
              <div>• First Strategy AI module drafts</div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
              <div className="text-sm text-muted-foreground">
                Importing does not activate anything by itself. It creates the first full draft you will review and tighten in the next steps.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleImport} disabled={!canEditContent || importContext.isPending || availableKeys.length === 0}>
              {importContext.isPending ? "Importing..." : "Import and draft everything"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/agency/ai-setup/foundations">
                Continue to Step 2
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AgencyAiSetupCheckpointCard
        title="Imports checkpoint"
        reliableNow={(importsCheckpoint?.reliableNow as string | undefined) ?? strategyPreview.summary}
        stillWeak={
          (importsCheckpoint?.stillWeak as string | undefined) ??
          (strategyPreview.gaps[0] ?? "Imports are only the baseline. Foundations still need a focused human pass.")
        }
        nextAction={
          (importsCheckpoint?.nextAction as string | undefined) ??
          "Import the available context, then move straight into foundations."
        }
        previewPath="/agency/ai-setup/foundations"
        previewLabel="Review your foundations"
      />

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-3 p-5">
          <div className="space-y-1">
            <div className="text-base font-semibold text-foreground">What Strategy AI will draft from these imports</div>
            <div className="text-sm text-muted-foreground">{strategyPreview.summary}</div>
          </div>
          <div className="grid gap-4 md:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <div className="text-sm font-medium text-foreground">First draft this import unlocks</div>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {strategyPreview.draftLines.map((line) => (
                  <div key={line}>• {line}</div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                {strategyPreview.nextAction}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="text-sm font-medium text-foreground">Why this matters</div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {strategyPreview.evidenceNotes.map((note) => (
                    <div key={note}>• {note}</div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="text-sm font-medium text-foreground">What still needs your review</div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {strategyPreview.gaps.length ? (
                    strategyPreview.gaps.map((gap) => <div key={gap}>• {gap}</div>)
                  ) : (
                    <div>• Imports already give Strategy AI a usable first-pass baseline. Review foundations next to make it specific.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="space-y-3 p-5">
          <div className="space-y-1">
            <div className="text-base font-semibold text-foreground">Imported evidence preview</div>
            <div className="text-sm text-muted-foreground">These sources should become the first draft of your setup, not just a passive attachment list.</div>
          </div>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading approved documents...</div>
          ) : approvedDocs.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {approvedDocs.slice(0, 6).map((doc) => (
                <div key={doc.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <div>
                    <div className="text-sm font-medium text-foreground">{doc.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{doc.module}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No approved brain documents found yet. The setup can continue, but it will rely more on manual review and will keep Strategy AI trust low until stronger evidence is added.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
