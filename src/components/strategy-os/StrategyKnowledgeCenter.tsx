import { useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { renderToStaticMarkup } from "react-dom/server";
import { FileText, Download, UploadCloud, History, ArrowLeft, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useStrategyDocuments, useGenerateStrategyDocument, useUploadStrategyDocument, useActivateStrategyDocument } from "@/hooks/useStrategyDocuments";
import { useStrategies } from "@/hooks/useStrategies";
import { useStrategyModules } from "@/hooks/useStrategyModules";
import StrategyOSV3 from "@/components/strategy-os/StrategyOSV3";
import type { StrategyDocumentRecord, StrategyModule } from "@/lib/strategy/types";

type ViewMode = "document" | "details";

const SECTION_TO_MODULE: Record<string, StrategyModule> = {
  "icp objections triggers": "positioning",
  "positioning proof": "positioning",
  "pillars": "pillars",
  "channel strategy": "channel_adaptations",
  "campaign plan": "campaign_plan",
  "weekly plan": "weekly_plan",
  "creative rules claims policy": "rules_constraints",
};

interface StrategyKnowledgeCenterProps {
  clientId: string;
  agencyId: string;
}

function normalizeHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/[+]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyHeading(text: string) {
  return normalizeHeading(text).replace(/\s+/g, "-");
}

function parseSections(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  let title = "";
  const sections: Array<{ title: string; content: string }> = [];
  let currentTitle = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (!title && line.startsWith("# ")) {
      title = line.replace(/^#\s+/, "").trim();
      continue;
    }
    if (line.startsWith("## ")) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
      }
      currentTitle = line.replace(/^##\s+/, "").trim();
      currentLines = [];
      continue;
    }
    currentLines.push(line);
  }

  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
  }

  if (sections.length === 0 && markdown.trim()) {
    sections.push({ title: "Strategy", content: markdown.trim() });
  }

  return { title, sections };
}

function highlightNodes(node: ReactNode, query: string): ReactNode {
  if (!query) return node;
  if (typeof node === "string") {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "ig");
    const parts = node.split(regex);
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={`${part}-${index}`} className="bg-yellow-300/40 text-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  }
  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <span key={index}>{highlightNodes(child, query)}</span>
    ));
  }
  if (node && typeof node === "object" && "props" in node) {
    const element = node as ReactElement;
    return {
      ...element,
      props: { ...element.props, children: highlightNodes(element.props.children, query) },
    };
  }
  return node;
}

function getHeadingText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map(getHeadingText).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    const element = children as ReactElement;
    return getHeadingText(element.props.children);
  }
  return "";
}

function DocumentHeaderActions({
  hasDocument,
  instruction,
  onInstructionChange,
  onGenerate,
  onRegenerate,
  onDownload,
  onUploadClick,
  onHistoryClick,
  isGenerating,
  isUploading,
}: {
  hasDocument: boolean;
  instruction: string;
  onInstructionChange: (value: string) => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onDownload: () => void;
  onUploadClick: () => void;
  onHistoryClick: () => void;
  isGenerating: boolean;
  isUploading: boolean;
}) {
  if (!hasDocument) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onGenerate} disabled={isGenerating} className="gap-2">
          <FileText className="h-4 w-4" />
          {isGenerating ? "Generating..." : "Generate Strategy"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1">
        <RotateCcw className="h-4 w-4 text-muted-foreground" />
        <Input
          value={instruction}
          onChange={(event) => onInstructionChange(event.target.value.slice(0, 200))}
          placeholder="Add instruction (max 200 chars)"
          className="h-8 w-56 border-0 bg-transparent text-xs focus-visible:ring-0"
          maxLength={200}
        />
        <Button size="sm" variant="secondary" onClick={onRegenerate} disabled={isGenerating}>
          {isGenerating ? "Regenerating..." : "Regenerate"}
        </Button>
      </div>
      <Button size="sm" variant="outline" onClick={onDownload} className="gap-2">
        <Download className="h-4 w-4" />
        Download PDF
      </Button>
      <Button size="sm" variant="outline" onClick={onUploadClick} disabled={isUploading} className="gap-2">
        <UploadCloud className="h-4 w-4" />
        {isUploading ? "Uploading..." : "Upload document"}
      </Button>
      <Button size="sm" variant="outline" onClick={onHistoryClick} className="gap-2">
        <History className="h-4 w-4" />
        History
      </Button>
    </div>
  );
}

function StatusStrip({ document }: { document: StrategyDocumentRecord }) {
  const updatedAt = document.updated_at ? format(new Date(document.updated_at), "MMM d, yyyy h:mm a") : "Unknown";
  const sourceLabel = document.source === "ai" ? "AI" : document.source === "upload" ? "Upload" : "Manual";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span>Last updated: {updatedAt}</span>
      <Separator orientation="vertical" className="h-4" />
      <span>Source: {sourceLabel}</span>
      <Separator orientation="vertical" className="h-4" />
      <span>Based on: Onboarding + Brain</span>
      {document.model && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <span>Model: {document.model}</span>
        </>
      )}
    </div>
  );
}

function StrategyDocumentView({
  document,
  onEditSection,
  onViewDetails,
  searchQuery,
  onSearchChange,
}: {
  document: StrategyDocumentRecord;
  onEditSection: (module: StrategyModule) => void;
  onViewDetails: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}) {
  const markdown = document.content_markdown ?? document.content_html ?? "";
  const parsed = useMemo(() => parseSections(markdown), [markdown]);
  const tocItems = parsed.sections.map((section) => ({
    id: slugifyHeading(section.title),
    title: section.title,
  }));

  return (
    <div className="space-y-4">
      <StatusStrip document={document} />
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search in document"
                className="pl-8"
              />
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Table of contents
              </div>
              <div className="space-y-2 text-sm">
                {tocItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const target = globalThis.document?.getElementById(item.id);
                      target?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="text-left text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Strategy Document</h2>
              <p className="text-sm text-muted-foreground">
                Readable strategy overview with linked edits.
              </p>
            </div>
            <Button variant="secondary" onClick={onViewDetails}>
              Strategy details
            </Button>
          </div>
          <div className="relative lg:hidden">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search in document"
              className="pl-8"
            />
          </div>

          <Card className="border-border/60 bg-background/60">
            <CardContent className="p-0">
              <ScrollArea className="h-[70vh] px-4 py-6">
                {parsed.title && (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <h1>{parsed.title}</h1>
                  </div>
                )}
                <Accordion type="multiple" defaultValue={tocItems.map((item) => item.id)}>
                  {parsed.sections.map((section) => {
                    const normalized = normalizeHeading(section.title);
                    const moduleTarget = Object.entries(SECTION_TO_MODULE).find(([key]) =>
                      normalized.includes(key),
                    )?.[1];
                    const anchorId = slugifyHeading(section.title);

                    return (
                      <AccordionItem key={anchorId} value={anchorId} className="border-border/40">
                        <div id={anchorId} className="scroll-mt-24" />
                        <AccordionTrigger className="text-base">
                          <span className="flex items-center gap-3">
                            {section.title}
                            {moduleTarget && (
                              <Badge variant="outline" className="text-xs">
                                Editable
                              </Badge>
                            )}
                          </span>
                          {moduleTarget && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-3"
                              onClick={(event) => {
                                event.stopPropagation();
                                onEditSection(moduleTarget);
                              }}
                            >
                              Edit this section
                            </Button>
                          )}
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h3: ({ children }) => {
                                  const text = getHeadingText(children);
                                  const id = slugifyHeading(text);
                                  return <h3 id={id}>{children}</h3>;
                                },
                                h4: ({ children }) => {
                                  const text = getHeadingText(children);
                                  const id = slugifyHeading(text);
                                  return <h4 id={id}>{children}</h4>;
                                },
                                p: ({ children }) => (
                                  <p className="text-sm leading-relaxed">
                                    {highlightNodes(children, searchQuery)}
                                  </p>
                                ),
                                li: ({ children }) => (
                                  <li className="text-sm">
                                    {highlightNodes(children, searchQuery)}
                                  </li>
                                ),
                              }}
                            >
                              {section.content}
                            </ReactMarkdown>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function StrategyKnowledgeCenter({ clientId, agencyId }: StrategyKnowledgeCenterProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get("strategy_view") as ViewMode) ?? "document";
  const [instruction, setInstruction] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const uploadInputId = `strategy-upload-${clientId}`;
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: documents = [] } = useStrategyDocuments(clientId);
  const activeDocument = documents.find((doc) => doc.is_active) ?? documents[0] ?? null;

  const { data: strategies = [] } = useStrategies(clientId);
  const activeStrategy = strategies[0];
  const { data: modules = [] } = useStrategyModules(clientId, activeStrategy?.id);

  const latestModuleUpdate = useMemo(() => {
    if (modules.length === 0) return null;
    return modules.reduce((latest, mod) => {
      const next = mod.updated_at ? new Date(mod.updated_at).getTime() : 0;
      return Math.max(latest, next);
    }, 0);
  }, [modules]);

  const docOutOfDate = useMemo(() => {
    if (!activeDocument || !latestModuleUpdate) return false;
    return new Date(activeDocument.updated_at).getTime() < latestModuleUpdate;
  }, [activeDocument, latestModuleUpdate]);

  const generateDocument = useGenerateStrategyDocument();
  const uploadDocument = useUploadStrategyDocument();
  const activateDocument = useActivateStrategyDocument();

  const setView = (next: ViewMode) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "document") {
      nextParams.delete("strategy_view");
    } else {
      nextParams.set("strategy_view", next);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleEditSection = (module: StrategyModule) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("strategy_view", "details");
    nextParams.set("strategy_module", module);
    setSearchParams(nextParams, { replace: true });
  };

  const handleGenerate = async () => {
    await generateDocument.mutateAsync({ clientId });
  };

  const handleRegenerate = async () => {
    await generateDocument.mutateAsync({ clientId, instruction: instruction.trim() || undefined });
    setInstruction("");
  };

  const handleUpload = async (file: File) => {
    await uploadDocument.mutateAsync({ clientId, agencyId, file });
  };

  const handleDownload = () => {
    if (!activeDocument?.content_markdown) return;
    const htmlContent = renderToStaticMarkup(
      <div className="strategy-print">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {activeDocument.content_markdown}
        </ReactMarkdown>
      </div>,
    );
    const html = `<!doctype html><html><head><title>Strategy Document</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h1, h2, h3 { margin-top: 24px; }
        p { line-height: 1.6; }
        ul { padding-left: 18px; }
      </style>
    </head><body>${htmlContent}</body></html>`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (view === "details") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-3">
          <Button variant="ghost" onClick={() => setView("document")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to document
          </Button>
          <div className="flex items-center gap-2">
            {docOutOfDate && (
              <Badge variant="secondary">Document out of date</Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                generateDocument.mutateAsync({
                  clientId,
                  instruction:
                    "Update the document to match latest strategy details; preserve structure and style.",
                })
              }
              disabled={generateDocument.isPending}
            >
              {generateDocument.isPending ? "Updating..." : "Update doc"}
            </Button>
          </div>
        </div>
        <StrategyOSV3 clientId={clientId} agencyId={agencyId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Strategy Knowledge Center</h1>
          <p className="text-sm text-muted-foreground">
            Review the live strategy document or jump into details.
          </p>
        </div>
        <DocumentHeaderActions
          hasDocument={!!activeDocument}
          instruction={instruction}
          onInstructionChange={setInstruction}
          onGenerate={handleGenerate}
          onRegenerate={handleRegenerate}
          onDownload={handleDownload}
          onUploadClick={() => {
            const input = document.getElementById(uploadInputId) as HTMLInputElement | null;
            input?.click();
          }}
          onHistoryClick={() => setHistoryOpen(true)}
          isGenerating={generateDocument.isPending}
          isUploading={uploadDocument.isPending}
        />
      </div>

      <input
        id={uploadInputId}
        type="file"
        accept=".pdf,.md,.txt,.doc,.docx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            handleUpload(file);
          }
          event.currentTarget.value = "";
        }}
      />

      {historyOpen && (
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document history</DialogTitle>
            <DialogDescription>Activate a previous document to make it current.</DialogDescription>
          </DialogHeader>
            <div className="space-y-3">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents yet.</p>
              ) : (
                documents.map((doc) => {
                  const updatedAt = doc.updated_at ? format(new Date(doc.updated_at), "MMM d, yyyy h:mm a") : "Unknown";
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-md border border-border/60 bg-background/60 px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">Document</div>
                        <div className="text-xs text-muted-foreground">
                          {updatedAt} • {doc.source === "ai" ? "AI" : doc.source === "upload" ? "Upload" : "Manual"}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={doc.id === activeDocument?.id ? "secondary" : "outline"}
                        onClick={() => activateDocument.mutateAsync({ clientId, documentId: doc.id })}
                      >
                        {doc.id === activeDocument?.id ? "Active" : "Set active"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {!activeDocument ? (
        <Card className="border-dashed border-border/60 bg-background/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/60 mb-4" />
            <h3 className="text-lg font-medium">No strategy document yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Generate a strategy document to make the Strategy tab the source of truth.
            </p>
          </CardContent>
        </Card>
      ) : (
        <StrategyDocumentView
          document={activeDocument}
          onEditSection={handleEditSection}
          onViewDetails={() => setView("details")}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}
    </div>
  );
}

export default StrategyKnowledgeCenter;
