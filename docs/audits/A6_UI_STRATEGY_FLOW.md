# A6 — UI Strategy Flow Analysis (Current Truth)

## Purpose
Audit the Strategy UI flow end-to-end from the client detail Strategy tab: components, hooks, API calls, loading/error states, and how backend responses are surfaced to the user. This matters because a common failure mode has been “Generate Strategy does nothing”.

## Key Findings Summary
- Strategy UI calls `ai-strategy-generate` via `useGenerateStrategyDocument()` (`src/hooks/useStrategyDocuments.ts`).
- Backend gated responses (`unknown: true`) are now turned into thrown errors that reach the UI.
- UI catches generation errors and shows a destructive toast; when a `deep_link` is provided it renders a CTA (ToastAction) that navigates the user to the appropriate fix flow.
- Upload flow writes a `strategy_documents` row and attempts to upload to `strategy-documents` storage bucket; bucket setup is conditional on migrations being applied.
- Modules are displayed/edited via Strategy OS components and are refreshed after generation.

## Detailed Analysis
### Strategy tab components
- `StrategyHubTab.tsx` is the entry for the client Strategy area (see full file evidence).
- `StrategyKnowledgeCenter.tsx` provides document-centric UX: generate/regenerate, upload, history, and viewing.

### Hooks
- `useStrategyDocuments.ts`:
  - Reads `strategy_documents` for client.
  - Calls edge function `ai-strategy-generate` and enforces response handling.
- `useStrategyModules.ts`:
  - Fetches `strategy_modules` for the current strategy.
  - Provides separate “Generate strategy” hook used by module UI paths (now without template fallbacks for missing API keys).

### Error handling
- Gated response (`unknown: true`) → throw error with a user-visible message and carry `code` + `deepLink` fields.
- 500 `MISSING_API_KEY` → special-case error message instructing admin configuration.

### Loading states
- Generation button shows “Building…” / “Regenerating…” while mutation is in-flight.

## Code Evidence
### Full UI files (line-numbered): Strategy hub, knowledge center, hooks

```text
=== src/components/client-tabs/StrategyHubTab.tsx ===
    1: import StrategyKnowledgeCenter from "@/components/strategy-os/StrategyKnowledgeCenter";
    2: import type { ActiveView } from "@/lib/strategy/types";
    3: 
    4: interface StrategyHubTabProps {
    5:   clientId: string;
    6:   agencyId?: string;
    7:   client?: {
    8:     id: string;
    9:     name: string;
   10:     company: string | null;
   11:   };
   12:   activeView?: ActiveView;
   13:   onViewChange?: (view: ActiveView) => void;
   14: }
   15: 
   16: export default function StrategyHubTab({
   17:   clientId,
   18:   agencyId,
   19: }: StrategyHubTabProps) {
   20:   // If no agencyId, show a minimal error state
   21:   if (!agencyId) {
   22:     return (
   23:       <div className="flex items-center justify-center h-64">
   24:         <p className="text-sm text-muted-foreground">
   25:           Missing agency context for this client.
   26:         </p>
   27:       </div>
   28:     );
   29:   }
   30: 
   31:   return <StrategyKnowledgeCenter clientId={clientId} agencyId={agencyId} />;
   32: }

=== src/components/strategy-os/StrategyKnowledgeCenter.tsx ===
    1: import { useMemo, useState } from "react";
    2: import type { ReactElement, ReactNode } from "react";
    3: import { useNavigate, useSearchParams } from "react-router-dom";
    4: import ReactMarkdown from "react-markdown";
    5: import remarkGfm from "remark-gfm";
    6: import { format } from "date-fns";
    7: import { renderToStaticMarkup } from "react-dom/server";
    8: import { FileText, Download, UploadCloud, History, ArrowLeft, RotateCcw, Search } from "lucide-react";
    9: import { Button } from "@/components/ui/button";
   10: import { Input } from "@/components/ui/input";
   11: import { Badge } from "@/components/ui/badge";
   12: import { Card, CardContent } from "@/components/ui/card";
   13: import { Separator } from "@/components/ui/separator";
   14: import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
   15: import { ScrollArea } from "@/components/ui/scroll-area";
   16: import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
   17: import { useStrategyDocuments, useGenerateStrategyDocument, useUploadStrategyDocument, useActivateStrategyDocument } from "@/hooks/useStrategyDocuments";
   18: import { useStrategies } from "@/hooks/useStrategies";
   19: import { useStrategyModules } from "@/hooks/useStrategyModules";
   20: import StrategyOSV3 from "@/components/strategy-os/StrategyOSV3";
   21: import type { StrategyDocumentRecord, StrategyModule } from "@/lib/strategy/types";
   22: import { useToast } from "@/hooks/use-toast";
   23: import { ToastAction } from "@/components/ui/toast";
   24: 
   25: type ViewMode = "document" | "details";
   26: 
   27: const SECTION_TO_MODULE: Record<string, StrategyModule> = {
   28:   "icp objections triggers": "positioning",
   29:   "positioning proof": "positioning",
   30:   "pillars": "pillars",
   31:   "channel strategy": "channel_adaptations",
   32:   "campaign plan": "campaign_plan",
   33:   "weekly plan": "weekly_plan",
   34:   "creative rules claims policy": "rules_constraints",
   35: };
   36: 
   37: interface StrategyKnowledgeCenterProps {
   38:   clientId: string;
   39:   agencyId: string;
   40: }
   41: 
   42: function normalizeHeading(text: string) {
   43:   return text
   44:     .toLowerCase()
   45:     .replace(/[+]/g, " ")
   46:     .replace(/[^a-z0-9\s]/g, " ")
   47:     .replace(/\s+/g, " ")
   48:     .trim();
   49: }
   50: 
   51: function slugifyHeading(text: string) {
   52:   return normalizeHeading(text).replace(/\s+/g, "-");
   53: }
   54: 
   55: function parseSections(markdown: string) {
   56:   const lines = markdown.split(/\r?\n/);
   57:   let title = "";
   58:   const sections: Array<{ title: string; content: string }> = [];
   59:   let currentTitle = "";
   60:   let currentLines: string[] = [];
   61: 
   62:   for (const line of lines) {
   63:     if (!title && line.startsWith("# ")) {
   64:       title = line.replace(/^#\s+/, "").trim();
   65:       continue;
   66:     }
   67:     if (line.startsWith("## ")) {
   68:       if (currentTitle) {
   69:         sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
   70:       }
   71:       currentTitle = line.replace(/^##\s+/, "").trim();
   72:       currentLines = [];
   73:       continue;
   74:     }
   75:     currentLines.push(line);
   76:   }
   77: 
   78:   if (currentTitle) {
   79:     sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
   80:   }
   81: 
   82:   if (sections.length === 0 && markdown.trim()) {
   83:     sections.push({ title: "Strategy", content: markdown.trim() });
   84:   }
   85: 
   86:   return { title, sections };
   87: }
   88: 
   89: function highlightNodes(node: ReactNode, query: string): ReactNode {
   90:   if (!query) return node;
   91:   if (typeof node === "string") {
   92:     const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
   93:     const regex = new RegExp(`(${escaped})`, "ig");
   94:     const parts = node.split(regex);
   95:     return parts.map((part, index) =>
   96:       part.toLowerCase() === query.toLowerCase() ? (
   97:         <mark key={`${part}-${index}`} className="bg-yellow-300/40 text-foreground rounded px-0.5">
   98:           {part}
   99:         </mark>
  100:       ) : (
  101:         part
  102:       ),
  103:     );
  104:   }
  105:   if (Array.isArray(node)) {
  106:     return node.map((child, index) => (
  107:       <span key={index}>{highlightNodes(child, query)}</span>
  108:     ));
  109:   }
  110:   if (node && typeof node === "object" && "props" in node) {
  111:     const element = node as ReactElement;
  112:     return {
  113:       ...element,
  114:       props: { ...element.props, children: highlightNodes(element.props.children, query) },
  115:     };
  116:   }
  117:   return node;
  118: }
  119: 
  120: function getHeadingText(children: ReactNode): string {
  121:   if (typeof children === "string") return children;
  122:   if (Array.isArray(children)) {
  123:     return children.map(getHeadingText).join("");
  124:   }
  125:   if (children && typeof children === "object" && "props" in children) {
  126:     const element = children as ReactElement;
  127:     return getHeadingText(element.props.children);
  128:   }
  129:   return "";
  130: }
  131: 
  132: function DocumentHeaderActions({
  133:   hasDocument,
  134:   instruction,
  135:   onInstructionChange,
  136:   onGenerate,
  137:   onRegenerate,
  138:   onDownload,
  139:   onUploadClick,
  140:   onHistoryClick,
  141:   isGenerating,
  142:   isUploading,
  143: }: {
  144:   hasDocument: boolean;
  145:   instruction: string;
  146:   onInstructionChange: (value: string) => void;
  147:   onGenerate: () => void;
  148:   onRegenerate: () => void;
  149:   onDownload: () => void;
  150:   onUploadClick: () => void;
  151:   onHistoryClick: () => void;
  152:   isGenerating: boolean;
  153:   isUploading: boolean;
  154: }) {
  155:   if (!hasDocument) {
  156:     return (
  157:       <div className="flex flex-wrap items-center gap-2">
  158:         <Button onClick={onGenerate} disabled={isGenerating} className="gap-2">
  159:           <FileText className="h-4 w-4" />
  160:           {isGenerating ? "Building..." : "Strategy Builder"}
  161:         </Button>
  162:       </div>
  163:     );
  164:   }
  165: 
  166:   return (
  167:     <div className="flex flex-wrap items-center gap-2">
  168:       <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1">
  169:         <RotateCcw className="h-4 w-4 text-muted-foreground" />
  170:         <Input
  171:           value={instruction}
  172:           onChange={(event) => onInstructionChange(event.target.value.slice(0, 200))}
  173:           placeholder="Add instruction (max 200 chars)"
  174:           className="h-8 w-56 border-0 bg-transparent text-xs focus-visible:ring-0"
  175:           maxLength={200}
  176:         />
  177:         <Button size="sm" variant="secondary" onClick={onRegenerate} disabled={isGenerating}>
  178:           {isGenerating ? "Regenerating..." : "Regenerate"}
  179:         </Button>
  180:       </div>
  181:       <Button size="sm" variant="outline" onClick={onDownload} className="gap-2">
  182:         <Download className="h-4 w-4" />
  183:         Download PDF
  184:       </Button>
  185:       <Button size="sm" variant="outline" onClick={onUploadClick} disabled={isUploading} className="gap-2">
  186:         <UploadCloud className="h-4 w-4" />
  187:         {isUploading ? "Uploading..." : "Upload document"}
  188:       </Button>
  189:       <Button size="sm" variant="outline" onClick={onHistoryClick} className="gap-2">
  190:         <History className="h-4 w-4" />
  191:         History
  192:       </Button>
  193:     </div>
  194:   );
  195: }
  196: 
  197: function StatusStrip({ document }: { document: StrategyDocumentRecord }) {
  198:   const updatedAt = document.updated_at ? format(new Date(document.updated_at), "MMM d, yyyy h:mm a") : "Unknown";
  199:   const sourceLabel = document.source === "ai" ? "AI" : document.source === "upload" ? "Upload" : "Manual";
  200: 
  201:   return (
  202:     <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
  203:       <span>Last updated: {updatedAt}</span>
  204:       <Separator orientation="vertical" className="h-4" />
  205:       <span>Source: {sourceLabel}</span>
  206:       <Separator orientation="vertical" className="h-4" />
  207:       <span>Based on: Onboarding + Brain</span>
  208:       {document.model && (
  209:         <>
  210:           <Separator orientation="vertical" className="h-4" />
  211:           <span>Model: {document.model}</span>
  212:         </>
  213:       )}
  214:     </div>
  215:   );
  216: }
  217: 
  218: function StrategyDocumentView({
  219:   document,
  220:   onEditSection,
  221:   onViewDetails,
  222:   searchQuery,
  223:   onSearchChange,
  224: }: {
  225:   document: StrategyDocumentRecord;
  226:   onEditSection: (module: StrategyModule) => void;
  227:   onViewDetails: () => void;
  228:   searchQuery: string;
  229:   onSearchChange: (value: string) => void;
  230: }) {
  231:   const markdown = document.content_markdown ?? document.content_html ?? "";
  232:   const parsed = useMemo(() => parseSections(markdown), [markdown]);
  233:   const tocItems = parsed.sections.map((section) => ({
  234:     id: slugifyHeading(section.title),
  235:     title: section.title,
  236:   }));
  237: 
  238:   return (
  239:     <div className="space-y-4">
  240:       <StatusStrip document={document} />
  241:       <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
  242:         <aside className="hidden lg:block">
  243:           <div className="sticky top-4 space-y-4">
  244:             <div className="relative">
  245:               <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
  246:               <Input
  247:                 value={searchQuery}
  248:                 onChange={(event) => onSearchChange(event.target.value)}
  249:                 placeholder="Search in document"
  250:                 className="pl-8"
  251:               />
  252:             </div>
  253:             <div className="rounded-lg border border-border/60 bg-background/60 p-3">
  254:               <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
  255:                 Table of contents
  256:               </div>
  257:               <div className="space-y-2 text-sm">
  258:                 {tocItems.map((item) => (
  259:                   <button
  260:                     key={item.id}
  261:                     type="button"
  262:                     onClick={() => {
  263:                       const target = globalThis.document?.getElementById(item.id);
  264:                       target?.scrollIntoView({ behavior: "smooth", block: "start" });
  265:                     }}
  266:                     className="text-left text-muted-foreground hover:text-foreground transition-colors"
  267:                   >
  268:                     {item.title}
  269:                   </button>
  270:                 ))}
  271:               </div>
  272:             </div>
  273:           </div>
  274:         </aside>
  275: 
  276:         <div className="space-y-4">
  277:           <div className="flex flex-wrap items-center justify-between gap-3">
  278:             <div>
  279:               <h2 className="text-xl font-semibold">Strategy Document</h2>
  280:               <p className="text-sm text-muted-foreground">
  281:                 Readable strategy overview with linked edits.
  282:               </p>
  283:             </div>
  284:             <Button variant="secondary" onClick={onViewDetails}>
  285:               Strategy details
  286:             </Button>
  287:           </div>
  288:           <div className="relative lg:hidden">
  289:             <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
  290:             <Input
  291:               value={searchQuery}
  292:               onChange={(event) => onSearchChange(event.target.value)}
  293:               placeholder="Search in document"
  294:               className="pl-8"
  295:             />
  296:           </div>
  297: 
  298:           <Card className="border-border/60 bg-background/60">
  299:             <CardContent className="p-0">
  300:               <ScrollArea className="h-[70vh] px-4 py-6">
  301:                 {parsed.title && (
  302:                   <div className="prose prose-sm dark:prose-invert max-w-none">
  303:                     <h1>{parsed.title}</h1>
  304:                   </div>
  305:                 )}
  306:                 <Accordion type="multiple" defaultValue={tocItems.map((item) => item.id)}>
  307:                   {parsed.sections.map((section) => {
  308:                     const normalized = normalizeHeading(section.title);
  309:                     const moduleTarget = Object.entries(SECTION_TO_MODULE).find(([key]) =>
  310:                       normalized.includes(key),
  311:                     )?.[1];
  312:                     const anchorId = slugifyHeading(section.title);
  313: 
  314:                     return (
  315:                       <AccordionItem key={anchorId} value={anchorId} className="border-border/40">
  316:                         <div id={anchorId} className="scroll-mt-24" />
  317:                         <AccordionTrigger className="text-base">
  318:                           <span className="flex items-center gap-3">
  319:                             {section.title}
  320:                             {moduleTarget && (
  321:                               <Badge variant="outline" className="text-xs">
  322:                                 Editable
  323:                               </Badge>
  324:                             )}
  325:                           </span>
  326:                           {moduleTarget && (
  327:                             <Button
  328:                               size="sm"
  329:                               variant="ghost"
  330:                               className="ml-3"
  331:                               onClick={(event) => {
  332:                                 event.stopPropagation();
  333:                                 onEditSection(moduleTarget);
  334:                               }}
  335:                             >
  336:                               Edit this section
  337:                             </Button>
  338:                           )}
  339:                         </AccordionTrigger>
  340:                         <AccordionContent>
  341:                           <div className="prose prose-sm dark:prose-invert max-w-none">
  342:                             <ReactMarkdown
  343:                               remarkPlugins={[remarkGfm]}
  344:                               components={{
  345:                                 h3: ({ children }) => {
  346:                                   const text = getHeadingText(children);
  347:                                   const id = slugifyHeading(text);
  348:                                   return <h3 id={id}>{children}</h3>;
  349:                                 },
  350:                                 h4: ({ children }) => {
  351:                                   const text = getHeadingText(children);
  352:                                   const id = slugifyHeading(text);
  353:                                   return <h4 id={id}>{children}</h4>;
  354:                                 },
  355:                                 p: ({ children }) => (
  356:                                   <p className="text-sm leading-relaxed">
  357:                                     {highlightNodes(children, searchQuery)}
  358:                                   </p>
  359:                                 ),
  360:                                 li: ({ children }) => (
  361:                                   <li className="text-sm">
  362:                                     {highlightNodes(children, searchQuery)}
  363:                                   </li>
  364:                                 ),
  365:                               }}
  366:                             >
  367:                               {section.content}
  368:                             </ReactMarkdown>
  369:                           </div>
  370:                         </AccordionContent>
  371:                       </AccordionItem>
  372:                     );
  373:                   })}
  374:                 </Accordion>
  375:               </ScrollArea>
  376:             </CardContent>
  377:           </Card>
  378:         </div>
  379:       </div>
  380:     </div>
  381:   );
  382: }
  383: 
  384: export function StrategyKnowledgeCenter({ clientId, agencyId }: StrategyKnowledgeCenterProps) {
  385:   const [searchParams, setSearchParams] = useSearchParams();
  386:   const navigate = useNavigate();
  387:   const view = (searchParams.get("strategy_view") as ViewMode) ?? "document";
  388:   const [instruction, setInstruction] = useState("");
  389:   const [searchQuery, setSearchQuery] = useState("");
  390:   const uploadInputId = `strategy-upload-${clientId}`;
  391:   const [historyOpen, setHistoryOpen] = useState(false);
  392:   const { toast } = useToast();
  393: 
  394:   const { data: documents = [] } = useStrategyDocuments(clientId);
  395:   const activeDocument = documents.find((doc) => doc.is_active) ?? documents[0] ?? null;
  396: 
  397:   const { data: strategies = [] } = useStrategies(clientId);
  398:   const activeStrategy = strategies[0];
  399:   const { data: modules = [] } = useStrategyModules(clientId, activeStrategy?.id);
  400: 
  401:   const latestModuleUpdate = useMemo(() => {
  402:     if (modules.length === 0) return null;
  403:     return modules.reduce((latest, mod) => {
  404:       const next = mod.updated_at ? new Date(mod.updated_at).getTime() : 0;
  405:       return Math.max(latest, next);
  406:     }, 0);
  407:   }, [modules]);
  408: 
  409:   const docOutOfDate = useMemo(() => {
  410:     if (!activeDocument || !latestModuleUpdate) return false;
  411:     return new Date(activeDocument.updated_at).getTime() < latestModuleUpdate;
  412:   }, [activeDocument, latestModuleUpdate]);
  413: 
  414:   const generateDocument = useGenerateStrategyDocument();
  415:   const uploadDocument = useUploadStrategyDocument();
  416:   const activateDocument = useActivateStrategyDocument();
  417: 
  418:   const showGenerateErrorToast = (error: unknown, title: string) => {
  419:     const err = error as any;
  420:     const message = err instanceof Error ? err.message : "Unknown error";
  421:     const deepLink = typeof err?.deepLink === "string" ? (err.deepLink as string) : undefined;
  422:     const code = typeof err?.code === "string" ? (err.code as string) : undefined;
  423:     const ctaLabel = code === "AGENCY_BRAIN_INCOMPLETE" ? "Complete AI Setup" : "Complete profile";
  424: 
  425:     toast({
  426:       title,
  427:       description: message,
  428:       variant: "destructive",
  429:       action: deepLink ? (
  430:         <ToastAction altText={ctaLabel} onClick={() => navigate(deepLink)}>
  431:           {ctaLabel}
  432:         </ToastAction>
  433:       ) : undefined,
  434:     });
  435:   };
  436: 
  437:   const setView = (next: ViewMode) => {
  438:     const nextParams = new URLSearchParams(searchParams);
  439:     if (next === "document") {
  440:       nextParams.delete("strategy_view");
  441:     } else {
  442:       nextParams.set("strategy_view", next);
  443:     }
  444:     setSearchParams(nextParams, { replace: true });
  445:   };
  446: 
  447:   const handleEditSection = (module: StrategyModule) => {
  448:     const nextParams = new URLSearchParams(searchParams);
  449:     nextParams.set("strategy_view", "details");
  450:     nextParams.set("strategy_module", module);
  451:     setSearchParams(nextParams, { replace: true });
  452:   };
  453: 
  454:   const handleGenerate = async () => {
  455:     try {
  456:       await generateDocument.mutateAsync({ clientId });
  457:       toast({
  458:         title: "Strategy generated",
  459:         description: "Your strategy document is ready.",
  460:       });
  461:     } catch (error) {
  462:       showGenerateErrorToast(error, "Failed to generate strategy");
  463:     }
  464:   };
  465: 
  466:   const handleRegenerate = async () => {
  467:     try {
  468:       await generateDocument.mutateAsync({ clientId, instruction: instruction.trim() || undefined });
  469:       setInstruction("");
  470:       toast({
  471:         title: "Strategy updated",
  472:         description: "Your strategy document was regenerated.",
  473:       });
  474:     } catch (error) {
  475:       showGenerateErrorToast(error, "Failed to regenerate strategy");
  476:     }
  477:   };
  478: 
  479:   const handleUpload = async (file: File) => {
  480:     try {
  481:       await uploadDocument.mutateAsync({ clientId, agencyId, file });
  482:       toast({
  483:         title: "Uploaded",
  484:         description: "Strategy document uploaded and set active.",
  485:       });
  486:     } catch (error) {
  487:       toast({
  488:         title: "Upload failed",
  489:         description: error instanceof Error ? error.message : "Unknown error",
  490:         variant: "destructive",
  491:       });
  492:     }
  493:   };
  494: 
  495:   const handleDownload = () => {
  496:     if (!activeDocument?.content_markdown) return;
  497:     const htmlContent = renderToStaticMarkup(
  498:       <div className="strategy-print">
  499:         <ReactMarkdown remarkPlugins={[remarkGfm]}>
  500:           {activeDocument.content_markdown}
  501:         </ReactMarkdown>
  502:       </div>,
  503:     );
  504:     const html = `<!doctype html><html><head><title>Strategy Document</title>
  505:       <style>
  506:         body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  507:         h1, h2, h3 { margin-top: 24px; }
  508:         p { line-height: 1.6; }
  509:         ul { padding-left: 18px; }
  510:       </style>
  511:     </head><body>${htmlContent}</body></html>`;
  512:     const printWindow = window.open("", "_blank");
  513:     if (!printWindow) return;
  514:     printWindow.document.write(html);
  515:     printWindow.document.close();
  516:     printWindow.focus();
  517:     printWindow.print();
  518:   };
  519: 
  520:   if (view === "details") {
  521:     return (
  522:       <div className="space-y-4">
  523:         <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-3">
  524:           <Button variant="ghost" onClick={() => setView("document")} className="gap-2">
  525:             <ArrowLeft className="h-4 w-4" />
  526:             Back to document
  527:           </Button>
  528:           <div className="flex items-center gap-2">
  529:             {docOutOfDate && (
  530:               <Badge variant="secondary">Document out of date</Badge>
  531:             )}
  532:             <Button
  533:               size="sm"
  534:               variant="outline"
  535:               onClick={() =>
  536:                 generateDocument.mutateAsync({
  537:                   clientId,
  538:                   instruction:
  539:                     "Update the document to match latest strategy details; preserve structure and style.",
  540:                 })
  541:               }
  542:               disabled={generateDocument.isPending}
  543:             >
  544:               {generateDocument.isPending ? "Updating..." : "Update doc"}
  545:             </Button>
  546:           </div>
  547:         </div>
  548:         <StrategyOSV3 clientId={clientId} agencyId={agencyId} />
  549:       </div>
  550:     );
  551:   }
  552: 
  553:   return (
  554:     <div className="space-y-6">
  555:       <div className="flex flex-wrap items-center justify-between gap-3">
  556:         <div>
  557:           <h1 className="text-2xl font-semibold">Strategy Knowledge Center</h1>
  558:           <p className="text-sm text-muted-foreground">
  559:             Review the live strategy document or jump into details.
  560:           </p>
  561:         </div>
  562:         <DocumentHeaderActions
  563:           hasDocument={!!activeDocument}
  564:           instruction={instruction}
  565:           onInstructionChange={setInstruction}
  566:           onGenerate={handleGenerate}
  567:           onRegenerate={handleRegenerate}
  568:           onDownload={handleDownload}
  569:           onUploadClick={() => {
  570:             const input = document.getElementById(uploadInputId) as HTMLInputElement | null;
  571:             input?.click();
  572:           }}
  573:           onHistoryClick={() => setHistoryOpen(true)}
  574:           isGenerating={generateDocument.isPending}
  575:           isUploading={uploadDocument.isPending}
  576:         />
  577:       </div>
  578: 
  579:       <input
  580:         id={uploadInputId}
  581:         type="file"
  582:         accept=".pdf,.md,.txt,.doc,.docx"
  583:         className="hidden"
  584:         onChange={(event) => {
  585:           const file = event.target.files?.[0];
  586:           if (file) {
  587:             handleUpload(file);
  588:           }
  589:           event.currentTarget.value = "";
  590:         }}
  591:       />
  592: 
  593:       {historyOpen && (
  594:         <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
  595:         <DialogContent className="max-w-2xl">
  596:           <DialogHeader>
  597:             <DialogTitle>Document history</DialogTitle>
  598:             <DialogDescription>Activate a previous document to make it current.</DialogDescription>
  599:           </DialogHeader>
  600:             <div className="space-y-3">
  601:               {documents.length === 0 ? (
  602:                 <p className="text-sm text-muted-foreground">No documents yet.</p>
  603:               ) : (
  604:                 documents.map((doc) => {
  605:                   const updatedAt = doc.updated_at ? format(new Date(doc.updated_at), "MMM d, yyyy h:mm a") : "Unknown";
  606:                   return (
  607:                     <div
  608:                       key={doc.id}
  609:                       className="flex items-center justify-between rounded-md border border-border/60 bg-background/60 px-3 py-2"
  610:                     >
  611:                       <div>
  612:                         <div className="text-sm font-medium">Document</div>
  613:                         <div className="text-xs text-muted-foreground">
  614:                           {updatedAt} â€¢ {doc.source === "ai" ? "AI" : doc.source === "upload" ? "Upload" : "Manual"}
  615:                         </div>
  616:                       </div>
  617:                       <Button
  618:                         size="sm"
  619:                         variant={doc.id === activeDocument?.id ? "secondary" : "outline"}
  620:                         onClick={() => activateDocument.mutateAsync({ clientId, documentId: doc.id })}
  621:                       >
  622:                         {doc.id === activeDocument?.id ? "Active" : "Set active"}
  623:                       </Button>
  624:                     </div>
  625:                   );
  626:                 })
  627:               )}
  628:             </div>
  629:           </DialogContent>
  630:         </Dialog>
  631:       )}
  632: 
  633:       {!activeDocument ? (
  634:         <Card className="border-dashed border-border/60 bg-background/60">
  635:           <CardContent className="flex flex-col items-center justify-center py-16 text-center">
  636:             <FileText className="h-12 w-12 text-muted-foreground/60 mb-4" />
  637:             <h3 className="text-lg font-medium">No strategy document yet</h3>
  638:             <p className="text-sm text-muted-foreground mt-2 max-w-md">
  639:               Generate a strategy document to make the Strategy tab the source of truth.
  640:             </p>
  641:           </CardContent>
  642:         </Card>
  643:       ) : (
  644:         <StrategyDocumentView
  645:           document={activeDocument}
  646:           onEditSection={handleEditSection}
  647:           onViewDetails={() => setView("details")}
  648:           searchQuery={searchQuery}
  649:           onSearchChange={setSearchQuery}
  650:         />
  651:       )}
  652:     </div>
  653:   );
  654: }
  655: 
  656: export default StrategyKnowledgeCenter;

=== src/hooks/useStrategyDocuments.ts ===
    1: import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
    2: import { supabase } from "@/integrations/supabase/client";
    3: import type { StrategyDocumentRecord } from "@/lib/strategy/types";
    4: 
    5: async function readFunctionErrorPayload(error: unknown): Promise<{ code?: string; error?: string; message?: string } | null> {
    6:   if (!error || typeof error !== "object") return null;
    7:   const context = (error as { context?: Response }).context;
    8:   if (!context || typeof (context as any).json !== "function") return null;
    9:   try {
   10:     return (await (context as any).json()) as { code?: string; error?: string; message?: string };
   11:   } catch {
   12:     return null;
   13:   }
   14: }
   15: 
   16: export const strategyDocumentsKeys = {
   17:   all: ["strategy-documents"] as const,
   18:   byClient: (clientId: string) => [...strategyDocumentsKeys.all, clientId] as const,
   19: };
   20: 
   21: export function useStrategyDocuments(clientId: string | undefined) {
   22:   return useQuery({
   23:     queryKey: strategyDocumentsKeys.byClient(clientId ?? ""),
   24:     queryFn: async () => {
   25:       if (!clientId) return [];
   26:       const { data, error } = await supabase
   27:         .from("strategy_documents")
   28:         .select("*")
   29:         .eq("client_id", clientId)
   30:         .order("updated_at", { ascending: false });
   31: 
   32:       if (error) throw error;
   33:       return (data ?? []) as StrategyDocumentRecord[];
   34:     },
   35:     enabled: !!clientId,
   36:   });
   37: }
   38: 
   39: export function useActivateStrategyDocument() {
   40:   const queryClient = useQueryClient();
   41: 
   42:   return useMutation({
   43:     mutationFn: async ({ clientId, documentId }: { clientId: string; documentId: string }) => {
   44:       const { error: deactivateError } = await supabase
   45:         .from("strategy_documents")
   46:         .update({ is_active: false })
   47:         .eq("client_id", clientId);
   48: 
   49:       if (deactivateError) throw deactivateError;
   50: 
   51:       const { data, error } = await supabase
   52:         .from("strategy_documents")
   53:         .update({ is_active: true })
   54:         .eq("id", documentId)
   55:         .select()
   56:         .single();
   57: 
   58:       if (error) throw error;
   59:       return data as StrategyDocumentRecord;
   60:     },
   61:     onSuccess: (data) => {
   62:       queryClient.invalidateQueries({ queryKey: strategyDocumentsKeys.byClient(data.client_id) });
   63:     },
   64:   });
   65: }
   66: 
   67: export function useGenerateStrategyDocument() {
   68:   const queryClient = useQueryClient();
   69: 
   70:   return useMutation({
   71:     mutationFn: async ({
   72:       clientId,
   73:       instruction,
   74:     }: {
   75:       clientId: string;
   76:       instruction?: string;
   77:     }) => {
   78:       const { data, error } = await supabase.functions.invoke("ai-strategy-generate", {
   79:         body: { client_id: clientId, instruction },
   80:       });
   81: 
   82:       if (error) {
   83:         const payload = await readFunctionErrorPayload(error);
   84:         if (payload?.code === "MISSING_API_KEY") {
   85:           const err: any = new Error("AI service not configured. Contact your administrator.");
   86:           err.code = payload.code;
   87:           throw err;
   88:         }
   89:         throw error;
   90:       }
   91: 
   92:       if (data?.unknown === true) {
   93:         const code = typeof data?.code === "string" ? data.code : undefined;
   94:         const missingFields = Array.isArray(data?.missing_fields) ? (data.missing_fields as string[]) : undefined;
   95:         const question =
   96:           Array.isArray(data?.questions) && data.questions.length > 0 && typeof data.questions[0] === "string"
   97:             ? (data.questions[0] as string)
   98:             : undefined;
   99:         const message =
  100:           code === "BRAIN_INCOMPLETE" && missingFields?.length
  101:             ? `Complete client profile. Missing: ${missingFields.join(", ")}`
  102:             : question ?? "Strategy generation is blocked. Resolve missing requirements and retry.";
  103: 
  104:         const err: any = new Error(message);
  105:         err.code = code;
  106:         err.deepLink = typeof data?.deep_link === "string" ? data.deep_link : undefined;
  107:         err.missingFields = missingFields;
  108:         throw err;
  109:       }
  110: 
  111:       const document = (data?.document ?? null) as StrategyDocumentRecord | null;
  112:       if (!document) {
  113:         const err: any = new Error("Strategy generation did not return a document.");
  114:         err.code = "MISSING_DOCUMENT";
  115:         throw err;
  116:       }
  117: 
  118:       return { document };
  119:     },
  120:     onSuccess: (data) => {
  121:       if (!data?.document) return;
  122:       queryClient.invalidateQueries({
  123:         queryKey: strategyDocumentsKeys.byClient(data.document.client_id),
  124:       });
  125:     },
  126:   });
  127: }
  128: 
  129: export function useUploadStrategyDocument() {
  130:   const queryClient = useQueryClient();
  131: 
  132:   return useMutation({
  133:     mutationFn: async ({
  134:       clientId,
  135:       agencyId,
  136:       file,
  137:     }: {
  138:       clientId: string;
  139:       agencyId: string;
  140:       file: File;
  141:     }) => {
  142:       const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "txt";
  143:       const fileName = `${agencyId}/${clientId}/${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
  144: 
  145:       const { data: uploadData, error: uploadError } = await supabase.storage
  146:         .from("strategy-documents")
  147:         .upload(fileName, file, {
  148:           cacheControl: "3600",
  149:           upsert: false,
  150:         });
  151: 
  152:       if (uploadError && !uploadError.message.includes("Bucket not found")) {
  153:         throw uploadError;
  154:       }
  155: 
  156:       let contentMarkdown: string | null = null;
  157:       if (
  158:         file.type === "text/markdown" ||
  159:         file.type === "text/plain" ||
  160:         file.name.toLowerCase().endsWith(".md") ||
  161:         file.name.toLowerCase().endsWith(".txt")
  162:       ) {
  163:         contentMarkdown = await file.text();
  164:       }
  165: 
  166:       const { data: publicUrlData } = uploadData?.path
  167:         ? supabase.storage.from("strategy-documents").getPublicUrl(uploadData.path)
  168:         : { data: null };
  169: 
  170:       if (!contentMarkdown) {
  171:         const link = publicUrlData?.publicUrl ? `\n\n[Open file](${publicUrlData.publicUrl})` : "";
  172:         contentMarkdown = `# Uploaded Strategy Document\n\nFile: ${file.name}${link}`;
  173:       }
  174: 
  175:       const { error: deactivateError } = await supabase
  176:         .from("strategy_documents")
  177:         .update({ is_active: false })
  178:         .eq("client_id", clientId);
  179: 
  180:       if (deactivateError) throw deactivateError;
  181: 
  182:       const { data, error } = await supabase
  183:         .from("strategy_documents")
  184:         .insert({
  185:           agency_id: agencyId,
  186:           client_id: clientId,
  187:           content_markdown: contentMarkdown,
  188:           content_html: null,
  189:           source: "upload",
  190:           is_active: true,
  191:           file_path: uploadData?.path ?? null,
  192:           file_name: file.name,
  193:         })
  194:         .select()
  195:         .single();
  196: 
  197:       if (error) throw error;
  198:       return data as StrategyDocumentRecord;
  199:     },
  200:     onSuccess: (data) => {
  201:       queryClient.invalidateQueries({ queryKey: strategyDocumentsKeys.byClient(data.client_id) });
  202:     },
  203:   });
  204: }

=== src/hooks/useStrategyModules.ts ===
    1: // Strategy OS - Strategy Modules React Query Hooks
    2: 
    3: import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
    4: import { supabase } from '@/integrations/supabase/client';
    5: import type {
    6:   StrategyModule,
    7:   StrategyModuleRecord,
    8:   ModuleContent,
    9:   StrategyStatus,
   10: } from '@/lib/strategy/types';
   11: import { getDefaultModuleContent } from '@/lib/strategy/defaults';
   12: import { STRATEGY_MODULES } from '@/lib/strategy/constants';
   13: import { evaluateStrategyModule } from '@/lib/strategy/rulesEngine';
   14: import { strategyDocumentsKeys } from '@/hooks/useStrategyDocuments';
   15: 
   16: type StrategyGenerateResult =
   17:   | { mode: 'ai'; documentId?: string | null }
   18:   | { mode: 'unknown'; missing_fields?: string[]; questions?: string[] };
   19: 
   20: async function readFunctionErrorPayload(error: unknown): Promise<{ code?: string; error?: string } | null> {
   21:   if (!error || typeof error !== 'object') return null;
   22:   const context = (error as { context?: Response }).context;
   23:   if (!context || typeof context.json !== 'function') return null;
   24:   try {
   25:     return (await context.json()) as { code?: string; error?: string };
   26:   } catch {
   27:     return null;
   28:   }
   29: }
   30: 
   31: // Query keys
   32: export const strategyModulesKeys = {
   33:   all: ['strategy-modules'] as const,
   34:   byClient: (clientId: string) => [...strategyModulesKeys.all, clientId] as const,
   35:   module: (clientId: string, module: StrategyModule) =>
   36:     [...strategyModulesKeys.byClient(clientId), module] as const,
   37: };
   38: 
   39: // Fetch all strategy modules for a client
   40: export function useStrategyModules(clientId: string | undefined, strategyId: string | undefined) {
   41:   return useQuery({
   42:     queryKey: [...strategyModulesKeys.byClient(clientId ?? ''), strategyId] as const,
   43:     queryFn: async () => {
   44:       if (!clientId || !strategyId) return [];
   45: 
   46:       const { data, error } = await supabase
   47:         .from('strategy_modules')
   48:         .select('*')
   49:         .eq('client_id', clientId)
   50:         .eq('strategy_id', strategyId)
   51:         .order('module');
   52: 
   53:       if (error) throw error;
   54: 
   55:       // Cast to our types
   56:       return (data ?? []) as unknown as StrategyModuleRecord[];
   57:     },
   58:     enabled: !!clientId && !!strategyId,
   59:   });
   60: }
   61: 
   62: // Fetch a single strategy module
   63: export function useStrategyModule(
   64:   clientId: string | undefined,
   65:   strategyId: string | undefined,
   66:   module: StrategyModule | undefined
   67: ) {
   68:   return useQuery({
   69:     queryKey: [...strategyModulesKeys.module(clientId ?? '', module ?? 'positioning'), strategyId] as const,
   70:     queryFn: async () => {
   71:       if (!clientId || !strategyId || !module) return null;
   72: 
   73:       const { data, error } = await supabase
   74:         .from('strategy_modules')
   75:         .select('*')
   76:         .eq('client_id', clientId)
   77:         .eq('strategy_id', strategyId)
   78:         .eq('module', module)
   79:         .maybeSingle();
   80: 
   81:       if (error) throw error;
   82: 
   83:       return data as unknown as StrategyModuleRecord | null;
   84:     },
   85:     enabled: !!clientId && !!strategyId && !!module,
   86:   });
   87: }
   88: 
   89: // Upsert a strategy module
   90: export function useUpsertStrategyModule() {
   91:   const queryClient = useQueryClient();
   92: 
   93:   return useMutation({
   94:     mutationFn: async ({
   95:       clientId,
   96:       agencyId,
   97:       strategyId,
   98:       module,
   99:       contentJson,
  100:       status = 'draft',
  101:       aiGenerated = false,
  102:       aiConfidence,
  103:     }: {
  104:       clientId: string;
  105:       agencyId: string;
  106:       strategyId: string;
  107:       module: StrategyModule;
  108:       contentJson: ModuleContent;
  109:       status?: StrategyStatus;
  110:       aiGenerated?: boolean;
  111:       aiConfidence?: number;
  112:     }) => {
  113:       const { data, error } = await supabase.rpc('upsert_strategy_module', {
  114:         p_client_id: clientId,
  115:         p_agency_id: agencyId,
  116:         p_strategy_id: strategyId,
  117:         p_module: module,
  118:         p_content_json: contentJson,
  119:         p_status: status,
  120:         p_ai_generated: aiGenerated,
  121:         p_ai_confidence: aiConfidence ?? null,
  122:       });
  123: 
  124:       if (error) throw error;
  125:       return data as unknown as StrategyModuleRecord;
  126:     },
  127:     onSuccess: (data, variables) => {
  128:       queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
  129:     },
  130:   });
  131: }
  132: 
  133: // Update module content (partial update)
  134: export function useUpdateModuleContent() {
  135:   const queryClient = useQueryClient();
  136: 
  137:   return useMutation({
  138:     mutationFn: async ({
  139:       moduleId,
  140:       clientId,
  141:       module,
  142:       contentJson,
  143:       status,
  144:       modules,
  145:       currentStatus,
  146:       isLocked,
  147:     }: {
  148:       moduleId: string;
  149:       clientId: string;
  150:       module: StrategyModule;
  151:       contentJson: ModuleContent;
  152:       status?: StrategyStatus;
  153:       modules?: Partial<Record<StrategyModule, ModuleContent>>;
  154:       currentStatus?: StrategyStatus;
  155:       isLocked?: boolean;
  156:     }) => {
  157:       const evaluation = evaluateStrategyModule(module, contentJson, {
  158:         modules,
  159:         currentStatus,
  160:         isLocked,
  161:       });
  162: 
  163:       const updates: Record<string, unknown> = {
  164:         content_json: contentJson,
  165:         updated_at: new Date().toISOString(),
  166:         completion_percent: evaluation.completion_percent,
  167:         blockers: evaluation.blockers,
  168:         blocker_count: evaluation.blockers.length,
  169:       };
  170: 
  171:       updates.status = status ?? evaluation.status;
  172: 
  173:       const { data, error } = await supabase
  174:         .from('strategy_modules')
  175:         .update(updates)
  176:         .eq('id', moduleId)
  177:         .select()
  178:         .single();
  179: 
  180:       if (error) throw error;
  181:       return data as unknown as StrategyModuleRecord;
  182:     },
  183:     onSuccess: (data, variables) => {
  184:       queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
  185:     },
  186:   });
  187: }
  188: 
  189: // Toggle lock on a module
  190: export function useToggleModuleLock() {
  191:   const queryClient = useQueryClient();
  192: 
  193:   return useMutation({
  194:     mutationFn: async ({
  195:       moduleId,
  196:       clientId,
  197:       lock,
  198:       module,
  199:       content,
  200:       modules,
  201:       currentStatus,
  202:     }: {
  203:       moduleId: string;
  204:       clientId: string;
  205:       lock: boolean;
  206:       module: StrategyModule;
  207:       content: ModuleContent;
  208:       modules?: Partial<Record<StrategyModule, ModuleContent>>;
  209:       currentStatus?: StrategyStatus;
  210:     }) => {
  211:       const { data, error } = await supabase.rpc('toggle_strategy_module_lock', {
  212:         p_module_id: moduleId,
  213:         p_lock: lock,
  214:       });
  215: 
  216:       if (error) throw error;
  217:       const moduleRecord = data as unknown as StrategyModuleRecord;
  218: 
  219:       if (!lock) {
  220:         const evaluation = evaluateStrategyModule(module, content, {
  221:           modules,
  222:           currentStatus,
  223:           isLocked: false,
  224:         });
  225: 
  226:         const { data: updated, error: updateError } = await supabase
  227:           .from('strategy_modules')
  228:           .update({
  229:             status: evaluation.status,
  230:             completion_percent: evaluation.completion_percent,
  231:             blockers: evaluation.blockers,
  232:             blocker_count: evaluation.blockers.length,
  233:             updated_at: new Date().toISOString(),
  234:           })
  235:           .eq('id', moduleId)
  236:           .select()
  237:           .single();
  238: 
  239:         if (updateError) throw updateError;
  240:         return updated as unknown as StrategyModuleRecord;
  241:       }
  242: 
  243:       return moduleRecord;
  244:     },
  245:     onSuccess: (data, variables) => {
  246:       queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
  247:     },
  248:   });
  249: }
  250: 
  251: // Generate strategy via edge function
  252: export function useGenerateStrategy() {
  253:   const queryClient = useQueryClient();
  254: 
  255:   return useMutation({
  256:     mutationFn: async ({
  257:       clientId,
  258:     }: {
  259:       clientId: string;
  260:       agencyId: string;
  261:       strategyId: string;
  262:     }) => {
  263:       const { data, error } = await supabase.functions.invoke('ai-strategy-generate', {
  264:         body: { client_id: clientId },
  265:       });
  266: 
  267:       if (error) {
  268:         const payload = await readFunctionErrorPayload(error);
  269:         if (payload?.code === 'MISSING_API_KEY') {
  270:           throw new Error('AI service not configured. Contact your administrator.');
  271:         }
  272:         if (payload?.code === 'RAG_FAILURE') {
  273:           throw new Error('Failed to retrieve context. Please try again.');
  274:         }
  275:         throw error;
  276:       }
  277: 
  278:       if (data?.unknown === true) {
  279:         return {
  280:           mode: 'unknown',
  281:           missing_fields: Array.isArray(data?.missing_fields) ? data.missing_fields : undefined,
  282:           questions: Array.isArray(data?.questions) ? data.questions : undefined,
  283:         } as StrategyGenerateResult;
  284:       }
  285: 
  286:       const documentId = data?.document?.document_id ?? null;
  287:       return { mode: 'ai', documentId } as StrategyGenerateResult;
  288:     },
  289:     onSuccess: (data, variables) => {
  290:       queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
  291:       queryClient.invalidateQueries({ queryKey: strategyDocumentsKeys.byClient(variables.clientId) });
  292:     },
  293:   });
  294: }
  295: 
  296: // Initialize empty modules for a client (if none exist)
  297: export function useInitializeModules() {
  298:   const queryClient = useQueryClient();
  299: 
  300:   return useMutation({
  301:     mutationFn: async ({
  302:       clientId,
  303:       agencyId,
  304:       strategyId,
  305:     }: {
  306:       clientId: string;
  307:       agencyId: string;
  308:       strategyId: string;
  309:     }) => {
  310:       const results: StrategyModuleRecord[] = [];
  311: 
  312:       for (const moduleDef of STRATEGY_MODULES) {
  313:         const content = getDefaultModuleContent(moduleDef.key);
  314:         const evaluation = evaluateStrategyModule(moduleDef.key, content, {
  315:           currentStatus: 'empty',
  316:           isLocked: false,
  317:         });
  318: 
  319:         const { data, error } = await supabase
  320:           .from('strategy_modules')
  321:           .upsert(
  322:             {
  323:               client_id: clientId,
  324:               agency_id: agencyId,
  325:               strategy_id: strategyId,
  326:               module: moduleDef.key,
  327:               content_json: content,
  328:               status: evaluation.status,
  329:               completion_percent: evaluation.completion_percent,
  330:               blockers: evaluation.blockers,
  331:               blocker_count: evaluation.blockers.length,
  332:             },
  333:             { onConflict: 'strategy_id,module', ignoreDuplicates: true }
  334:           )
  335:           .select()
  336:           .single();
  337: 
  338:         if (!error && data) {
  339:           results.push(data as unknown as StrategyModuleRecord);
  340:         }
  341:       }
  342: 
  343:       return results;
  344:     },
  345:     onSuccess: (data, variables) => {
  346:       queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
  347:     },
  348:   });
  349: }
  350: 
  351: // Calculate overall strategy completion
  352: export function calculateStrategyCompletion(modules: StrategyModuleRecord[]): number {
  353:   if (modules.length === 0) return 0;
  354: 
  355:   const total = modules.reduce((sum, mod) => sum + (mod.completion_percent ?? 0), 0);
  356:   return Math.round(total / modules.length);
  357: }
  358: 
  359: // Get modules with blockers
  360: export function getModulesWithBlockers(modules: StrategyModuleRecord[]): StrategyModuleRecord[] {
  361:   return modules.filter((mod) => (mod.blocker_count ?? 0) > 0);
  362: }
  363: 
  364: // Approve a strategy module (only when blockers are clear)
  365: export function useApproveStrategyModule() {
  366:   const queryClient = useQueryClient();
  367: 
  368:   return useMutation({
  369:     mutationFn: async ({
  370:       moduleId,
  371:       clientId,
  372:     }: {
  373:       moduleId: string;
  374:       clientId: string;
  375:     }) => {
  376:       const { data, error } = await supabase
  377:         .from('strategy_modules')
  378:         .update({
  379:           status: 'approved',
  380:           updated_at: new Date().toISOString(),
  381:         })
  382:         .eq('id', moduleId)
  383:         .eq('blocker_count', 0)
  384:         .select()
  385:         .single();
  386: 
  387:       if (error) throw error;
  388:       return data as unknown as StrategyModuleRecord;
  389:     },
  390:     onSuccess: (data, variables) => {
  391:       queryClient.invalidateQueries({ queryKey: strategyModulesKeys.byClient(variables.clientId) });
  392:     },
  393:   });
  394: }

```

### Call sites: `rg -n "ai-strategy-generate" src/ -A 3`

```text
src/__tests__\strategy-generation.integration.test.ts:11:    const fn = read("supabase/functions/ai-strategy-generate/index.ts");
src/__tests__\strategy-generation.integration.test.ts-12-    expect(fn).toContain("BRAIN_INCOMPLETE");
src/__tests__\strategy-generation.integration.test.ts-13-    expect(fn).toContain("AGENCY_BRAIN_INCOMPLETE");
src/__tests__\strategy-generation.integration.test.ts-14-    expect(fn).toContain("/agency/ai-setup");
--
src/__tests__\strategy-generation.integration.test.ts:20:    const fn = read("supabase/functions/ai-strategy-generate/index.ts");
src/__tests__\strategy-generation.integration.test.ts-21-    expect(fn).toContain('replace(/^References:/, "## References")');
src/__tests__\strategy-generation.integration.test.ts-22-  });
src/__tests__\strategy-generation.integration.test.ts-23-
--
src/ai\ragPolicy.ts:47:    // Mirrors legacy ai-strategy-generate retrieval defaults.
src/ai\ragPolicy.ts-48-    client_memory_top_k: 6,
src/ai\ragPolicy.ts-49-    client_doc_types: ["client_guidelines", "client_notes", "approved_posts", "ai_artifact", "strategy_draft"],
src/ai\ragPolicy.ts-50-    agency_memory_top_k: 4,
--
src/ai\taskRegistry.ts:292:    usageEndpoint: "ai-strategy-generate",
src/ai\taskRegistry.ts-293-    schema: objectSchema("strategy_plan", ["summary", "sections"]),
src/ai\taskRegistry.ts-294-    buildUnknown: () => ({ unknown: true, missing_fields: [], questions: ["What additional context is required?"], escalation: false }),
src/ai\taskRegistry.ts-295-  },
--
src/hooks\useStrategyModules.ts:263:      const { data, error } = await supabase.functions.invoke('ai-strategy-generate', {
src/hooks\useStrategyModules.ts-264-        body: { client_id: clientId },
src/hooks\useStrategyModules.ts-265-      });
src/hooks\useStrategyModules.ts-266-
--
src/hooks\useStrategyDocuments.ts:78:      const { data, error } = await supabase.functions.invoke("ai-strategy-generate", {
src/hooks\useStrategyDocuments.ts-79-        body: { client_id: clientId, instruction },
src/hooks\useStrategyDocuments.ts-80-      });
src/hooks\useStrategyDocuments.ts-81-
--
src/components\onboarding-v5\OnboardingV5Wizard.tsx:634:      const { data: strategyResp, error: strategyErr } = await supabase.functions.invoke('ai-strategy-generate', {
src/components\onboarding-v5\OnboardingV5Wizard.tsx-635-        body: { client_id: clientId },
src/components\onboarding-v5\OnboardingV5Wizard.tsx-636-      });
src/components\onboarding-v5\OnboardingV5Wizard.tsx-637-      if (strategyErr) throw strategyErr;
```

### Strategy-related hook files list (`rg -n "strategy" src/hooks -l`)

```text
src/hooks\useOnboardingProfile.ts
src/hooks\useStrategies.ts
src/hooks\useStrategyDecisions.ts
src/hooks\useStrategyDocuments.ts
src/hooks\useStrategyHistory.ts
src/hooks\useStrategyTasks.ts
src/hooks\useStrategyModules.ts
```

## Verification SQL/Commands
```bash
# Verify all strategy-generate callers
rg -n "ai-strategy-generate" src -S

# Inspect strategy knowledge center behavior
rg -n "showGenerateErrorToast|ToastAction" src/components/strategy-os/StrategyKnowledgeCenter.tsx
```

## Problems Found
1. Without deep links, gated responses force users to manually find the correct setup screen; this is mitigated by the new `deep_link` handling but must remain consistent across endpoints.
2. Storage uploads depend on the presence of the `strategy-documents` bucket and policies; if migrations aren’t applied, uploads will fail.
3. There are two generation entry points (`useStrategyDocuments` vs `useStrategyModules`); they must stay consistent in error handling and messaging.

## Recommendations
1. Standardize frontend error decoding for edge function failures (prefer a shared helper for `code/message/deep_link`).
2. Add a progress indicator for long-running generation (1–3 minutes) and a clear timeout message.
3. Ensure deployment checklist includes applying migrations and verifying storage bucket existence for uploads.
