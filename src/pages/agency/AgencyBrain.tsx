import { useState } from "react";
import { Brain, RefreshCw, Sparkles, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrainModuleCard } from "@/components/brain/BrainModuleCard";
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

// Group modules into categories for tabs
const MODULE_CATEGORIES = {
  identity: ["bootstrap", "offer_stack"] as BrainModule[],
  policies: ["rep_policy", "ai_permissions"] as BrainModule[],
  operations: ["sop_strategy", "sop_scripting", "quality_bar"] as BrainModule[],
  content: ["tone_voice", "faq_objections"] as BrainModule[],
};

export default function AgencyBrain() {
  const { effectiveByModule, documents, isLoading, error, refetch } = useDocumentsByModule();
  const approveMutation = useApproveBrainDocument();
  const [selectedTab, setSelectedTab] = useState("all");

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
  const totalModules = BRAIN_MODULE_ORDER.length;
  const configuredModules = Object.values(effectiveByModule).filter(Boolean).length;
  const approvedModules = Object.values(effectiveByModule).filter((d) => d?.status === "approved").length;
  const pendingModules = documents.filter((d) => d.status === "draft" || d.status === "pending_approval").length;

  // Get modules for a category
  const getModulesForCategory = (category: keyof typeof MODULE_CATEGORIES): BrainModule[] => {
    return MODULE_CATEGORIES[category];
  };

  // Render module cards
  const renderModuleCards = (modules: BrainModule[]) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((module) => {
          const document = effectiveByModule[module] ?? null;
          const hasDraft = documents.some(
            (d) => d.module === module && (d.status === "draft" || d.status === "pending_approval")
          );

          return (
            <BrainModuleCard
              key={module}
              module={module}
              document={document}
              hasDraft={hasDraft && document?.status === "approved"}
              onApprove={
                document && (document.status === "draft" || document.status === "pending_approval")
                  ? () => handleApprove(document.id)
                  : undefined
              }
              onImprove={() => handleImprove(module)}
            />
          );
        })}
      </div>
    );
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Agency Brain Studio
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure how your AI operates - policies, SOPs, tone, and permissions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-2xl font-bold">{configuredModules}/{totalModules}</div>
          <div className="text-sm text-muted-foreground">Modules Configured</div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-2xl font-bold text-green-600">{approvedModules}</div>
          <div className="text-sm text-muted-foreground">Active (Approved)</div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-2xl font-bold text-yellow-600">{pendingModules}</div>
          <div className="text-sm text-muted-foreground">Pending Review</div>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <div className="text-2xl font-bold">{documents.length}</div>
          <div className="text-sm text-muted-foreground">Total Documents</div>
        </div>
      </div>

      {/* Pending approval banner */}
      {pendingModules > 0 && (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>Pending Changes</AlertTitle>
          <AlertDescription>
            You have {pendingModules} module{pendingModules > 1 ? "s" : ""} with unapproved changes.
            Approve them to make them active for AI operations.
          </AlertDescription>
        </Alert>
      )}

      {/* Module tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => { setSelectedTab(v); hapticSelection(); }}>
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto min-w-full md:w-full">
            <TabsTrigger value="all" className="flex-shrink-0">All Modules</TabsTrigger>
            <TabsTrigger value="identity" className="flex-shrink-0">Identity & Offers</TabsTrigger>
            <TabsTrigger value="policies" className="flex-shrink-0">Policies</TabsTrigger>
            <TabsTrigger value="operations" className="flex-shrink-0">Operations</TabsTrigger>
            <TabsTrigger value="content" className="flex-shrink-0">Content & Voice</TabsTrigger>
          </TabsList>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            <TabsContent value="all" className="mt-6">
              {renderModuleCards(BRAIN_MODULE_ORDER)}
            </TabsContent>

            <TabsContent value="identity" className="mt-6">
              {renderModuleCards(getModulesForCategory("identity"))}
            </TabsContent>

            <TabsContent value="policies" className="mt-6">
              {renderModuleCards(getModulesForCategory("policies"))}
            </TabsContent>

            <TabsContent value="operations" className="mt-6">
              {renderModuleCards(getModulesForCategory("operations"))}
            </TabsContent>

            <TabsContent value="content" className="mt-6">
              {renderModuleCards(getModulesForCategory("content"))}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Help text */}
      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">How it works:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Configure</strong> - Set up each module with your agency's specific policies and preferences</li>
          <li><strong>Draft</strong> - Changes are saved as drafts until you approve them</li>
          <li><strong>Approve</strong> - Approved content becomes active and is used by AI operations</li>
          <li><strong>Version History</strong> - All changes are tracked for audit and rollback</li>
        </ul>
      </div>
    </div>
  );
}
