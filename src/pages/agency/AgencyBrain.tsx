import { useState, useEffect } from "react";
import { Brain, RefreshCw, Sparkles, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BrainModuleCard } from "@/components/brain/BrainModuleCard";
import { AgencyBrainVisualization } from "@/components/brain/visualization";
import {
  useDocumentsByModule,
  useApproveBrainDocument,
} from "@/hooks/useBrainDocuments";
import {
  BRAIN_MODULE_ORDER,
  BRAIN_MODULE_LABELS,
  type BrainModule,
} from "@/lib/ai/brainModules";
import { hapticSelection } from "@/lib/haptics";
import { toast } from "sonner";

export default function AgencyBrain() {
  const { effectiveByModule, documents, isLoading, error, refetch } = useDocumentsByModule();
  const approveMutation = useApproveBrainDocument();

  // Detect mobile/tablet vs desktop
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleApprove = async (documentId: string) => {
    try {
      await approveMutation.mutateAsync(documentId);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleImprove = (module: BrainModule) => {
    toast.info("AI improvement coming soon!", {
      description: "This feature will suggest improvements to your brain configuration.",
    });
  };

  // Calculate stats
  const pendingModules = documents.filter(
    (d) => d.status === "draft" || d.status === "pending_approval"
  ).length;

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Error loading brain documents</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <Button onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Mobile view - simplified card list
  if (isMobile) {
    return (
      <div className="space-y-6 pb-20">
        {/* Mobile Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              <span className="brain-title-gradient">Agency Brain</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure your AI intelligence modules
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Pending approval banner */}
        {pendingModules > 0 && (
          <Alert className="bg-yellow-500/10 border-yellow-500/30">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-500">Pending Changes</AlertTitle>
            <AlertDescription className="text-yellow-500/80">
              {pendingModules} module{pendingModules > 1 ? "s" : ""} waiting for approval
            </AlertDescription>
          </Alert>
        )}

        {/* Module cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {BRAIN_MODULE_ORDER.map((module) => {
              const document = effectiveByModule[module] ?? null;
              const hasDraft = documents.some(
                (d) =>
                  d.module === module &&
                  (d.status === "draft" || d.status === "pending_approval")
              );

              return (
                <BrainModuleCard
                  key={module}
                  module={module}
                  document={document}
                  hasDraft={hasDraft && document?.status === "approved"}
                  onApprove={
                    document &&
                    (document.status === "draft" || document.status === "pending_approval")
                      ? () => handleApprove(document.id)
                      : undefined
                  }
                  onImprove={() => handleImprove(module)}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Desktop view - animated brain visualization
  return (
    <div className="relative">
      {/* Pending approval banner */}
      {pendingModules > 0 && (
        <Alert className="mb-6 bg-yellow-500/10 border-yellow-500/30">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-500">Pending Changes</AlertTitle>
          <AlertDescription className="text-yellow-500/80">
            You have {pendingModules} module{pendingModules > 1 ? "s" : ""} with unapproved changes.
            Click on them to review and approve.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
            <p className="text-muted-foreground">Loading brain modules...</p>
          </div>
        </div>
      ) : (
        <AgencyBrainVisualization
          effectiveByModule={effectiveByModule}
          isLoading={isLoading}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}
