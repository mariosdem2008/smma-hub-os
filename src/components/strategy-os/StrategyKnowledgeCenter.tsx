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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { useStrategyDocuments, useGenerateStrategyDocument, useUploadStrategyDocument, useActivateStrategyDocument } from "@/hooks/useStrategyDocuments";
import { useStrategies } from "@/hooks/useStrategies";
import { useStrategyModules } from "@/hooks/useStrategyModules";
import { useLatestClientOperatingBriefV2, useLatestStrategyArtifactsV2, useReviewStrategyArtifactV2, useStrategyArtifactApprovalsV2 } from "@/hooks/useStrategyV2";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import {
  useAgencyMemberOptions,
  useClientExecutionTasks,
  useClientEnrichmentQueue,
  useClientOperationEvents,
  useClientOperationsChecklist,
  useClientOperationsSetup,
  useRefreshClientEnrichmentQueue,
  useUpdateClientOperationsChecklistItem,
  useUpdateClientExecutionTask,
} from "@/hooks/useClientOperations";
import StrategyOSV3 from "@/components/strategy-os/StrategyOSV3";
import type { StrategyDocumentRecord, StrategyModule } from "@/lib/strategy/types";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { formatOnboardingFieldLabel } from "@/lib/onboarding/stagedReadiness";
import { buildOperationsChecklist } from "@/lib/onboarding/operationsChecklist";
import { formatDecisionLabel } from "@/lib/strategy/v2/approvals";

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

const CHECKLIST_OWNER_OPTIONS = [
  { value: "client", label: "Client" },
  { value: "agency", label: "Agency" },
  { value: "shared", label: "Shared" },
] as const;

function formatChecklistStatus(status: string) {
  switch (status) {
    case "done":
      return "Done";
    case "waiting_on_client":
      return "Waiting on client";
    case "in_progress":
      return "In progress";
    case "blocked":
      return "Blocking";
    case "complete":
      return "Complete";
    default:
      return "Recommended";
  }
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  try {
    return format(new Date(value), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

function formatOperationEventLabel(kind: string) {
  switch (kind) {
    case "task_created":
      return "Task created";
    case "task_updated":
      return "Task updated";
    case "task_resolved":
      return "Task resolved";
    case "task_cancelled":
      return "Task cancelled";
    case "queue_refreshed":
      return "Queue refreshed";
    case "drift_detected":
      return "Drift detected";
    default:
      return kind.replace(/_/g, " ");
  }
}

function formatReadinessStateLabel(state: string | null | undefined) {
  switch (state) {
    case "insufficient":
      return "Insufficient context";
    case "diagnosis_ready":
      return "Diagnosis ready";
    case "strategy_ready_with_caveats":
      return "Strategy ready with caveats";
    case "strategy_ready":
      return "Strategy ready";
    case "execution_ready":
      return "Execution ready";
    default:
      return "Unknown readiness";
  }
}

function resolveMemberLabel(
  userId: string | null | undefined,
  labelsByUserId: Map<string, string>,
) {
  if (!userId) return null;
  return labelsByUserId.get(userId) ?? userId;
}

type StagedReadiness = {
  state?: "draft_started" | "setup_usable" | "execution_ready" | "strategy_enriched";
  essential_intake?: { percent?: number; missing?: string[] };
  operations_setup?: { percent?: number; missing?: string[] };
  progressive_enrichment?: { percent?: number; missing?: string[] };
};

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
        <mark key={`${part}-${index}`} className="bg-warning/20 text-foreground rounded px-0.5">
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
  const strategyGenerating = searchParams.get("handoff") === "strategy_generating";
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
  const { data: onboardingProfile } = useOnboardingProfile(clientId);
  const { data: latestBriefV2 } = useLatestClientOperatingBriefV2(clientId);
  const { data: latestArtifactsV2 = [] } = useLatestStrategyArtifactsV2(clientId);
  const { data: artifactApprovalsV2 = [] } = useStrategyArtifactApprovalsV2(clientId);
  const reviewStrategyArtifact = useReviewStrategyArtifactV2();
  const { data: agencyMembers = [] } = useAgencyMemberOptions(agencyId);
  const { data: operationsSetupRecord } = useClientOperationsSetup(clientId);
  const { data: operationsChecklistItems = [] } = useClientOperationsChecklist(clientId);
  const { data: executionTasks = [] } = useClientExecutionTasks(clientId);
  const { data: operationEvents = [] } = useClientOperationEvents(clientId);
  const { data: enrichmentQueue = [] } = useClientEnrichmentQueue(clientId);
  const refreshEnrichmentQueue = useRefreshClientEnrichmentQueue();
  const updateChecklistItem = useUpdateClientOperationsChecklistItem();
  const updateExecutionTask = useUpdateClientExecutionTask();
  const [taskResolutionNotes, setTaskResolutionNotes] = useState<Record<string, string>>({});
  const [recommendationReviewNote, setRecommendationReviewNote] = useState("");
  const [planReviewNote, setPlanReviewNote] = useState("");

  const { data: documents = [] } = useStrategyDocuments(clientId);
  const activeDocument = documents.find((doc) => doc.is_active) ?? documents[0] ?? null;
  const stagedReadiness = ((onboardingProfile?.v5_meta as Record<string, unknown> | null)?.staged_readiness ?? null) as StagedReadiness | null;
  const operationsChecklist = buildOperationsChecklist(onboardingProfile ?? null);
  const checklistSections = useMemo(() => {
    if (operationsChecklistItems.length === 0) return [];
    const titleMap: Record<string, string> = {
      contacts_approvals: "Contacts and approvals",
      delivery_readiness: "Delivery readiness",
      production_inputs: "Production inputs",
    };
    return Object.entries(
      operationsChecklistItems.reduce<Record<string, typeof operationsChecklistItems>>((acc, item) => {
        acc[item.section_key] = [...(acc[item.section_key] ?? []), item];
        return acc;
      }, {}),
    ).map(([sectionKey, items]) => ({
      sectionKey,
      title: titleMap[sectionKey] ?? sectionKey.replace(/_/g, " "),
      items: [...items].sort((a, b) => {
        const priorityRank = { high: 0, medium: 1, low: 2 } as const;
        const statusRank = { blocked: 0, waiting_on_client: 1, in_progress: 2, todo: 3, done: 4 } as const;
        const statusDelta = statusRank[a.status] - statusRank[b.status];
        if (statusDelta !== 0) return statusDelta;
        const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDelta !== 0) return priorityDelta;
        return a.title.localeCompare(b.title);
      }),
    }));
  }, [operationsChecklistItems]);
  const sortedQueue = useMemo(() => {
    const priorityRank = { high: 0, medium: 1, low: 2 } as const;
    return [...enrichmentQueue].sort((a, b) => {
      const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [enrichmentQueue]);
  const assigneeLabelByUserId = useMemo(
    () =>
      new Map(
        agencyMembers.map((member) => [
          member.user_id,
          member.profile?.full_name || member.profile?.email || member.user_id,
        ]),
      ),
    [agencyMembers],
  );
  const activeExecutionTasks = useMemo(() => {
    const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
    const statusRank = { blocked: 0, waiting_on_client: 1, in_progress: 2, todo: 3, done: 4, cancelled: 5 } as const;
    return [...executionTasks]
      .filter((task) => task.status !== "cancelled")
      .sort((a, b) => {
        const statusDelta = statusRank[a.status] - statusRank[b.status];
        if (statusDelta !== 0) return statusDelta;
        const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDelta !== 0) return priorityDelta;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [executionTasks]);

  const { data: strategies = [] } = useStrategies(clientId);
  const activeStrategy = strategies[0];
  const { data: modules = [] } = useStrategyModules(clientId, activeStrategy?.id);
  const latestReadinessArtifact = latestArtifactsV2.find((artifact) => artifact.artifact_type === "strategy_readiness_audit");
  const latestDiagnosisArtifact = latestArtifactsV2.find((artifact) => artifact.artifact_type === "strategy_diagnosis");
  const latestRecommendationArtifact = latestArtifactsV2.find((artifact) => artifact.artifact_type === "strategy_recommendation");
  const latestStrategyPlanArtifact = latestArtifactsV2.find((artifact) => artifact.artifact_type === "strategy_plan_v2");
  const latestCreatorBriefArtifact = latestArtifactsV2.find((artifact) => artifact.artifact_type === "creator_brief");
  const latestRecommendationApproval = useMemo(() => {
    if (!latestRecommendationArtifact) return null;
    return artifactApprovalsV2.find((approval) => approval.artifact_id === latestRecommendationArtifact.id) ?? null;
  }, [artifactApprovalsV2, latestRecommendationArtifact]);
  const latestPlanApproval = useMemo(() => {
    if (!latestStrategyPlanArtifact) return null;
    return artifactApprovalsV2.find((approval) => approval.artifact_id === latestStrategyPlanArtifact.id) ?? null;
  }, [artifactApprovalsV2, latestStrategyPlanArtifact]);

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

  const handleRecommendationReview = async (decision: "approved" | "rejected" | "changes_requested") => {
    if (!latestRecommendationArtifact) return;
    try {
      await reviewStrategyArtifact.mutateAsync({
        artifactId: latestRecommendationArtifact.id,
        clientId,
        agencyId,
        approvalStage: "strategy_recommendation",
        decision,
        note: recommendationReviewNote,
      });
      toast({
        title: `Recommendation ${formatDecisionLabel(decision).toLowerCase()}`,
        description:
          decision === "approved"
            ? "The recommendation is now approved for downstream workflows."
            : decision === "changes_requested"
              ? "The recommendation is back in review with requested changes."
              : "The recommendation is rejected and should not drive downstream workflows.",
      });
      setRecommendationReviewNote("");
    } catch (error) {
      showGenerateErrorToast(error, "Failed to update recommendation review");
    }
  };

  const handlePlanReview = async (decision: "approved" | "rejected" | "changes_requested") => {
    if (!latestStrategyPlanArtifact) return;
    try {
      await reviewStrategyArtifact.mutateAsync({
        artifactId: latestStrategyPlanArtifact.id,
        clientId,
        agencyId,
        approvalStage: "strategy_plan_v2",
        decision,
        note: planReviewNote,
      });
      toast({
        title: `Strategy plan ${formatDecisionLabel(decision).toLowerCase()}`,
        description:
          decision === "approved"
            ? "The strategy plan is now approved for downstream workflows."
            : decision === "changes_requested"
              ? "The strategy plan is back in review with requested changes."
              : "The strategy plan is rejected and should not drive downstream workflows.",
      });
      setPlanReviewNote("");
    } catch (error) {
      showGenerateErrorToast(error, "Failed to update strategy plan review");
    }
  };

  const navigateFromQueueItem = (item: typeof sortedQueue[number]) => {
    if (item.stage === "progressive_enrichment" || item.stage === "operations_setup" || item.stage === "essential_intake") {
      navigate(`/onboarding/client/${clientId}?stage=${item.stage}`);
      return;
    }

    const module = typeof item.metadata?.module === "string" ? item.metadata.module : null;
    if (module) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("strategy_view", "details");
      nextParams.set("strategy_module", module);
      setSearchParams(nextParams, { replace: true });
      return;
    }

    navigate(`/clients/${clientId}?tab=strategy`);
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
      {(latestBriefV2 || latestReadinessArtifact || latestDiagnosisArtifact || latestRecommendationArtifact || latestStrategyPlanArtifact || latestCreatorBriefArtifact) && (
        <Card className="border border-border/60 bg-card/50">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Strategy Engine V2</h2>
                <p className="text-sm text-muted-foreground">
                  Readiness, diagnosis, and recommendation artifacts now back strategy generation.
                </p>
              </div>
              {latestBriefV2 && (
                <Badge variant="secondary">
                  {formatReadinessStateLabel(latestBriefV2.readiness_state)}
                </Badge>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Brief</div>
                <div className="mt-1 text-sm font-medium">
                  {latestBriefV2 ? `v${latestBriefV2.version}` : "Not created"}
                </div>
                {latestBriefV2 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Confidence {latestBriefV2.confidence ?? 0}/100
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Diagnosis</div>
                <div className="mt-1 text-sm font-medium">
                  {latestDiagnosisArtifact ? latestDiagnosisArtifact.status : "Not created"}
                </div>
                {latestDiagnosisArtifact && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Confidence {latestDiagnosisArtifact.confidence ?? 0}/100
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Recommendation</div>
                <div className="mt-1 text-sm font-medium">
                  {latestRecommendationArtifact ? latestRecommendationArtifact.status : "Not created"}
                </div>
                {latestRecommendationArtifact && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Confidence {latestRecommendationArtifact.confidence ?? 0}/100
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Strategy plan</div>
                <div className="mt-1 text-sm font-medium">
                  {latestStrategyPlanArtifact ? latestStrategyPlanArtifact.status : "Not created"}
                </div>
                {latestStrategyPlanArtifact && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Confidence {latestStrategyPlanArtifact.confidence ?? 0}/100
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Creator brief</div>
                <div className="mt-1 text-sm font-medium">
                  {latestCreatorBriefArtifact ? latestCreatorBriefArtifact.status : "Not created"}
                </div>
                {latestCreatorBriefArtifact && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Confidence {latestCreatorBriefArtifact.confidence ?? 0}/100
                  </div>
                )}
              </div>
            </div>

            {latestReadinessArtifact && Array.isArray(latestReadinessArtifact.open_questions) && latestReadinessArtifact.open_questions.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                <div className="text-sm font-medium">Open questions</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {latestReadinessArtifact.open_questions.slice(0, 3).join(" | ")}
                </div>
              </div>
            )}

            {latestRecommendationArtifact && (
              <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Recommendation approval</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Treat recommendation approval as the strategist checkpoint before downstream creator and delivery workflows rely on it.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={
                        latestRecommendationArtifact.status === "approved"
                          ? "default"
                          : latestRecommendationArtifact.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {latestRecommendationArtifact.status === "approved"
                        ? "Approved for downstream use"
                        : latestRecommendationArtifact.status === "rejected"
                          ? "Rejected"
                          : "Awaiting review"}
                    </Badge>
                    <Badge variant="outline">{formatDecisionLabel(latestRecommendationApproval?.decision)}</Badge>
                  </div>
                </div>

                {latestRecommendationApproval?.created_at && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Last review: {format(new Date(latestRecommendationApproval.created_at), "MMM d, yyyy h:mm a")}
                    {latestRecommendationApproval.note ? ` | ${latestRecommendationApproval.note}` : ""}
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review note</div>
                  <Textarea
                    value={recommendationReviewNote}
                    onChange={(event) => setRecommendationReviewNote(event.target.value)}
                    placeholder="Record approval rationale, requested changes, or rejection reason."
                    className="min-h-[88px] bg-background/80"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleRecommendationReview("approved")}
                    disabled={reviewStrategyArtifact.isPending}
                  >
                    Approve recommendation
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRecommendationReview("changes_requested")}
                    disabled={reviewStrategyArtifact.isPending}
                  >
                    Request changes
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleRecommendationReview("rejected")}
                    disabled={reviewStrategyArtifact.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}

            {latestStrategyPlanArtifact && (
              <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Strategy plan approval</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      The published plan should be explicitly approved before downstream creator briefs or delivery workflows use it as the operating source of truth.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={
                        latestStrategyPlanArtifact.status === "approved"
                          ? "default"
                          : latestStrategyPlanArtifact.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {latestStrategyPlanArtifact.status === "approved"
                        ? "Plan approved"
                        : latestStrategyPlanArtifact.status === "rejected"
                          ? "Plan rejected"
                          : "Plan pending review"}
                    </Badge>
                    <Badge variant="outline">{formatDecisionLabel(latestPlanApproval?.decision)}</Badge>
                  </div>
                </div>

                {latestPlanApproval?.created_at && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Last review: {format(new Date(latestPlanApproval.created_at), "MMM d, yyyy h:mm a")}
                    {latestPlanApproval.note ? ` | ${latestPlanApproval.note}` : ""}
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review note</div>
                  <Textarea
                    value={planReviewNote}
                    onChange={(event) => setPlanReviewNote(event.target.value)}
                    placeholder="Capture final plan approval rationale, change requests, or rejection reason."
                    className="min-h-[88px] bg-background/80"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => handlePlanReview("approved")}
                    disabled={reviewStrategyArtifact.isPending}
                  >
                    Approve plan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handlePlanReview("changes_requested")}
                    disabled={reviewStrategyArtifact.isPending}
                  >
                    Request plan changes
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handlePlanReview("rejected")}
                    disabled={reviewStrategyArtifact.isPending}
                  >
                    Reject plan
                  </Button>
                </div>
              </div>
            )}

            {latestCreatorBriefArtifact && (
              <div className="rounded-lg border border-success/25 bg-success/10 p-3">
                <div className="text-sm font-medium">Latest creator brief</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {typeof latestCreatorBriefArtifact.content_json?.summary === "string"
                    ? latestCreatorBriefArtifact.content_json.summary
                    : "A creator brief has been generated from the approved recommendation and strategy plan for downstream content workflows."}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-info/30 bg-info/10 p-3">
              <div className="text-sm font-medium">Downstream readiness</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {latestRecommendationArtifact?.status === "approved" && latestStrategyPlanArtifact?.status === "approved"
                  ? latestCreatorBriefArtifact
                    ? "Recommendation, plan, and creator brief are in place. Downstream content generation can rely on canonical V2 context."
                    : "Recommendation and plan are approved. The next content generation run will derive a creator brief from the approved V2 artifacts."
                  : "Downstream creator workflows should remain blocked until both the recommendation and strategy plan are explicitly approved."}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
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

      {stagedReadiness && stagedReadiness.state !== "strategy_enriched" && (
        <Card className="border-border/60 bg-background/60">
          <CardContent className="space-y-4 p-4">
            <div>
              <h2 className="text-base font-semibold">Client setup status</h2>
              <p className="text-sm text-muted-foreground">
                Essential intake is now separate from execution setup and deeper profile enrichment.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Essential intake</div>
                <div className="mt-1 text-lg font-semibold">{stagedReadiness.essential_intake?.percent ?? 0}%</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {(stagedReadiness.essential_intake?.missing ?? []).length} open item(s)
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operations setup</div>
                <div className="mt-1 text-lg font-semibold">{stagedReadiness.operations_setup?.percent ?? 0}%</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {(stagedReadiness.operations_setup?.missing ?? []).length} open item(s)
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile enrichment</div>
                <div className="mt-1 text-lg font-semibold">{stagedReadiness.progressive_enrichment?.percent ?? 0}%</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {(stagedReadiness.progressive_enrichment?.missing ?? []).length} open item(s)
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(stagedReadiness.operations_setup?.missing ?? []).length > 0 && (
                <div className="w-full rounded-lg border border-border/60 bg-background/30 p-3 text-sm">
                  <div className="font-medium">Still needed for execution</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(stagedReadiness.operations_setup?.missing ?? []).map((field) => (
                      <Badge key={field} variant="secondary">
                        {formatOnboardingFieldLabel(field)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {(stagedReadiness.operations_setup?.missing ?? []).length > 0 && (
                <Button variant="outline" onClick={() => navigate(`/onboarding/client/${clientId}?stage=operations_setup`)}>
                  Continue setup
                </Button>
              )}
              {(stagedReadiness.progressive_enrichment?.missing ?? []).length > 0 && (
                <Button variant="outline" onClick={() => navigate(`/onboarding/client/${clientId}?stage=progressive_enrichment`)}>
                  Improve profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {stagedReadiness && (
        <Card className="border-border/60 bg-background/60">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Execution checklist</h2>
                <p className="text-sm text-muted-foreground">
                  Operational setup translated into concrete ownership and next actions.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {operationsSetupRecord?.setup_status && (
                  <Badge variant="outline">
                    Ops record: {operationsSetupRecord.setup_status.replace(/_/g, " ")}
                  </Badge>
                )}
                <Badge variant="outline">{operationsChecklist.summary.complete}/{operationsChecklist.summary.total} covered</Badge>
                {operationsChecklist.summary.blocked > 0 && (
                  <Badge variant="secondary">{operationsChecklist.summary.blocked} blocking</Badge>
                )}
                {operationsChecklist.summary.recommended > 0 && (
                  <Badge variant="secondary">{operationsChecklist.summary.recommended} recommended</Badge>
                )}
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              {(checklistSections.length > 0
                ? checklistSections.map((section) => ({
                    id: section.sectionKey,
                    title: section.title,
                    items: section.items,
                  }))
                : operationsChecklist.sections.map((section) => ({
                    id: section.id,
                    title: section.title,
                    items: section.items,
                  }))).map((section) => (
                <div key={section.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
                  <div className="text-sm font-medium text-foreground">{section.title}</div>
                  <div className="mt-3 space-y-2">
                    {section.items.map((entry) => (
                      <div key={entry.id} className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-foreground">{entry.title}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{entry.owner}</Badge>
                            <Badge variant={(entry as any).status === "done" || entry.status === "complete" ? "default" : "secondary"}>
                              {formatChecklistStatus((entry as any).status ?? entry.status)}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{entry.description}</div>
                        {entry.value && (
                          <div className="mt-2 text-xs text-foreground/90">Current: {entry.value}</div>
                        )}
                        {(entry as any).due_at && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Due: {format(new Date((entry as any).due_at), "MMM d, yyyy")}
                          </div>
                        )}
                        {entry.status !== "complete" && (entry as any).status !== "done" && (
                          <div className="mt-2 text-xs text-muted-foreground">Next: {entry.nextAction}</div>
                        )}
                        {"status" in entry && (entry as any).status && (
                          <div className="mt-3 space-y-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Owner
                                </div>
                                <Select
                                  value={(entry as any).owner}
                                  onValueChange={(owner) =>
                                    updateChecklistItem.mutate({
                                      itemId: (entry as any).id,
                                      clientId,
                                      status: (entry as any).status,
                                      owner: owner as "client" | "agency" | "shared",
                                    })
                                  }
                                  disabled={updateChecklistItem.isPending}
                                >
                                  <SelectTrigger className="h-8 bg-background/70 text-xs">
                                    <SelectValue placeholder="Assign owner" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CHECKLIST_OWNER_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value} className="text-xs">
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Due date
                                </div>
                                <Input
                                  type="date"
                                  className="h-8 bg-background/70 text-xs"
                                  value={toDateInputValue((entry as any).due_at)}
                                  onChange={(event) =>
                                    updateChecklistItem.mutate({
                                      itemId: (entry as any).id,
                                      clientId,
                                      status: (entry as any).status,
                                      owner: (entry as any).owner,
                                      dueAt: event.target.value ? new Date(`${event.target.value}T12:00:00.000Z`).toISOString() : null,
                                    })
                                  }
                                  disabled={updateChecklistItem.isPending}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {(entry as any).status !== "done" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateChecklistItem.mutate({
                                      itemId: (entry as any).id,
                                      clientId,
                                      status: "done",
                                      owner: (entry as any).owner,
                                      dueAt: (entry as any).due_at ?? null,
                                    })
                                  }
                                  disabled={updateChecklistItem.isPending}
                                >
                                  Mark done
                                </Button>
                              )}
                              {(entry as any).status === "done" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateChecklistItem.mutate({
                                      itemId: (entry as any).id,
                                      clientId,
                                      status: "in_progress",
                                      owner: (entry as any).owner,
                                      dueAt: (entry as any).due_at ?? null,
                                    })
                                  }
                                  disabled={updateChecklistItem.isPending}
                                >
                                  Reopen
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stagedReadiness && (
        <Card className="border-border/60 bg-background/60">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Execution task board</h2>
                <p className="text-sm text-muted-foreground">
                  Combined operational work across setup blockers and enrichment follow-ups.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">
                  {activeExecutionTasks.filter((task) => task.status !== "done").length} active
                </Badge>
                {activeExecutionTasks.some((task) => task.priority === "urgent") && (
                  <Badge variant="destructive">
                    {activeExecutionTasks.filter((task) => task.priority === "urgent").length} urgent
                  </Badge>
                )}
                {activeExecutionTasks.some((task) => task.status === "waiting_on_client") && (
                  <Badge variant="secondary">
                    {activeExecutionTasks.filter((task) => task.status === "waiting_on_client").length} waiting on client
                  </Badge>
                )}
              </div>
            </div>

            {activeExecutionTasks.length === 0 ? (
              <div className="rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                No active execution tasks. Setup blockers and enrichment items are currently under control.
              </div>
            ) : (
              <div className="space-y-3">
                {activeExecutionTasks.slice(0, 6).map((task) => (
                  <div key={task.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-medium text-foreground">{task.title}</div>
                          <Badge variant={task.priority === "urgent" ? "destructive" : task.priority === "high" ? "secondary" : "outline"}>
                            {task.priority}
                          </Badge>
                          <Badge variant="outline">{task.source_kind.replace(/_/g, " ")}</Badge>
                          <Badge variant={task.status === "done" ? "default" : "secondary"}>
                            {formatChecklistStatus(task.status)}
                          </Badge>
                        </div>
                        {task.description && (
                          <div className="mt-1 text-sm text-muted-foreground">{task.description}</div>
                        )}
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:max-w-xl">
                          <div className="space-y-1">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Owner
                            </div>
                            <Select
                              value={task.owner}
                              onValueChange={(owner) =>
                                updateExecutionTask.mutate({
                                  taskId: task.id,
                                  clientId,
                                  owner: owner as "client" | "agency" | "shared" | "system",
                                })
                              }
                              disabled={updateExecutionTask.isPending}
                            >
                              <SelectTrigger className="h-8 bg-background/70 text-xs">
                                <SelectValue placeholder="Assign owner" />
                              </SelectTrigger>
                              <SelectContent>
                                {[
                                  ...CHECKLIST_OWNER_OPTIONS,
                                  { value: "system", label: "System" },
                                ].map((option) => (
                                  <SelectItem key={option.value} value={option.value} className="text-xs">
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Due date
                            </div>
                            <Input
                              type="date"
                              className="h-8 bg-background/70 text-xs"
                              value={toDateInputValue(task.due_at)}
                              onChange={(event) =>
                                updateExecutionTask.mutate({
                                  taskId: task.id,
                                  clientId,
                                  dueAt: event.target.value ? new Date(`${event.target.value}T12:00:00.000Z`).toISOString() : null,
                                })
                              }
                              disabled={updateExecutionTask.isPending}
                            />
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:max-w-xl">
                          <div className="space-y-1">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Assignee
                            </div>
                            <Select
                              value={task.assignee_user_id ?? "__unassigned__"}
                              onValueChange={(value) =>
                                updateExecutionTask.mutate({
                                  taskId: task.id,
                                  clientId,
                                  assigneeUserId: value === "__unassigned__" ? null : value,
                                  clearAssignee: value === "__unassigned__",
                                })
                              }
                              disabled={updateExecutionTask.isPending}
                            >
                              <SelectTrigger className="h-8 bg-background/70 text-xs">
                                <SelectValue placeholder="Assign teammate" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__unassigned__" className="text-xs">
                                  Unassigned
                                </SelectItem>
                                {agencyMembers.map((member) => (
                                  <SelectItem key={member.user_id} value={member.user_id} className="text-xs">
                                    {member.profile?.full_name || member.profile?.email || member.user_id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Resolution note
                            </div>
                            <Input
                              value={taskResolutionNotes[task.id] ?? task.resolution_note ?? ""}
                              onChange={(event) =>
                                setTaskResolutionNotes((current) => ({
                                  ...current,
                                  [task.id]: event.target.value,
                                }))
                              }
                              placeholder="What happened, what changed, or why this closed"
                              className="h-8 bg-background/70 text-xs"
                              disabled={updateExecutionTask.isPending}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {task.status !== "done" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateExecutionTask.mutate({
                                taskId: task.id,
                                clientId,
                                status: task.status === "in_progress" ? "done" : "in_progress",
                                resolutionNote: task.status === "in_progress" ? (taskResolutionNotes[task.id] ?? task.resolution_note ?? null) : null,
                              })
                            }
                            disabled={updateExecutionTask.isPending}
                          >
                            {task.status === "in_progress" ? "Mark done" : "Start"}
                          </Button>
                        )}
                        {task.status === "done" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateExecutionTask.mutate({
                                taskId: task.id,
                                clientId,
                                status: "in_progress",
                                resolutionNote: null,
                              })
                            }
                            disabled={updateExecutionTask.isPending}
                          >
                            Reopen
                          </Button>
                        )}
                        {task.status !== "done" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateExecutionTask.mutate({
                                taskId: task.id,
                                clientId,
                                status: "cancelled",
                                resolutionNote: taskResolutionNotes[task.id] ?? task.resolution_note ?? null,
                              })
                            }
                            disabled={updateExecutionTask.isPending}
                          >
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 bg-background/60">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Progressive enrichment queue</h2>
              <p className="text-sm text-muted-foreground">
                Live follow-up queue generated from onboarding gaps, strategy open questions, blockers, and document drift.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshEnrichmentQueue.mutate({ clientId, reason: "manual_refresh" })}
              disabled={refreshEnrichmentQueue.isPending}
            >
              {refreshEnrichmentQueue.isPending ? "Refreshing..." : "Refresh queue"}
            </Button>
          </div>

          {sortedQueue.length === 0 ? (
            <div className="rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
              No active enrichment items. The current onboarding and strategy context are aligned.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedQueue.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-medium text-foreground">{item.title}</div>
                        <Badge variant={item.priority === "high" ? "destructive" : "secondary"}>
                          {item.priority}
                        </Badge>
                        <Badge variant="outline">{item.source_kind.replace(/_/g, " ")}</Badge>
                        <Badge variant="outline">{item.owner}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.prompt}</div>
                      {item.rationale && (
                        <div className="mt-2 text-xs text-muted-foreground">{item.rationale}</div>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigateFromQueueItem(item)}>
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-background/60">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Recent operations activity</h2>
              <p className="text-sm text-muted-foreground">
                Timeline of drift detection, queue refreshes, and execution task changes.
              </p>
            </div>
            <Badge variant="outline">{operationEvents.length} recent event{operationEvents.length === 1 ? "" : "s"}</Badge>
          </div>

          {operationEvents.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
              No operational events recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {operationEvents.slice(0, 8).map((event) => (
                <div key={event.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium text-foreground">
                        {formatOperationEventLabel(event.event_kind)}
                      </div>
                      <Badge variant="outline">{event.actor_kind}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(event.created_at), "MMM d, yyyy h:mm a")}
                    </div>
                  </div>
                  {typeof event.payload?.title === "string" && (
                    <div className="mt-1 text-sm text-foreground/90">{String(event.payload.title)}</div>
                  )}
                  {typeof event.payload?.reason === "string" && (
                    <div className="mt-1 text-xs text-muted-foreground">Reason: {String(event.payload.reason)}</div>
                  )}
                  {typeof event.payload?.next_status === "string" && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Status: {String(event.payload.previous_status ?? "unknown")} to {String(event.payload.next_status)}
                    </div>
                  )}
                  {(typeof event.payload?.next_assignee_user_id === "string" ||
                    typeof event.payload?.previous_assignee_user_id === "string") && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Assignee:{" "}
                      {resolveMemberLabel(
                        typeof event.payload?.previous_assignee_user_id === "string"
                          ? String(event.payload.previous_assignee_user_id)
                          : null,
                        assigneeLabelByUserId,
                      ) ?? "Unassigned"}{" "}
                      to{" "}
                      {resolveMemberLabel(
                        typeof event.payload?.next_assignee_user_id === "string"
                          ? String(event.payload.next_assignee_user_id)
                          : null,
                        assigneeLabelByUserId,
                      ) ?? "Unassigned"}
                    </div>
                  )}
                  {typeof event.payload?.resolution_note === "string" && String(event.payload.resolution_note).trim().length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Note: {String(event.payload.resolution_note)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
            {strategyGenerating ? (
              <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
            ) : (
              <FileText className="mb-4 h-12 w-12 text-muted-foreground/60" />
            )}
            <h3 className="text-lg font-medium">{strategyGenerating ? "Strategy generation in progress" : "No strategy document yet"}</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              {strategyGenerating
                ? "Onboarding has completed and the first strategy document is still being generated. Refresh in a moment or retry if this state persists."
                : "Generate a strategy document to make the Strategy tab the source of truth."}
            </p>
            {strategyGenerating ? (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Refresh status
                </Button>
                <Button onClick={handleGenerate} disabled={generateDocument.isPending}>
                  {generateDocument.isPending ? "Retrying..." : "Retry generation"}
                </Button>
              </div>
            ) : null}
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
