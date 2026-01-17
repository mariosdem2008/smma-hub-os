import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { StatusBadge } from "@/components/ai-setup/StatusBadge";
import { ContentWizard } from "@/components/ai-setup/ContentWizard/ContentWizard";
import { useAgency } from "@/hooks/useAgency";
import { useRole } from "@/hooks/useRole";
import { useApproveBrainDocument, useArchiveBrainDocument, useBrainDocuments } from "@/hooks/useBrainDocuments";
import { useDefaultBrainPackIngestionHealth } from "@/hooks/useDefaultBrainPackIngestionHealth";
import { useSeedDefaultBrainPack } from "@/hooks/useSeedDefaultBrainPack";
import { isValidBrainModule, type BrainModule } from "@/lib/ai/brainModules";
import { MODULE_CONFIG } from "@/lib/brain/moduleConfig";
import { computeDisplayStatus } from "@/lib/brain/statusTypes";
import type { BrainDocument } from "@/lib/ai/brainDocuments";
import { toast } from "sonner";

function getDocumentPreview(doc: BrainDocument): { kind: "markdown" | "json"; content: string } {
  const content: unknown = (doc as any).content_json;
  if (typeof content === "string") return { kind: "markdown", content };
  if (content && typeof content === "object") {
    const raw = (content as any).raw_content;
    if (typeof raw === "string") return { kind: "markdown", content: raw };
    return { kind: "json", content: JSON.stringify(content, null, 2) };
  }
  return { kind: "json", content: String(content ?? "") };
}

export default function ModuleDetail() {
  const navigate = useNavigate();
  const { moduleKey } = useParams<{ moduleKey?: string }>();
  const { agencyId } = useAgency();
  const { canEditContent, canApproveContent } = useRole();

  const module = useMemo<BrainModule | null>(() => {
    if (!moduleKey) return null;
    return isValidBrainModule(moduleKey) ? moduleKey : null;
  }, [moduleKey]);

  const config = module ? MODULE_CONFIG[module] : null;

  const { data: documents = [], isLoading } = useBrainDocuments();
  const approvedCoreModules = useMemo(() => {
    const core: BrainModule[] = ["bootstrap", "rep_policy", "quality_bar"];
    return core.filter((m) => documents.some((d) => d.module === m && d.status === "approved"));
  }, [documents]);

  const { data: ingestionHealth } = useDefaultBrainPackIngestionHealth({
    agencyId: agencyId ?? undefined,
    approvedModules: approvedCoreModules,
  });
  const missingRagModules = ingestionHealth?.missingModules ?? [];

  const moduleDocuments = useMemo(() => {
    if (!module) return [];
    return documents.filter((d) => d.module === module);
  }, [documents, module]);

  const latestDraft = useMemo(() => {
    return (
      moduleDocuments
        .filter((d) => d.status === "draft" || d.status === "pending_approval")
        .slice()
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null
    );
  }, [moduleDocuments]);

  const latestApproved = useMemo(() => {
    return (
      moduleDocuments
        .filter((d) => d.status === "approved")
        .slice()
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null
    );
  }, [moduleDocuments]);

  const document = latestDraft ?? latestApproved ?? null;
  const hasIngestionError = Boolean(document && document.status === "approved" && missingRagModules.includes(document.module));
  const status = computeDisplayStatus(document, hasIngestionError);

  const approve = useApproveBrainDocument();
  const archive = useArchiveBrainDocument();
  const seedPack = useSeedDefaultBrainPack();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialMethod, setWizardInitialMethod] = useState<"template" | "upload" | "write">("template");

  if (!module || !config) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 space-y-6">
        <Button variant="ghost" onClick={() => navigate("/agency/ai-setup")} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to AI Setup
        </Button>
        <div className="rounded-xl border border-border/60 bg-card/40 p-6">
          <h1 className="text-xl font-semibold text-foreground">Module not found</h1>
          <p className="text-muted-foreground mt-2">This AI setup module doesn’t exist.</p>
        </div>
      </div>
    );
  }

  const onActivate = async () => {
    if (!document) return;
    try {
      await approve.mutateAsync(document.id);
    } catch {
      // toast handled by mutation
    }
  };

  const onDeleteDraft = async () => {
    if (!document) return;
    const confirmed = window.confirm("Delete this draft? This cannot be undone.");
    if (!confirmed) return;
    try {
      await archive.mutateAsync(document.id);
      toast.success("Draft deleted");
    } catch {
      // toast handled by mutation
    }
  };

  const onRetryProcessing = async () => {
    try {
      await seedPack.mutateAsync({ agencyId: agencyId ?? undefined, mode: "ingest_only" });
      toast.success("Retry started");
    } catch (e: any) {
      toast.error(e?.message ?? "Retry failed");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/agency/ai-setup">AI Setup</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{config.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">{config.name}</h1>
          <p className="text-muted-foreground mt-1">{config.description}</p>
        </div>
        <div className="shrink-0">
          <StatusBadge status={status} />
        </div>
      </div>

      {!canEditContent && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <span>Read-only access. Contact an admin to edit or activate this content.</span>
        </div>
      )}

      <div className="mt-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : status === "not-started" ? (
          <div className="rounded-xl border border-border/60 bg-card/40 p-8 text-center">
            <div className="text-5xl mb-4">📄</div>
            <h2 className="text-xl font-medium text-foreground mb-2">Set up {config.name}</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">Choose how you’d like to start.</p>

            <div className="rounded-lg border border-border/60 bg-card/60 p-6 mb-4 max-w-md mx-auto text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-300">✨</span>
                <span className="text-foreground font-medium">Use our template</span>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Recommended</span>
              </div>
              <p className="text-muted-foreground text-sm mb-4">Pre-filled with safe defaults. You can customize everything.</p>
              <Button
                onClick={() => {
                  setWizardInitialMethod("template");
                  setWizardOpen(true);
                }}
                disabled={!canEditContent}
              >
                Start with Template →
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <button
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={!canEditContent}
                onClick={() => {
                  setWizardInitialMethod("upload");
                  setWizardOpen(true);
                }}
              >
                Upload your own document
              </button>
              <span className="text-muted-foreground/40">|</span>
              <button
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={!canEditContent}
                onClick={() => {
                  setWizardInitialMethod("write");
                  setWizardOpen(true);
                }}
              >
                Write from scratch
              </button>
            </div>
          </div>
        ) : status === "error" ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-medium text-foreground mb-2">Your AI can’t use this content</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              This content is activated, but there was a problem processing it. Your AI is currently{" "}
              <span className="text-red-300 font-medium">not using</span> this information.
            </p>

            <Button onClick={onRetryProcessing} disabled={!canEditContent || seedPack.isPending}>
              Retry Processing →
            </Button>

            <p className="text-muted-foreground text-sm mt-4">If this keeps happening, please contact support.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Preview */}
            {document && (
              <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-card/70 border-b border-border/60">
                  <span className="text-sm font-medium text-foreground">
                    {status === "active" ? "Current Version" : "Preview"}
                  </span>
                  {canEditContent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setWizardInitialMethod("write");
                        setWizardOpen(true);
                      }}
                    >
                      {status === "active" ? "Create New Version" : "Edit"}
                    </Button>
                  )}
                </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                  {(() => {
                    const preview = getDocumentPreview(document);
                    if (preview.kind === "markdown") {
                      return (
                        <div className="prose prose-invert max-w-none">
                          <ReactMarkdown>{preview.content}</ReactMarkdown>
                        </div>
                      );
                    }
                    return (
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {preview.content}
                      </pre>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Draft CTA */}
            {status === "draft" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
                <div className="flex items-start gap-3">
                  <span className="text-amber-300 text-xl">⚠️</span>
                  <div className="min-w-0">
                    <h3 className="text-foreground font-medium mb-1">This content is saved but not active yet</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Your AI won’t use this information until you activate it.
                    </p>
                    <Button onClick={onActivate} disabled={!canApproveContent || approve.isPending}>
                      Activate This Content →
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Active banner */}
            {status === "active" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3">
                <span className="text-emerald-300 text-xl">✓</span>
                <p className="text-muted-foreground">Your AI is using this information to represent your agency.</p>
              </div>
            )}

            {/* Secondary actions */}
            {status === "draft" && canEditContent && (
              <div className="flex gap-4 text-sm">
                <button className="text-red-300 hover:text-red-200" onClick={onDeleteDraft} disabled={archive.isPending}>
                  Delete Draft
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ContentWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        module={module}
        initialMethod={wizardInitialMethod}
      />
    </div>
  );
}
