import { useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { renderToStaticMarkup } from "react-dom/server";
import { FileText, Download, UploadCloud, History, ArrowLeft, RotateCcw, Search, Loader2, ChevronDown } from "lucide-react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { useStrategyDocuments, useGenerateStrategyDocument, useUploadStrategyDocument, useActivateStrategyDocument } from "@/hooks/useStrategyDocuments";
import { useStrategies } from "@/hooks/useStrategies";
import { useStrategyModules } from "@/hooks/useStrategyModules";
import StrategyOSV3 from "@/components/strategy-os/StrategyOSV3";
import type { StrategyDocumentRecord, StrategyModule } from "@/lib/strategy/types";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

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

function nodeHasLineBreaks(children: ReactNode): boolean {
  if (typeof children === "string") {
    return children.includes("\n");
  }
  if (Array.isArray(children)) {
    return children.some(nodeHasLineBreaks);
  }
  if (children && typeof children === "object" && "props" in children) {
    const element = children as ReactElement;
    return nodeHasLineBreaks(element.props.children);
  }
  return false;
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
  generationPhase,
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
  generationPhase: string | null;
  isUploading: boolean;
}) {
  if (!hasDocument) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onGenerate} disabled={isGenerating} className="gap-2">
          <FileText className="h-4 w-4" />
          {isGenerating ? "Building..." : "Strategy Builder"}
        </Button>
        {generationPhase && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin" />
            {generationPhase}
          </div>
        )}
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
      {generationPhase && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin" />
          {generationPhase}
        </div>
      )}
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
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Table of contents
              </div>
              <div className="space-y-1 text-sm">
                {tocItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const target = globalThis.document?.getElementById(item.id);
                      target?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="w-full rounded-md px-2 py-1.5 text-left text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
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
              <ScrollArea className="h-[70vh] px-6 py-8">
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
                      <AccordionItem key={anchorId} value={anchorId} className="border-border/40 px-2">
                        <div id={anchorId} className="scroll-mt-24" />
                        <AccordionPrimitive.Header className="flex items-center">
                          <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-5 text-base font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180">
                            <span className="flex items-center gap-3">
                              {section.title}
                              {moduleTarget && (
                                <Badge variant="outline" className="text-xs">
                                  Editable
                                </Badge>
                              )}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                          </AccordionPrimitive.Trigger>
                          {moduleTarget && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-3"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onEditSection(moduleTarget);
                              }}
                            >
                              Edit this section
                            </Button>
                          )}
                        </AccordionPrimitive.Header>
                        <AccordionContent className="pb-6">
                          <div className="rounded-lg bg-background/30 px-4 py-3">
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-p:leading-relaxed prose-p:my-3 prose-li:my-1.5 prose-hr:my-6">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h3: ({ children }) => {
                                    const text = getHeadingText(children);
                                    const id = slugifyHeading(text);
                                    return <h3 id={id} className="mt-6 mb-2">{children}</h3>;
                                  },
                                  h4: ({ children }) => {
                                    const text = getHeadingText(children);
                                    const id = slugifyHeading(text);
                                    return <h4 id={id} className="mt-5 mb-2">{children}</h4>;
                                  },
                                  p: ({ children }) => {
                                    const preserveLines = nodeHasLineBreaks(children);
                                    return (
                                      <p className={`text-sm leading-relaxed ${preserveLines ? "whitespace-pre-line" : ""}`}>
                                        {highlightNodes(children, searchQuery)}
                                      </p>
                                    );
                                  },
                                  li: ({ children }) => (
                                    <li className="text-sm leading-relaxed">
                                      {highlightNodes(children, searchQuery)}
                                    </li>
                                  ),
                                  hr: () => <hr className="my-6 border-border/60" />,
                                  table: ({ children }) => (
                                    <div className="my-4 overflow-x-auto rounded-lg border border-border/60 bg-background/40">
                                      <table className="w-full border-collapse text-sm">{children}</table>
                                    </div>
                                  ),
                                  thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
                                  th: ({ children }) => (
                                    <th className="px-3 py-2 text-left font-semibold text-foreground border-b border-border/60">
                                      {children}
                                    </th>
                                  ),
                                  td: ({ children }) => (
                                    <td className="px-3 py-2 align-top border-b border-border/40 text-muted-foreground">
                                      {children}
                                    </td>
                                  ),
                                  tr: ({ children }) => <tr className="hover:bg-muted/20">{children}</tr>,
                                }}
                              >
                                {section.content}
                              </ReactMarkdown>
                            </div>
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
  const navigate = useNavigate();
  const view = (searchParams.get("strategy_view") as ViewMode) ?? "document";
  const [instruction, setInstruction] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [generationPhase, setGenerationPhase] = useState<string | null>(null);
  const uploadInputId = `strategy-upload-${clientId}`;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [requirements, setRequirements] = useState<{
    code?: string;
    message: string;
    deepLink?: string;
    missingFields?: string[];
    questions?: string[];
  } | null>(null);
  const { toast } = useToast();

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

  const getCtaLabel = (code?: string, missingFields?: string[]) => {
    if (Array.isArray(missingFields) && missingFields.includes("memory_context")) {
      return "Upload client files";
    }
    if (code === "AGENCY_BRAIN_INCOMPLETE") {
      return "Complete AI Setup";
    }
    return "Fix Now";
  };

  const showGenerateErrorToast = (error: unknown, title: string) => {
    const err = error as any;
    const message = err instanceof Error ? err.message : "Unknown error";
    const deepLink = typeof err?.deepLink === "string" ? (err.deepLink as string) : undefined;
    const code = typeof err?.code === "string" ? (err.code as string) : undefined;
    const missingFields = Array.isArray(err?.missingFields) ? (err.missingFields as string[]) : undefined;
    const questions = Array.isArray(err?.questions) ? (err.questions as string[]) : undefined;
    const ctaLabel = getCtaLabel(code, missingFields);

    if (code || deepLink || missingFields?.length || questions?.length) {
      setRequirements({ code, message, deepLink, missingFields, questions });
      setRequirementsOpen(true);
    }

    // Keep expected setup/readiness failures out of error-level console noise.
    const expectedReadinessError =
      code === "AGENCY_BRAIN_INCOMPLETE" ||
      code === "BRAIN_INCOMPLETE" ||
      code === "MISSING_DOCUMENT";
    if (!expectedReadinessError) {
      console.error(title, error);
    }

    toast({
      title,
      description: code ? `${message} (code: ${code})` : message,
      variant: "destructive",
      action: deepLink ? (
        <ToastAction altText={ctaLabel} onClick={() => navigate(deepLink)}>
          {ctaLabel}
        </ToastAction>
      ) : undefined,
    });
  };

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
    setGenerationPhase("Preparing context...");

    const phases = [
      { delay: 5000, text: "Analyzing brand positioning..." },
      { delay: 15000, text: "Building content strategy..." },
      { delay: 30000, text: "Generating pillars and campaigns..." },
      { delay: 60000, text: "Finalizing strategy document..." },
    ];

    const timers = phases.map(({ delay, text }) => setTimeout(() => setGenerationPhase(text), delay));
    try {
      await generateDocument.mutateAsync({ clientId });
      toast({
        title: "Strategy generated",
        description: "Your strategy document is ready.",
      });
    } catch (error) {
      showGenerateErrorToast(error, "Failed to generate strategy");
    } finally {
      timers.forEach(clearTimeout);
      setGenerationPhase(null);
    }
  };

  const handleRegenerate = async () => {
    setGenerationPhase("Preparing context...");

    const phases = [
      { delay: 5000, text: "Analyzing brand positioning..." },
      { delay: 15000, text: "Building content strategy..." },
      { delay: 30000, text: "Generating pillars and campaigns..." },
      { delay: 60000, text: "Finalizing strategy document..." },
    ];

    const timers = phases.map(({ delay, text }) => setTimeout(() => setGenerationPhase(text), delay));
    try {
      await generateDocument.mutateAsync({ clientId, instruction: instruction.trim() || undefined });
      setInstruction("");
      toast({
        title: "Strategy updated",
        description: "Your strategy document was regenerated.",
      });
    } catch (error) {
      showGenerateErrorToast(error, "Failed to regenerate strategy");
    } finally {
      timers.forEach(clearTimeout);
      setGenerationPhase(null);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      await uploadDocument.mutateAsync({ clientId, agencyId, file });
      toast({
        title: "Uploaded",
        description: "Strategy document uploaded and set active.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
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
          generationPhase={generationPhase}
          isUploading={uploadDocument.isPending}
        />
      </div>

      {requirementsOpen && requirements && (
        <Dialog open={requirementsOpen} onOpenChange={setRequirementsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {requirements.code === "AGENCY_BRAIN_INCOMPLETE"
                  ? "AI Setup Required"
                  : requirements.code === "BRAIN_INCOMPLETE"
                    ? Array.isArray(requirements.missingFields) && requirements.missingFields.includes("memory_context")
                      ? "Client Knowledge Required"
                      : "Client Profile Required"
                    : "Action Required"}
              </DialogTitle>
              <DialogDescription>{requirements.message}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {requirements.code ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Error code</span>
                  <Badge variant="outline">{requirements.code}</Badge>
                </div>
              ) : null}

              {requirements.questions?.length ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium">What to do</div>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {requirements.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {requirements.missingFields?.length ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium">Missing requirements</div>
                  <div className="flex flex-wrap gap-2">
                    {requirements.missingFields.map((field) => (
                      <Badge key={field} variant="secondary">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setRequirementsOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRequirementsOpen(false);
                    handleGenerate();
                  }}
                >
                  Retry
                </Button>
                {requirements.deepLink ? (
                  <Button
                    onClick={() => {
                      setRequirementsOpen(false);
                      navigate(requirements.deepLink!);
                    }}
                  >
                    {getCtaLabel(requirements.code, requirements.missingFields)}
                  </Button>
                ) : null}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
