import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  RefreshCw,
  FileText,
  ChevronRight,
  Sparkles,
  Clock,
  CheckCircle2,
  Settings,
  Copy,
  Download,
  Search,
  ArrowDown,
  Maximize2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  BRAIN_MODULE_LABELS,
  BRAIN_MODULE_DESCRIPTIONS,
  type BrainModule,
} from "@/lib/ai/brainModules";
import type { BrainDocument } from "@/lib/ai/brainDocuments";
import {
  useBrainDocuments,
  useApproveBrainDocument,
  useArchiveBrainDocument,
} from "@/hooks/useBrainDocuments";
import { BrainModuleEditor } from "@/components/brain/BrainModuleEditor";
import { ExampleDocCard } from "@/components/brain/layer-detail/ExampleDocCard";
import { DocumentViewer } from "@/components/brain/layer-detail/DocumentViewer";
import { VersionsList } from "@/components/brain/layer-detail/VersionsList";
import { DocumentUploadModal } from "@/components/brain/layer-detail/DocumentUploadModal";
import { LayerInsights } from "@/components/brain/layer-detail/LayerInsights";

// Map URL params to BrainModule types
const LAYER_PARAM_MAP: Record<string, BrainModule> = {
  bootstrap_profile: "bootstrap",
  rep_policy: "rep_policy",
  strategy_sop: "sop_strategy",
  scripting_sop: "sop_scripting",
  tone_voice: "tone_voice",
  faq_objections: "faq_objections",
  ai_permissions: "ai_permissions",
  offer_stack: "offer_stack",
  quality_bar: "quality_bar",
};

export default function BrainLayerDetail() {
  const { layer } = useParams<{ layer: string }>();
  const navigate = useNavigate();

  // Resolve layer param to BrainModule
  const module = layer ? LAYER_PARAM_MAP[layer] : undefined;

  // Redirect if invalid layer
  useEffect(() => {
    if (layer && !LAYER_PARAM_MAP[layer]) {
      toast.error("Invalid brain layer");
      navigate("/agency/brain");
    }
  }, [layer, navigate]);

  const { data: documents = [], isLoading } = useBrainDocuments();
  const approveMutation = useApproveBrainDocument();
  const archiveMutation = useArchiveBrainDocument();

  // Get documents for this module
  const moduleDocuments = documents.filter((d) => d.module === module);

  // Get the active/effective document (approved > pending > draft)
  const activeDocument = moduleDocuments.find((d) => d.status === "approved")
    ?? moduleDocuments.find((d) => d.status === "pending_approval")
    ?? moduleDocuments.find((d) => d.status === "draft")
    ?? null;

  // State
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [contentMode, setContentMode] = useState<"transformed" | "original">("transformed");
  const [rightRailTab, setRightRailTab] = useState<"versions" | "example" | "insights">("versions");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Get the document to display (selected version or active)
  const displayDocument = selectedVersionId
    ? moduleDocuments.find((d) => d.id === selectedVersionId) ?? activeDocument
    : activeDocument;
  const compareDocument = compareVersionId && compareVersionId !== displayDocument?.id
    ? moduleDocuments.find((d) => d.id === compareVersionId) ?? null
    : null;
  const isPreviewing = Boolean(
    displayDocument && activeDocument && displayDocument.id !== activeDocument.id
  );

  // Handle setting a version as active (approve it)
  const handleSetActive = async (documentId: string) => {
    try {
      await approveMutation.mutateAsync(documentId);
      toast.success("Active version updated");
      setSelectedVersionId(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDeleteVersion = async (documentId: string) => {
    const confirmed = window.confirm("Delete this version? This cannot be undone.");
    if (!confirmed) return;
    try {
      await archiveMutation.mutateAsync(documentId);
      if (selectedVersionId === documentId) {
        setSelectedVersionId(null);
      }
      if (compareVersionId === documentId) {
        setCompareVersionId(null);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleOpenPanel = (tab: "versions" | "example" | "insights") => {
    setRightRailTab(tab);
    if (!isDesktop) {
      setMobilePanelOpen(true);
    }
  };

  const getDocumentContent = (doc: BrainDocument) => {
    if (typeof doc.content_json === "string") {
      return doc.content_json;
    }
    return JSON.stringify(doc.content_json, null, 2);
  };

  const handleCopyContent = async () => {
    if (!displayDocument) {
      toast.error("No document selected");
      return;
    }
    try {
      await navigator.clipboard.writeText(getDocumentContent(displayDocument));
      toast.success("Document content copied");
    } catch {
      toast.error("Failed to copy content");
    }
  };

  const handleDownloadContent = () => {
    if (!displayDocument) {
      toast.error("No document selected");
      return;
    }
    const content = getDocumentContent(displayDocument);
    const extension = typeof displayDocument.content_json === "string" ? "txt" : "json";
    const fileName = `${module}-${displayDocument.version}.${extension}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = fileName;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success("Download started");
  };

  if (!module) {
    return null; // Will redirect via useEffect
  }

  const label = BRAIN_MODULE_LABELS[module];
  const description = BRAIN_MODULE_DESCRIPTIONS[module];
  const sortedDocuments = [...moduleDocuments].sort((a, b) => b.version - a.version);

  const PanelTabs = ({ scrollAreaClass }: { scrollAreaClass: string }) => (
    <Tabs
      value={rightRailTab}
      onValueChange={(value) => setRightRailTab(value as typeof rightRailTab)}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="versions">Versions</TabsTrigger>
        <TabsTrigger value="example">Example</TabsTrigger>
        <TabsTrigger value="insights">Insights</TabsTrigger>
      </TabsList>
      <TabsContent value="versions" className="mt-4">
        {moduleDocuments.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No versions yet. Upload or generate your first document.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>History</span>
              <span>{moduleDocuments.length} total</span>
            </div>
            <ScrollArea className={scrollAreaClass}>
              <VersionsList
                documents={moduleDocuments}
                activeDocumentId={activeDocument?.id ?? null}
                selectedVersionId={selectedVersionId}
                onSelectVersion={(id) => {
                  setSelectedVersionId(id);
                  if (id && id === compareVersionId) {
                    setCompareVersionId(null);
                  }
                }}
                onSetActive={handleSetActive}
                onDelete={handleDeleteVersion}
                compareVersionId={compareVersionId}
                onCompareSelect={(id) => setCompareVersionId((prev) => (prev === id ? null : id))}
                expanded
                embedded
              />
            </ScrollArea>
          </div>
        )}
      </TabsContent>
      <TabsContent value="example" className="mt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Template Preview</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowExampleModal(true)}
              title="Expand example"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className={scrollAreaClass}>
            <ExampleDocCard module={module} expanded embedded />
          </ScrollArea>
        </div>
      </TabsContent>
      <TabsContent value="insights" className="mt-4">
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Quality Snapshot</div>
          <ScrollArea className={scrollAreaClass}>
            <LayerInsights
              module={module}
              activeDocument={activeDocument}
              documents={moduleDocuments}
            />
          </ScrollArea>
        </div>
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header with breadcrumbs */}
      <div className="border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40">
        <div className="container py-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/agency/brain" className="hover:text-foreground transition-colors">
              Agency Brain
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{label}</span>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/agency/brain")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold">{label}</h1>
                <p className="text-muted-foreground text-sm">{description}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {activeDocument ? (
                    <>
                      <Badge variant="default">Live v{activeDocument.version}</Badge>
                      <span>Updated {new Date(activeDocument.updated_at).toLocaleDateString()}</span>
                      <Badge variant="outline">{activeDocument.source}</Badge>
                    </>
                  ) : (
                    <Badge variant="secondary">No live version</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setShowUploadModal(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload/Write Document
              </Button>
              <Button variant="outline" onClick={() => toast.info("Regenerate coming soon")}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate
              </Button>
              <Button variant="outline" onClick={() => setShowConfigureModal(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
              <Button variant="outline" onClick={() => handleOpenPanel("versions")}>
                <Clock className="h-4 w-4 mr-2" />
                History
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              </div>
            ) : moduleDocuments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10">
                  <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium">No content yet</h3>
                          <p className="text-muted-foreground text-sm">
                            Upload a document or generate content using our guided configuration.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                      <Button onClick={() => setShowUploadModal(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload/Write Document
                      </Button>
                        <Button variant="outline" onClick={() => setShowConfigureModal(true)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                        <Button variant="outline" onClick={() => toast.info("Regenerate coming soon")}>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick Start</p>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                            1
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Start from a proven template</p>
                            <p className="text-xs text-muted-foreground">
                              Use the built-in example structure to guide your content.
                            </p>
                            <Button variant="outline" size="sm" onClick={() => handleOpenPanel("example")}>
                              Open Example
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-center text-muted-foreground">
                          <ArrowDown className="h-4 w-4" />
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center">
                            2
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Upload your existing doc</p>
                            <p className="text-xs text-muted-foreground">
                              Bring in current material and let the brain organize it.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-center text-muted-foreground">
                          <ArrowDown className="h-4 w-4" />
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center">
                            3
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Review and set live</p>
                            <p className="text-xs text-muted-foreground">
                              Compare versions and promote the best one.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {isPreviewing && displayDocument && activeDocument && (
                  <Alert className="border-amber-500/30 bg-amber-500/10">
                    <AlertTitle>Previewing v{displayDocument.version}</AlertTitle>
                    <AlertDescription>
                      Live version is v{activeDocument.version}. Review changes before promoting.
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSetActive(displayDocument.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Set Live
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedVersionId(null)}
                        >
                          Back to Live
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="rounded-lg border bg-card/50 p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <Select
                        value={selectedVersionId ?? "active"}
                        onValueChange={(value) => {
                          const nextId = value === "active" ? null : value;
                          setSelectedVersionId(nextId);
                          if (nextId && nextId === compareVersionId) {
                            setCompareVersionId(null);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select version" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeDocument && (
                            <SelectItem value="active">
                              Live v{activeDocument.version} (Active)
                            </SelectItem>
                          )}
                          {sortedDocuments.map((doc) => (
                            <SelectItem key={doc.id} value={doc.id}>
                              v{doc.version} •{" "}
                              {doc.status === "approved"
                                ? "Active"
                                : doc.status === "pending_approval"
                                  ? "Pending"
                                  : "Draft"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Tabs
                        value={contentMode}
                        onValueChange={(v) => setContentMode(v as typeof contentMode)}
                      >
                        <TabsList>
                          <TabsTrigger value="transformed">
                            <Sparkles className="h-4 w-4 mr-2" />
                            Transformed
                          </TabsTrigger>
                          <TabsTrigger value="original">
                            <FileText className="h-4 w-4 mr-2" />
                            Original
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative w-full md:w-56">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder="Search content"
                          className="pl-9"
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={handleCopyContent}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownloadContent}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      {compareDocument && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCompareVersionId(null)}
                        >
                          Clear Compare
                        </Button>
                      )}
                      {displayDocument && displayDocument.status !== "approved" && (
                        <Button
                          size="sm"
                          onClick={() => handleSetActive(displayDocument.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Set Live
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {compareDocument ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-2">
                      <Badge variant="secondary">Primary View</Badge>
                      <DocumentViewer
                        document={displayDocument}
                        contentMode={contentMode}
                        searchQuery={searchQuery}
                      />
                    </div>
                    <div className="space-y-2">
                      <Badge variant="secondary">
                        Compare v{compareDocument.version}
                      </Badge>
                      <DocumentViewer
                        document={compareDocument}
                        contentMode={contentMode}
                        searchQuery={searchQuery}
                      />
                    </div>
                  </div>
                ) : (
                  <DocumentViewer
                    document={displayDocument}
                    contentMode={contentMode}
                    searchQuery={searchQuery}
                  />
                )}
              </>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <Card className="border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Reference Panel</CardTitle>
                </CardHeader>
                <CardContent>
                  <PanelTabs scrollAreaClass="h-[60vh] pr-2" />
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
        <Sheet open={mobilePanelOpen} onOpenChange={setMobilePanelOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
              <Clock className="h-4 w-4 mr-2" />
              Open Panel
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh]">
            <SheetHeader>
              <SheetTitle>Layer Panel</SheetTitle>
              <SheetDescription>
                Templates, history, and quality insights for {label}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <PanelTabs scrollAreaClass="h-[45vh] pr-2" />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Upload Modal */}
      <DocumentUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        module={module}
      />

      {/* Example Modal */}
      <Dialog open={showExampleModal} onOpenChange={setShowExampleModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Example Structure</DialogTitle>
            <DialogDescription>Reference template for {label}</DialogDescription>
          </DialogHeader>
          <ExampleDocCard module={module} expanded embedded />
        </DialogContent>
      </Dialog>

      {/* Configure Modal */}
      <Dialog open={showConfigureModal} onOpenChange={setShowConfigureModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure {label}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <BrainModuleEditor
            module={module}
            document={activeDocument}
            onClose={() => setShowConfigureModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
