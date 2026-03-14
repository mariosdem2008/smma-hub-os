import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileStack, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyData } from "@/hooks/useAgencyData";
import { useApprovedBrainDocuments } from "@/hooks/useBrainDocuments";
import { useImportAgencyAiSetupContextV2, useTouchAgencyAiSetupStatusV2 } from "@/hooks/useAgencyAiSetupV2";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";

export default function AgencyAiSetupV2Imports() {
  const { agencyId } = useAgency();
  const { agency } = useAgencyData();
  const { data: approvedDocs = [], isLoading } = useApprovedBrainDocuments();
  const { canEditContent } = useRole();
  const touchStatus = useTouchAgencyAiSetupStatusV2(agencyId);
  const importContext = useImportAgencyAiSetupContextV2(agencyId);
  const { toast } = useToast();

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
              <h1 className="text-2xl font-semibold text-foreground">Imported Context</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Start from what already exists. The goal here is not to complete setup manually. The goal is to draft Strategy AI context from existing evidence, then review and tighten it.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-sm font-medium text-foreground">How to use this step</div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <div>1. Import available sources.</div>
              <div>2. Review what the system drafted.</div>
              <div>3. Only write from scratch where evidence is missing or weak.</div>
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
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
              <div className="text-sm text-muted-foreground">
                Importing context does not activate anything by itself. It creates draft evidence the setup can compile into Strategy AI foundations and reviewed modules.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleImport} disabled={!canEditContent || importContext.isPending || availableKeys.length === 0}>
              {importContext.isPending ? "Importing..." : "Import available context"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/agency/ai-setup/foundations">
                Continue to foundations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
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
