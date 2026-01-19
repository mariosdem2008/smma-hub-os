# A5 — RAG Pipeline End-to-End (Current Truth)

## Purpose
Audit the full Retrieval-Augmented Generation (RAG) pipeline: ingestion (chunking + embeddings), storage, retrieval (`match_ai_embeddings`), and how retrieved context is filtered and assembled for AI tasks (especially strategy generation). This matters for multi-tenant safety, correctness, and debuggability of AI outputs.

## Key Findings Summary
- Approved `brain_documents` are indexed into `ai_documents` with `doc_type='brain_document'`, chunked into `ai_document_chunks`, and embedded into `ai_embeddings`.
- Ingestion deletes prior `ai_documents` for the same brain module before inserting the new approved version (module-level replacement).
- Retrieval is done via `public.match_ai_embeddings(...)` RPC; strategy generation calls it for client, agency, and exemplar scopes.
- Retrieval is filtered by `agency_id` and optionally `client_id`, and further filtered by `doc_type` lists controlled by `src/ai/ragPolicy.ts` when enabled.
- Privilege hardening migration exists to restrict `match_ai_embeddings` execution to `service_role` only.

## Detailed Analysis
### Ingestion pipeline
- Implemented primarily in `supabase/functions/_shared/brain-documents.ts`.
- Steps:
  1) Render brain document to markdown
  2) Create `ai_documents` row (`doc_type='brain_document'`) with metadata including module/version/status
  3) Chunk extracted text and write `ai_document_chunks`
  4) Embed each chunk and store results via `persistEmbeddingResult()`

### Retrieval pipeline
- Implemented via SQL RPC `match_ai_embeddings` (see migration evidence).
- Call sites pass `p_agency_id`, `p_client_id`, `p_doc_types`, and similarity constraints.

### RAG policy
- `src/ai/ragPolicy.ts` defines which `doc_type` values are allowed per TaskType and caps the number of matches.

## Code Evidence
### Full Files (line-numbered): ingestion + embedding + RAG policy

```text
=== supabase/functions/_shared/brain-documents.ts ===
    1: /**
    2:  * Brain Documents Helper Functions
    3:  *
    4:  * Server-side utilities for working with the versioned brain document system.
    5:  * Used by Supabase Edge Functions for brain document CRUD operations.
    6:  */
    7: 
    8: import { buildChunks, embedText, getExpectedEmbeddingDim, tokenize } from "./embeddings.ts";
    9: import { embedWithPolicy } from "./embedding-policy.ts";
   10: import { persistEmbeddingResult } from "./embedding-store.ts";
   11: 
   12: type MaybeSingleResult<T> = { data: T | null; error?: { message?: string } | null };
   13: type MaybeArrayResult<T> = { data: T[] | null; error?: { message?: string } | null };
   14: 
   15: type MinimalSupabase = {
   16:   from: (table: string) => any;
   17:   rpc: (fn: string, args: Record<string, unknown>) => any;
   18: };
   19: 
   20: /**
   21:  * Brain module types (matches PostgreSQL enum)
   22:  */
   23: export const BRAIN_MODULES = [
   24:   "bootstrap",
   25:   "rep_policy",
   26:   "sop_strategy",
   27:   "sop_scripting",
   28:   "tone_voice",
   29:   "faq_objections",
   30:   "ai_permissions",
   31:   "offer_stack",
   32:   "quality_bar",
   33: ] as const;
   34: 
   35: export type BrainModule = (typeof BRAIN_MODULES)[number];
   36: 
   37: /**
   38:  * Brain document status types (matches PostgreSQL enum)
   39:  */
   40: export const BRAIN_DOCUMENT_STATUSES = [
   41:   "draft",
   42:   "pending_approval",
   43:   "approved",
   44:   "archived",
   45: ] as const;
   46: 
   47: export type BrainDocumentStatus = (typeof BRAIN_DOCUMENT_STATUSES)[number];
   48: 
   49: /**
   50:  * Brain document source types (matches PostgreSQL enum)
   51:  */
   52: export const BRAIN_DOCUMENT_SOURCES = [
   53:   "onboarding",
   54:   "chat",
   55:   "manual",
   56:   "ai_proposed",
   57: ] as const;
   58: 
   59: export type BrainDocumentSource = (typeof BRAIN_DOCUMENT_SOURCES)[number];
   60: 
   61: /**
   62:  * Brain document record from database
   63:  */
   64: export interface BrainDocument {
   65:   id: string;
   66:   agency_id: string;
   67:   module: BrainModule;
   68:   title: string;
   69:   content_json: Record<string, unknown>;
   70:   status: BrainDocumentStatus;
   71:   version: number;
   72:   approved_at: string | null;
   73:   approved_by: string | null;
   74:   parent_version_id: string | null;
   75:   source: BrainDocumentSource;
   76:   created_by: string | null;
   77:   created_at: string;
   78:   updated_at: string;
   79: }
   80: 
   81: const CHUNK_SIZE_TOKENS = 900;
   82: const OVERLAP_TOKENS = 140;
   83: const MAX_CHUNKS = 120;
   84: const MAX_EXTRACTED_CHARS = 150000;
   85: 
   86: /**
   87:  * Brain document version record
   88:  */
   89: export interface BrainDocumentVersion {
   90:   id: string;
   91:   document_id: string;
   92:   version: number;
   93:   content_json: Record<string, unknown>;
   94:   diff_json: Record<string, unknown> | null;
   95:   change_summary: string | null;
   96:   created_by: string | null;
   97:   created_at: string;
   98: }
   99: 
  100: /**
  101:  * Calibration state for idempotent setup flow
  102:  */
  103: export interface CalibrationState {
  104:   session_id: string;
  105:   current_step: string | null;
  106:   answered_keys: string[];
  107:   last_question_id: string | null;
  108:   last_question_hash: string | null;
  109:   completed_at: string | null;
  110: }
  111: 
  112: /**
  113:  * Default empty calibration state
  114:  */
  115: export const EMPTY_CALIBRATION_STATE: CalibrationState = {
  116:   session_id: "",
  117:   current_step: null,
  118:   answered_keys: [],
  119:   last_question_id: null,
  120:   last_question_hash: null,
  121:   completed_at: null,
  122: };
  123: 
  124: /**
  125:  * Fetch all approved brain documents for an agency
  126:  */
  127: export async function fetchApprovedBrainDocuments(
  128:   supabase: MinimalSupabase,
  129:   agencyId: string
  130: ): Promise<BrainDocument[]> {
  131:   const res: MaybeArrayResult<BrainDocument> = await supabase
  132:     .from("brain_documents")
  133:     .select("*")
  134:     .eq("agency_id", agencyId)
  135:     .eq("status", "approved")
  136:     .order("module");
  137: 
  138:   if (res?.error) {
  139:     throw new Error(res.error.message ?? "Failed to fetch approved brain documents");
  140:   }
  141: 
  142:   return res?.data ?? [];
  143: }
  144: 
  145: /**
  146:  * Fetch a specific brain document by module
  147:  * Returns the approved version if exists, otherwise the latest draft
  148:  */
  149: export async function fetchBrainDocument(
  150:   supabase: MinimalSupabase,
  151:   agencyId: string,
  152:   module: BrainModule
  153: ): Promise<BrainDocument | null> {
  154:   // Try approved first
  155:   const approvedRes: MaybeSingleResult<BrainDocument> = await supabase
  156:     .from("brain_documents")
  157:     .select("*")
  158:     .eq("agency_id", agencyId)
  159:     .eq("module", module)
  160:     .eq("status", "approved")
  161:     .maybeSingle();
  162: 
  163:   if (approvedRes?.data) {
  164:     return approvedRes.data;
  165:   }
  166: 
  167:   // Fall back to latest draft
  168:   const draftRes: MaybeSingleResult<BrainDocument> = await supabase
  169:     .from("brain_documents")
  170:     .select("*")
  171:     .eq("agency_id", agencyId)
  172:     .eq("module", module)
  173:     .in("status", ["draft", "pending_approval"])
  174:     .order("updated_at", { ascending: false })
  175:     .limit(1)
  176:     .maybeSingle();
  177: 
  178:   if (draftRes?.error) {
  179:     throw new Error(draftRes.error.message ?? "Failed to fetch brain document");
  180:   }
  181: 
  182:   return draftRes?.data ?? null;
  183: }
  184: 
  185: /**
  186:  * Fetch all brain documents for an agency (including drafts)
  187:  */
  188: export async function fetchAllBrainDocuments(
  189:   supabase: MinimalSupabase,
  190:   agencyId: string
  191: ): Promise<BrainDocument[]> {
  192:   const res: MaybeArrayResult<BrainDocument> = await supabase
  193:     .from("brain_documents")
  194:     .select("*")
  195:     .eq("agency_id", agencyId)
  196:     .neq("status", "archived")
  197:     .order("module")
  198:     .order("updated_at", { ascending: false });
  199: 
  200:   if (res?.error) {
  201:     throw new Error(res.error.message ?? "Failed to fetch brain documents");
  202:   }
  203: 
  204:   return res?.data ?? [];
  205: }
  206: 
  207: /**
  208:  * Create a new brain document draft
  209:  */
  210: export async function createBrainDocumentDraft(
  211:   supabase: MinimalSupabase,
  212:   agencyId: string,
  213:   module: BrainModule,
  214:   title: string,
  215:   contentJson: Record<string, unknown>,
  216:   source: BrainDocumentSource = "manual",
  217:   createdBy?: string
  218: ): Promise<BrainDocument> {
  219:   const insertData: Record<string, unknown> = {
  220:     agency_id: agencyId,
  221:     module,
  222:     title,
  223:     content_json: contentJson,
  224:     status: "draft",
  225:     source,
  226:   };
  227: 
  228:   if (createdBy) {
  229:     insertData.created_by = createdBy;
  230:   }
  231: 
  232:   const res: MaybeSingleResult<BrainDocument> = await supabase
  233:     .from("brain_documents")
  234:     .insert(insertData)
  235:     .select("*")
  236:     .single();
  237: 
  238:   if (res?.error) {
  239:     throw new Error(res.error.message ?? "Failed to create brain document draft");
  240:   }
  241: 
  242:   if (!res?.data) {
  243:     throw new Error("No data returned after creating brain document");
  244:   }
  245: 
  246:   // Create initial version record
  247:   await supabase.from("brain_document_versions").insert({
  248:     document_id: res.data.id,
  249:     version: 1,
  250:     content_json: contentJson,
  251:     change_summary: "Initial draft created",
  252:     created_by: createdBy ?? null,
  253:   });
  254: 
  255:   return res.data;
  256: }
  257: 
  258: /**
  259:  * Update a brain document (creates new version)
  260:  */
  261: export async function updateBrainDocument(
  262:   supabase: MinimalSupabase,
  263:   documentId: string,
  264:   contentJson: Record<string, unknown>,
  265:   changeSummary?: string,
  266:   updatedBy?: string
  267: ): Promise<BrainDocument> {
  268:   // Get current document
  269:   const currentRes: MaybeSingleResult<BrainDocument> = await supabase
  270:     .from("brain_documents")
  271:     .select("*")
  272:     .eq("id", documentId)
  273:     .single();
  274: 
  275:   if (currentRes?.error || !currentRes?.data) {
  276:     throw new Error(currentRes?.error?.message ?? "Document not found");
  277:   }
  278: 
  279:   const current = currentRes.data;
  280: 
  281:   if (current.status === "approved") {
  282:     throw new Error("Cannot edit approved document directly. Create a new draft instead.");
  283:   }
  284: 
  285:   const newVersion = current.version + 1;
  286: 
  287:   // Update document
  288:   const updateRes: MaybeSingleResult<BrainDocument> = await supabase
  289:     .from("brain_documents")
  290:     .update({
  291:       content_json: contentJson,
  292:       version: newVersion,
  293:     })
  294:     .eq("id", documentId)
  295:     .select("*")
  296:     .single();
  297: 
  298:   if (updateRes?.error || !updateRes?.data) {
  299:     throw new Error(updateRes?.error?.message ?? "Failed to update brain document");
  300:   }
  301: 
  302:   // Create version record
  303:   await supabase.from("brain_document_versions").insert({
  304:     document_id: documentId,
  305:     version: newVersion,
  306:     content_json: contentJson,
  307:     change_summary: changeSummary ?? "Content updated",
  308:     created_by: updatedBy ?? null,
  309:   });
  310: 
  311:   return updateRes.data;
  312: }
  313: 
  314: /**
  315:  * Approve a brain document
  316:  */
  317: export async function approveBrainDocument(
  318:   supabase: MinimalSupabase,
  319:   documentId: string,
  320:   approvedBy?: string
  321: ): Promise<BrainDocument> {
  322:   // Get document
  323:   const docRes: MaybeSingleResult<BrainDocument> = await supabase
  324:     .from("brain_documents")
  325:     .select("*")
  326:     .eq("id", documentId)
  327:     .single();
  328: 
  329:   if (docRes?.error || !docRes?.data) {
  330:     throw new Error(docRes?.error?.message ?? "Document not found");
  331:   }
  332: 
  333:   const doc = docRes.data;
  334: 
  335:   // Archive existing approved document for this module
  336:   await supabase
  337:     .from("brain_documents")
  338:     .update({ status: "archived" })
  339:     .eq("agency_id", doc.agency_id)
  340:     .eq("module", doc.module)
  341:     .eq("status", "approved")
  342:     .neq("id", documentId);
  343: 
  344:   // Approve the document
  345:   const updateData: Record<string, unknown> = {
  346:     status: "approved",
  347:     approved_at: new Date().toISOString(),
  348:   };
  349: 
  350:   if (approvedBy) {
  351:     updateData.approved_by = approvedBy;
  352:   }
  353: 
  354:   const updateRes: MaybeSingleResult<BrainDocument> = await supabase
  355:     .from("brain_documents")
  356:     .update(updateData)
  357:     .eq("id", documentId)
  358:     .select("*")
  359:     .single();
  360: 
  361:   if (updateRes?.error || !updateRes?.data) {
  362:     throw new Error(updateRes?.error?.message ?? "Failed to approve brain document");
  363:   }
  364: 
  365:   return updateRes.data;
  366: }
  367: 
  368: /**
  369:  * Fetch version history for a document
  370:  */
  371: export async function fetchDocumentHistory(
  372:   supabase: MinimalSupabase,
  373:   documentId: string
  374: ): Promise<BrainDocumentVersion[]> {
  375:   const res: MaybeArrayResult<BrainDocumentVersion> = await supabase
  376:     .from("brain_document_versions")
  377:     .select("*")
  378:     .eq("document_id", documentId)
  379:     .order("version", { ascending: false });
  380: 
  381:   if (res?.error) {
  382:     throw new Error(res.error.message ?? "Failed to fetch document history");
  383:   }
  384: 
  385:   return res?.data ?? [];
  386: }
  387: 
  388: /**
  389:  * Fetch calibration state from agency brain
  390:  */
  391: export async function fetchCalibrationState(
  392:   supabase: MinimalSupabase,
  393:   agencyId: string
  394: ): Promise<CalibrationState> {
  395:   const res: MaybeSingleResult<{ calibration_state: CalibrationState | null }> = await supabase
  396:     .from("agency_brains")
  397:     .select("calibration_state")
  398:     .eq("agency_id", agencyId)
  399:     .order("created_at", { ascending: false })
  400:     .limit(1)
  401:     .maybeSingle();
  402: 
  403:   if (res?.error) {
  404:     throw new Error(res.error.message ?? "Failed to fetch calibration state");
  405:   }
  406: 
  407:   return res?.data?.calibration_state ?? { ...EMPTY_CALIBRATION_STATE };
  408: }
  409: 
  410: /**
  411:  * Update calibration state in agency brain
  412:  */
  413: export async function updateCalibrationState(
  414:   supabase: MinimalSupabase,
  415:   agencyId: string,
  416:   state: CalibrationState
  417: ): Promise<void> {
  418:   // Get agency brain ID
  419:   const brainRes: MaybeSingleResult<{ id: string }> = await supabase
  420:     .from("agency_brains")
  421:     .select("id")
  422:     .eq("agency_id", agencyId)
  423:     .order("created_at", { ascending: false })
  424:     .limit(1)
  425:     .maybeSingle();
  426: 
  427:   if (brainRes?.error) {
  428:     throw new Error(brainRes.error.message ?? "Failed to fetch agency brain");
  429:   }
  430: 
  431:   if (!brainRes?.data) {
  432:     // No brain exists yet, create one
  433:     const insertRes = await supabase
  434:       .from("agency_brains")
  435:       .insert({
  436:         agency_id: agencyId,
  437:         version: 1,
  438:         status: "draft",
  439:         locked: false,
  440:         brain_json: {},
  441:         calibration_state: state,
  442:         confidence: 0,
  443:       })
  444:       .select("id")
  445:       .single();
  446: 
  447:     if (insertRes?.error) {
  448:       throw new Error(insertRes.error.message ?? "Failed to create agency brain");
  449:     }
  450:     return;
  451:   }
  452: 
  453:   // Update existing brain
  454:   const updateRes = await supabase
  455:     .from("agency_brains")
  456:     .update({ calibration_state: state })
  457:     .eq("id", brainRes.data.id);
  458: 
  459:   if (updateRes?.error) {
  460:     throw new Error(updateRes.error.message ?? "Failed to update calibration state");
  461:   }
  462: }
  463: 
  464: /**
  465:  * Mark a question as answered in calibration state
  466:  */
  467: export async function markQuestionAnswered(
  468:   supabase: MinimalSupabase,
  469:   agencyId: string,
  470:   questionKey: string
  471: ): Promise<CalibrationState> {
  472:   const currentState = await fetchCalibrationState(supabase, agencyId);
  473: 
  474:   // Don't add duplicates
  475:   if (currentState.answered_keys.includes(questionKey)) {
  476:     return currentState;
  477:   }
  478: 
  479:   const newState: CalibrationState = {
  480:     ...currentState,
  481:     answered_keys: [...currentState.answered_keys, questionKey],
  482:     current_step: null, // Will be set by next question selection
  483:     last_question_id: null,
  484:     last_question_hash: null,
  485:   };
  486: 
  487:   await updateCalibrationState(supabase, agencyId, newState);
  488:   return newState;
  489: }
  490: 
  491: /**
  492:  * Check if a question has already been answered (idempotency check)
  493:  */
  494: export function isQuestionAnswered(
  495:   state: CalibrationState,
  496:   questionKey: string
  497: ): boolean {
  498:   return state.answered_keys.includes(questionKey);
  499: }
  500: 
  501: /**
  502:  * Generate a hash for idempotency token
  503:  */
  504: export function generateQuestionHash(
  505:   questionKey: string,
  506:   questionText: string
  507: ): string {
  508:   // Simple hash for deduplication
  509:   const input = `${questionKey}:${questionText}`;
  510:   let hash = 0;
  511:   for (let i = 0; i < input.length; i++) {
  512:     const char = input.charCodeAt(i);
  513:     hash = ((hash << 5) - hash) + char;
  514:     hash = hash & hash; // Convert to 32bit integer
  515:   }
  516:   return Math.abs(hash).toString(16);
  517: }
  518: 
  519: /**
  520:  * Build a resolved brain context from approved documents
  521:  * Maps modules to a single context object for AI consumption
  522:  */
  523: export async function buildResolvedBrainContext(
  524:   supabase: MinimalSupabase,
  525:   agencyId: string,
  526:   requiredModules?: BrainModule[]
  527: ): Promise<Record<string, Record<string, unknown>>> {
  528:   const documents = await fetchApprovedBrainDocuments(supabase, agencyId);
  529: 
  530:   const context: Record<string, Record<string, unknown>> = {};
  531: 
  532:   for (const doc of documents) {
  533:     // If specific modules required, filter
  534:     if (requiredModules && !requiredModules.includes(doc.module)) {
  535:       continue;
  536:     }
  537:     context[doc.module] = doc.content_json;
  538:   }
  539: 
  540:   return context;
  541: }
  542: 
  543: /**
  544:  * Check which required modules are missing or incomplete
  545:  */
  546: export async function findMissingModules(
  547:   supabase: MinimalSupabase,
  548:   agencyId: string,
  549:   requiredModules: BrainModule[]
  550: ): Promise<BrainModule[]> {
  551:   const documents = await fetchApprovedBrainDocuments(supabase, agencyId);
  552:   const approvedModules = new Set(documents.map((d) => d.module));
  553: 
  554:   return requiredModules.filter((m) => !approvedModules.has(m));
  555: }
  556: 
  557: function formatHeading(value: string) {
  558:   return value
  559:     .replace(/_/g, " ")
  560:     .replace(/([a-z])([A-Z])/g, "$1 $2")
  561:     .replace(/\s+/g, " ")
  562:     .trim()
  563:     .replace(/^./, (char) => char.toUpperCase());
  564: }
  565: 
  566: function renderMarkdown(value: unknown, depth: number): string {
  567:   if (value === null || value === undefined) return "";
  568: 
  569:   if (typeof value === "string") {
  570:     return value.trim();
  571:   }
  572: 
  573:   if (typeof value === "number" || typeof value === "boolean") {
  574:     return String(value);
  575:   }
  576: 
  577:   if (Array.isArray(value)) {
  578:     if (value.length === 0) return "";
  579:     if (value.every((item) => typeof item !== "object" || item === null)) {
  580:       return value.map((item) => `- ${String(item)}`).join("\n");
  581:     }
  582: 
  583:     return value
  584:       .map((item, index) => {
  585:         const itemText = renderMarkdown(item, depth + 1);
  586:         if (!itemText) return "";
  587:         const lines = itemText.split("\n").filter(Boolean);
  588:         const indented = lines.map((line) => `  ${line}`).join("\n");
  589:         return `- Item ${index + 1}\n${indented}`;
  590:       })
  591:       .filter(Boolean)
  592:       .join("\n");
  593:   }
  594: 
  595:   if (typeof value === "object") {
  596:     const entries = Object.keys(value as Record<string, unknown>).sort();
  597:     return entries
  598:       .map((key) => {
  599:         const rendered = renderMarkdown((value as Record<string, unknown>)[key], depth + 1);
  600:         if (!rendered) return "";
  601:         const heading = `${"#".repeat(Math.min(depth, 6))} ${formatHeading(key)}`;
  602:         return `${heading}\n\n${rendered}`;
  603:       })
  604:       .filter(Boolean)
  605:       .join("\n\n");
  606:   }
  607: 
  608:   return "";
  609: }
  610: 
  611: export function brainDocumentToMarkdown(doc: BrainDocument): string {
  612:   const title = doc.title?.trim() || formatHeading(doc.module);
  613:   const body = renderMarkdown(doc.content_json, 2);
  614:   if (!body) return `# ${title}`;
  615:   return `# ${title}\n\n${body}`;
  616: }
  617: 
  618: export async function ingestBrainDocumentForRag(
  619:   supabase: MinimalSupabase,
  620:   doc: BrainDocument,
  621:   options?: {
  622:     failHard?: boolean;
  623:     embeddingApiKey?: string;
  624:     embeddingModel?: string;
  625:   }
  626: ): Promise<{ documentId: string; chunksCreated: number; tokenCount: number }> {
  627:   const failHard = options?.failHard ?? (typeof Deno !== "undefined" && Deno.env.get("AI_EMBEDDING_FAIL_HARD") === "true");
  628:   const embeddingApiKey =
  629:     options?.embeddingApiKey ??
  630:     (typeof Deno !== "undefined"
  631:       ? Deno.env.get("OPENAI_API_KEY")
  632:       : typeof process !== "undefined"
  633:       ? process.env.OPENAI_API_KEY
  634:       : undefined);
  635:   const embeddingModel =
  636:     options?.embeddingModel ??
  637:     (typeof Deno !== "undefined"
  638:       ? Deno.env.get("EMBEDDING_MODEL_ID")
  639:       : typeof process !== "undefined"
  640:       ? process.env.EMBEDDING_MODEL_ID
  641:       : undefined) ??
  642:     "text-embedding-3-small";
  643: 
  644:   if (doc.status !== "approved") {
  645:     throw new Error("Only approved brain documents can be indexed");
  646:   }
  647: 
  648:   const markdown = brainDocumentToMarkdown(doc);
  649:   const extractedText = markdown.slice(0, MAX_EXTRACTED_CHARS);
  650:   const tokens = tokenize(extractedText);
  651:   const chunks = buildChunks(tokens, CHUNK_SIZE_TOKENS, OVERLAP_TOKENS, MAX_CHUNKS);
  652: 
  653:   if (chunks.length === 0) {
  654:     throw new Error("No content to index");
  655:   }
  656: 
  657:   await supabase
  658:     .from("ai_documents")
  659:     .delete()
  660:     .eq("agency_id", doc.agency_id)
  661:     .eq("doc_type", "brain_document")
  662:     .eq("metadata->>module", doc.module);
  663: 
  664:   const { data: documentRow, error: documentError } = await supabase
  665:     .from("ai_documents")
  666:     .insert({
  667:       agency_id: doc.agency_id,
  668:       client_id: null,
  669:       doc_type: "brain_document",
  670:       title: doc.title || formatHeading(doc.module),
  671:       content: markdown,
  672:       extracted_text: extractedText,
  673:       source: { source_type: "brain_document", source_ref: doc.id },
  674:       metadata: {
  675:         brain_document_id: doc.id,
  676:         module: doc.module,
  677:         version: doc.version,
  678:         status: doc.status,
  679:         approved_at: doc.approved_at,
  680:         chunk_size_tokens: CHUNK_SIZE_TOKENS,
  681:         overlap_tokens: OVERLAP_TOKENS,
  682:         max_chunks_per_doc: MAX_CHUNKS,
  683:         token_count: tokens.length,
  684:       },
  685:     })
  686:     .select("id")
  687:     .single();
  688: 
  689:   if (documentError || !documentRow) {
  690:     throw new Error(documentError?.message ?? "Failed to create ai_document for brain doc");
  691:   }
  692: 
  693:   const expectedDim = getExpectedEmbeddingDim();
  694: 
  695:   for (let index = 0; index < chunks.length; index += 1) {
  696:     const chunk = chunks[index];
  697:     const { data: chunkRow, error: chunkError } = await supabase
  698:       .from("ai_document_chunks")
  699:       .insert({
  700:         document_id: documentRow.id,
  701:         chunk_index: index,
  702:         chunk_text: chunk.text,
  703:         token_count: chunk.tokenCount,
  704:         chunk_meta: { start_token: chunk.start, end_token: chunk.end },
  705:         embedding_status: "failed",
  706:       })
  707:       .select("id")
  708:       .single();
  709: 
  710:     if (chunkError || !chunkRow) {
  711:       throw new Error(chunkError?.message ?? "Failed to create chunk");
  712:     }
  713: 
  714:     const embeddingResult = await embedWithPolicy({
  715:       text: chunk.text,
  716:       apiKey: embeddingApiKey ?? undefined,
  717:       failHard,
  718:       embed: (text) => embedText(text, embeddingApiKey ?? "", embeddingModel),
  719:     });
  720: 
  721:     const persistResult = await persistEmbeddingResult({
  722:       supabase,
  723:       chunkId: chunkRow.id,
  724:       embeddingResult,
  725:       embeddingPayload: {
  726:         agency_id: doc.agency_id,
  727:         client_id: null,
  728:         doc_type: "brain_document",
  729:         document_id: documentRow.id,
  730:         chunk_id: chunkRow.id,
  731:         embedding: [],
  732:         model: embeddingModel,
  733:         metadata: {
  734:           similarity: "cosine",
  735:           embedding_dim: expectedDim,
  736:         },
  737:       },
  738:     });
  739: 
  740:     if (!persistResult.stored && persistResult.errorCode === "EMBEDDING_DIM_MISMATCH") {
  741:       throw new Error("Embedding dimension mismatch");
  742:     }
  743:   }
  744: 
  745:   return {
  746:     documentId: documentRow.id,
  747:     chunksCreated: chunks.length,
  748:     tokenCount: tokens.length,
  749:   };
  750: }

=== supabase/functions/_shared/embedding-store.ts ===
    1: import type { EmbedPolicyResult } from "./embedding-policy.ts";
    2: 
    3: type MinimalSupabase = {
    4:   from: (table: string) => any;
    5: };
    6: 
    7: export async function persistEmbeddingResult(opts: {
    8:   supabase: MinimalSupabase;
    9:   chunkId: string;
   10:   embeddingResult: EmbedPolicyResult;
   11:   embeddingPayload: {
   12:     agency_id: string;
   13:     client_id: string | null;
   14:     doc_type: string;
   15:     document_id: string;
   16:     chunk_id: string;
   17:     embedding: number[];
   18:     model: string;
   19:     metadata: Record<string, unknown>;
   20:   };
   21: }) {
   22:   if (opts.embeddingResult.status !== "ok" || !opts.embeddingResult.vector) {
   23:     await opts.supabase.from("ai_document_chunks").update({ embedding_status: "failed" }).eq("id", opts.chunkId);
   24:     return { stored: false, errorCode: opts.embeddingResult.errorCode };
   25:   }
   26: 
   27:   const { error: embedError } = await opts.supabase.from("ai_embeddings").insert({
   28:     ...opts.embeddingPayload,
   29:     embedding: opts.embeddingResult.vector,
   30:   });
   31:   if (embedError) {
   32:     throw embedError;
   33:   }
   34: 
   35:   await opts.supabase.from("ai_document_chunks").update({ embedding_status: "ok" }).eq("id", opts.chunkId);
   36: 
   37:   return { stored: true, errorCode: undefined };
   38: }

=== supabase/functions/_shared/embeddings.ts ===
    1: import { ai } from "../../../src/ai/router.ts";
    2: import { TaskType } from "../../../src/ai/taskTypes.ts";
    3: 
    4: export const DEFAULT_EMBEDDING_DIM = 1536;
    5: 
    6: export function getExpectedEmbeddingDim() {
    7:   const raw = typeof Deno !== "undefined"
    8:     ? Deno.env.get("AI_EMBED_DIM_EXPECTED")
    9:     : typeof process !== "undefined"
   10:     ? process.env.AI_EMBED_DIM_EXPECTED
   11:     : undefined;
   12:   const parsed = raw ? Number(raw) : NaN;
   13:   if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
   14:   return DEFAULT_EMBEDDING_DIM;
   15: }
   16: 
   17: export function tokenize(text: string) {
   18:   return text.trim().split(/\s+/).filter(Boolean);
   19: }
   20: 
   21: export function buildChunks(
   22:   tokens: string[],
   23:   chunkSizeTokens: number,
   24:   overlapTokens: number,
   25:   maxChunks: number,
   26: ) {
   27:   const chunks: { text: string; tokenCount: number; start: number; end: number }[] = [];
   28:   if (tokens.length === 0) return chunks;
   29: 
   30:   const step = Math.max(chunkSizeTokens - overlapTokens, 1);
   31:   for (let start = 0; start < tokens.length && chunks.length < maxChunks; start += step) {
   32:     const end = Math.min(start + chunkSizeTokens, tokens.length);
   33:     const slice = tokens.slice(start, end);
   34:     chunks.push({
   35:       text: slice.join(" "),
   36:       tokenCount: slice.length,
   37:       start,
   38:       end,
   39:     });
   40:     if (end === tokens.length) break;
   41:   }
   42:   return chunks;
   43: }
   44: 
   45: export async function embedText(text: string, apiKey: string, model: string) {
   46:   const result = await ai.run({
   47:     taskType: TaskType.EMBED_TEXT,
   48:     input: text,
   49:     context: { environment: "prod" },
   50:     metadata: {
   51:       modelOverride: model,
   52:       outputDimensionality: getExpectedEmbeddingDim(),
   53:     },
   54:   });
   55:   const vector = result.output;
   56:   if (!Array.isArray(vector)) {
   57:     throw new Error("Embedding API response missing vector");
   58:   }
   59:   const expectedDim = getExpectedEmbeddingDim();
   60:   if (vector.length !== expectedDim) {
   61:     const error = new Error("Embedding dimension mismatch") as Error & { code?: string };
   62:     error.code = "EMBEDDING_DIM_MISMATCH";
   63:     throw error;
   64:   }
   65:   return vector;
   66: }

=== supabase/functions/_shared/embedding-policy.ts ===
    1: type EmbedFn = (text: string) => Promise<number[]>;
    2: 
    3: export type EmbedPolicyOptions = {
    4:   text: string;
    5:   apiKey?: string;
    6:   failHard: boolean;
    7:   embed: EmbedFn;
    8: };
    9: 
   10: export type EmbedPolicyResult = {
   11:   vector?: number[];
   12:   status: "ok" | "failed";
   13:   errorCode?: string;
   14: };
   15: 
   16: export async function embedWithPolicy(options: EmbedPolicyOptions): Promise<EmbedPolicyResult> {
   17:   if (!options.apiKey) {
   18:     if (options.failHard) {
   19:       const error = new Error("OPENAI_API_KEY is not configured") as Error & { code?: string };
   20:       error.code = "MISSING_API_KEY";
   21:       throw error;
   22:     }
   23:     return { status: "failed", errorCode: "MISSING_API_KEY" };
   24:   }
   25: 
   26:   try {
   27:     const vector = await options.embed(options.text);
   28:     return { vector, status: "ok" };
   29:   } catch (error) {
   30:     if ((error as any)?.code === "EMBEDDING_DIM_MISMATCH") {
   31:       return { status: "failed", errorCode: "EMBEDDING_DIM_MISMATCH" };
   32:     }
   33:     if (options.failHard) {
   34:       const wrapped = new Error("Embedding failed") as Error & { code?: string };
   35:       wrapped.code = "EMBEDDING_FAILED";
   36:       throw wrapped;
   37:     }
   38:     return { status: "failed", errorCode: "EMBEDDING_FAILED" };
   39:   }
   40: }

=== src/ai/ragPolicy.ts ===
    1: import { TaskType } from "./taskTypes.ts";
    2: import { getEnvVar } from "./utils.ts";
    3: 
    4: export type RagConfig = {
    5:   client_memory_top_k: number;
    6:   client_doc_types: string[];
    7:   agency_memory_top_k: number;
    8:   agency_doc_types: string[];
    9:   exemplar_top_k: number;
   10:   exemplar_doc_types: string[];
   11:   min_similarity: number;
   12:   max_context_chars: number;
   13:   max_context_tokens: number;
   14: };
   15: 
   16: export type RagMatch = {
   17:   doc_type: string;
   18:   chunk_text: string;
   19:   similarity?: number;
   20:   score?: number;
   21:   doc_id?: string;
   22:   document_id?: string;
   23:   chunk_id?: string;
   24: };
   25: 
   26: export type RagPolicyResult = {
   27:   context: string;
   28:   contextTruncated: boolean;
   29:   selectedMatches: RagMatch[];
   30:   retrievalCount: number;
   31:   docTypesUsed: string[];
   32: };
   33: 
   34: const DEFAULT_RAG_CONFIG: Partial<Record<TaskType, RagConfig>> = {
   35:   [TaskType.CLIENT_PORTAL_QA]: {
   36:     client_memory_top_k: 6,
   37:     client_doc_types: ["client_memory", "onboarding_v3", "strategy_plan"],
   38:     agency_memory_top_k: 4,
   39:     agency_doc_types: ["agency_memory", "setup_progress_v1"],
   40:     exemplar_top_k: 2,
   41:     exemplar_doc_types: ["exemplar"],
   42:     min_similarity: 0.2,
   43:     max_context_chars: 6000,
   44:     max_context_tokens: 900,
   45:   },
   46:   [TaskType.STRATEGY_PLAN]: {
   47:     // Mirrors legacy ai-strategy-generate retrieval defaults.
   48:     client_memory_top_k: 6,
   49:     client_doc_types: ["client_guidelines", "client_notes", "approved_posts", "ai_artifact", "strategy_draft"],
   50:     agency_memory_top_k: 4,
   51:     agency_doc_types: ["agency_sop", "brain_document"],
   52:     exemplar_top_k: 2,
   53:     exemplar_doc_types: ["agency_exemplar_strategy"],
   54:     min_similarity: 0.2,
   55:     max_context_chars: 6000,
   56:     max_context_tokens: 1200,
   57:   },
   58: };
   59: 
   60: const FALLBACK_RAG_CONFIG: RagConfig = {
   61:   client_memory_top_k: 0,
   62:   client_doc_types: [],
   63:   agency_memory_top_k: 0,
   64:   agency_doc_types: [],
   65:   exemplar_top_k: 0,
   66:   exemplar_doc_types: [],
   67:   min_similarity: 0,
   68:   max_context_chars: 6000,
   69:   max_context_tokens: 1200,
   70: };
   71: 
   72: export function getRagConfig(taskType: TaskType): RagConfig {
   73:   return DEFAULT_RAG_CONFIG[taskType] ?? FALLBACK_RAG_CONFIG;
   74: }
   75: 
   76: function similarityScore(match: RagMatch) {
   77:   if (typeof match.similarity === "number") return match.similarity;
   78:   if (typeof match.score === "number") return match.score;
   79:   return 0;
   80: }
   81: 
   82: function selectTop(matches: RagMatch[], topK: number) {
   83:   if (topK <= 0) return [];
   84:   return [...matches]
   85:     .sort((a, b) => similarityScore(b) - similarityScore(a))
   86:     .slice(0, topK);
   87: }
   88: 
   89: function estimateTokens(text: string) {
   90:   if (!text) return 0;
   91:   return text.trim().split(/\s+/).filter(Boolean).length;
   92: }
   93: 
   94: export function applyRagPolicy(matches: RagMatch[], config: RagConfig): RagPolicyResult {
   95:   const clientMatches = matches.filter((match) => config.client_doc_types.includes(match.doc_type));
   96:   const agencyMatches = matches.filter((match) => config.agency_doc_types.includes(match.doc_type));
   97:   const exemplarMatches = matches.filter((match) => config.exemplar_doc_types.includes(match.doc_type));
   98: 
   99:   const preSelected = [
  100:     ...selectTop(clientMatches, config.client_memory_top_k),
  101:     ...selectTop(agencyMatches, config.agency_memory_top_k),
  102:     ...selectTop(exemplarMatches, config.exemplar_top_k),
  103:   ];
  104: 
  105:   let usedTokens = 0;
  106:   const selectedMatches: RagMatch[] = [];
  107:   for (const match of preSelected) {
  108:     const tokens = estimateTokens(match.chunk_text ?? "");
  109:     if (usedTokens + tokens > config.max_context_tokens) break;
  110:     selectedMatches.push(match);
  111:     usedTokens += tokens;
  112:   }
  113: 
  114:   const contextParts = selectedMatches.map((match) => `(${match.doc_type}) ${match.chunk_text}`);
  115:   const fullContext = contextParts.join("\n\n");
  116: 
  117:   if (fullContext.length <= config.max_context_chars) {
  118:     return {
  119:       context: fullContext,
  120:       contextTruncated: selectedMatches.length < preSelected.length,
  121:       selectedMatches,
  122:       retrievalCount: selectedMatches.length,
  123:       docTypesUsed: Array.from(new Set(selectedMatches.map((match) => match.doc_type))),
  124:     };
  125:   }
  126: 
  127:   return {
  128:     context: `${fullContext.slice(0, config.max_context_chars)}\n...(context truncated)`,
  129:     contextTruncated: true,
  130:     selectedMatches,
  131:     retrievalCount: selectedMatches.length,
  132:     docTypesUsed: Array.from(new Set(selectedMatches.map((match) => match.doc_type))),
  133:   };
  134: }
  135: 
  136: function hashToBucket(value: string) {
  137:   let hash = 0;
  138:   for (let i = 0; i < value.length; i += 1) {
  139:     hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  140:   }
  141:   return hash % 100;
  142: }
  143: 
  144: export function shouldUseRagPolicy(ids: { agencyId?: string | null; clientId?: string | null }) {
  145:   const raw = getEnvVar("AI_RAG_CENTRALIZED");
  146:   if (!raw) return false;
  147: 
  148:   const normalized = raw.toLowerCase();
  149:   if (normalized === "true") return true;
  150:   if (normalized === "false") return false;
  151: 
  152:   const percent = Number.parseInt(raw, 10);
  153:   if (!Number.isFinite(percent) || percent <= 0) return false;
  154:   if (percent >= 100) return true;
  155: 
  156:   const key = ids.clientId ?? ids.agencyId;
  157:   if (!key) return false;
  158:   return hashToBucket(key) < percent;
  159: }

```

### Call sites: `rg -n "match_ai_embeddings" --type ts -A 5`

```text
src\__tests__\strategy-generation.integration.test.ts:36:  it("hardens match_ai_embeddings to service_role only", () => {
src\__tests__\strategy-generation.integration.test.ts:37:    const migration = read("supabase/migrations/20260118000001_harden_match_ai_embeddings_final.sql");
src\__tests__\strategy-generation.integration.test.ts:38:    expect(migration).toMatch(/revoke all on function public\.match_ai_embeddings/i);
src\__tests__\strategy-generation.integration.test.ts:39:    expect(migration).toMatch(/grant execute on function public\.match_ai_embeddings/i);
src\__tests__\strategy-generation.integration.test.ts-40-    expect(migration).toMatch(/service_role/i);
src\__tests__\strategy-generation.integration.test.ts-41-  });
src\__tests__\strategy-generation.integration.test.ts-42-});
--
tests\integration\ai\match-embedding-filters.test.ts:5:describe("match_ai_embeddings filters", () => {
tests\integration\ai\match-embedding-filters.test.ts-6-  it("adds module filter, min similarity, and hard cap", () => {
tests\integration\ai\match-embedding-filters.test.ts-7-    const migrationPath = resolve(
tests\integration\ai\match-embedding-filters.test.ts-8-      process.cwd(),
tests\integration\ai\match-embedding-filters.test.ts:9:      "supabase/migrations/20260108134500_match_ai_embeddings_filters.sql"
tests\integration\ai\match-embedding-filters.test.ts-10-    );
tests\integration\ai\match-embedding-filters.test.ts-11-    const sql = readFileSync(migrationPath, "utf8");
tests\integration\ai\match-embedding-filters.test.ts-12-    expect(sql).toContain("p_modules");
tests\integration\ai\match-embedding-filters.test.ts-13-    expect(sql).toContain("metadata->>'module'");
tests\integration\ai\match-embedding-filters.test.ts-14-    expect(sql).toContain("p_min_similarity");
--
tests\integration\ai\embedding-retrieval-filter.test.ts:6:  it("filters out failed chunks in match_ai_embeddings", () => {
tests\integration\ai\embedding-retrieval-filter.test.ts-7-    const migrationPath = resolve(process.cwd(), "supabase/migrations/20260105140000_embedding_chunk_status.sql");
tests\integration\ai\embedding-retrieval-filter.test.ts-8-    const sql = readFileSync(migrationPath, "utf8");
tests\integration\ai\embedding-retrieval-filter.test.ts-9-    expect(sql).toContain("embedding_status = 'ok'");
tests\integration\ai\embedding-retrieval-filter.test.ts-10-  });
tests\integration\ai\embedding-retrieval-filter.test.ts-11-});
--
src\integrations\supabase\types.ts:5995:      match_ai_embeddings: {
src\integrations\supabase\types.ts-5996-        Args: {
src\integrations\supabase\types.ts-5997-          p_agency_id: string
src\integrations\supabase\types.ts-5998-          p_client_id?: string
src\integrations\supabase\types.ts-5999-          p_doc_types?: string[]
src\integrations\supabase\types.ts-6000-          p_match_count?: number
--
supabase\functions\ai-strategy-generate\index.ts:422:  const { data: clientMatches, error: clientMatchesError } = await supabase.rpc("match_ai_embeddings", {
supabase\functions\ai-strategy-generate\index.ts-423-    p_agency_id: agencyId,
supabase\functions\ai-strategy-generate\index.ts-424-    p_client_id: clientId,
supabase\functions\ai-strategy-generate\index.ts-425-    p_query_embedding: queryEmbedding,
supabase\functions\ai-strategy-generate\index.ts-426-    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.client_memory_top_k : 6),
supabase\functions\ai-strategy-generate\index.ts-427-    p_doc_types: useRagPolicy ? ragConfig.client_doc_types : legacyClientDocTypes,
--
supabase\functions\ai-strategy-generate\index.ts:432:  const { data: agencyMatches, error: agencyMatchesError } = await supabase.rpc("match_ai_embeddings", {
supabase\functions\ai-strategy-generate\index.ts-433-    p_agency_id: agencyId,
supabase\functions\ai-strategy-generate\index.ts-434-    p_client_id: null,
supabase\functions\ai-strategy-generate\index.ts-435-    p_query_embedding: queryEmbedding,
supabase\functions\ai-strategy-generate\index.ts-436-    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.agency_memory_top_k : 4),
supabase\functions\ai-strategy-generate\index.ts-437-    p_doc_types: useRagPolicy ? ragConfig.agency_doc_types : legacyAgencyDocTypes,
--
supabase\functions\ai-strategy-generate\index.ts:442:  const { data: exemplarMatches, error: exemplarMatchesError } = await supabase.rpc("match_ai_embeddings", {
supabase\functions\ai-strategy-generate\index.ts-443-    p_agency_id: agencyId,
supabase\functions\ai-strategy-generate\index.ts-444-    p_client_id: null,
supabase\functions\ai-strategy-generate\index.ts-445-    p_query_embedding: queryEmbedding,
supabase\functions\ai-strategy-generate\index.ts-446-    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.exemplar_top_k : 2),
supabase\functions\ai-strategy-generate\index.ts-447-    p_doc_types: useRagPolicy ? ragConfig.exemplar_doc_types : legacyExemplarDocTypes,
--
supabase\functions\_shared\agency-admin-general-ai.ts:501:    const { data: matches } = await opts.supabase.rpc("match_ai_embeddings", {
supabase\functions\_shared\agency-admin-general-ai.ts-502-      p_agency_id: opts.agencyId,
supabase\functions\_shared\agency-admin-general-ai.ts-503-      p_client_id: null,
supabase\functions\_shared\agency-admin-general-ai.ts-504-      p_query_embedding: queryEmbedding,
supabase\functions\_shared\agency-admin-general-ai.ts-505-      p_match_count: clampMatchCount(5),
supabase\functions\_shared\agency-admin-general-ai.ts-506-      p_doc_types: null,
--
supabase\functions\ai-retrieve-context\index.ts:129:  const { data: matches, error: matchError } = await supabase.rpc("match_ai_embeddings", {
supabase\functions\ai-retrieve-context\index.ts-130-    p_agency_id: agencyId,
supabase\functions\ai-retrieve-context\index.ts-131-    p_client_id: clientId ?? null,
supabase\functions\ai-retrieve-context\index.ts-132-    p_query_embedding: queryEmbedding,
supabase\functions\ai-retrieve-context\index.ts-133-    p_match_count: clampMatchCount(topK),
supabase\functions\ai-retrieve-context\index.ts-134-    p_doc_types: docTypes,
--
supabase\functions\ai-rep-chat\index.ts:29:    const { data: matches, error } = await opts.supabase.rpc("match_ai_embeddings", {
supabase\functions\ai-rep-chat\index.ts-30-      p_agency_id: opts.agencyId,
supabase\functions\ai-rep-chat\index.ts-31-      p_client_id: opts.clientId,
supabase\functions\ai-rep-chat\index.ts-32-      p_query_embedding: queryEmbedding,
supabase\functions\ai-rep-chat\index.ts-33-      p_match_count: clampMatchCount(6),
supabase\functions\ai-rep-chat\index.ts-34-      p_doc_types: null,
--
supabase\functions\ai-ask\index.ts:353:  const { data: clientMatches } = await supabase.rpc("match_ai_embeddings", {
supabase\functions\ai-ask\index.ts-354-    p_agency_id: agencyId,
supabase\functions\ai-ask\index.ts-355-    p_client_id: clientId ?? null,
supabase\functions\ai-ask\index.ts-356-    p_query_embedding: queryEmbedding,
supabase\functions\ai-ask\index.ts-357-    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.client_memory_top_k : CLIENT_MEMORY_TOP_K),
supabase\functions\ai-ask\index.ts-358-    p_doc_types: useRagPolicy ? ragConfig.client_doc_types : legacyClientDocTypes,
--
supabase\functions\ai-ask\index.ts:363:  const { data: agencyMatches } = await supabase.rpc("match_ai_embeddings", {
supabase\functions\ai-ask\index.ts-364-    p_agency_id: agencyId,
supabase\functions\ai-ask\index.ts-365-    p_client_id: null,
supabase\functions\ai-ask\index.ts-366-    p_query_embedding: queryEmbedding,
supabase\functions\ai-ask\index.ts-367-    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.agency_memory_top_k : AGENCY_MEMORY_TOP_K),
supabase\functions\ai-ask\index.ts-368-    p_doc_types: useRagPolicy ? ragConfig.agency_doc_types : legacyAgencyDocTypes,
--
supabase\functions\ai-ask\index.ts:373:  const { data: exemplarMatches } = await supabase.rpc("match_ai_embeddings", {
supabase\functions\ai-ask\index.ts-374-    p_agency_id: agencyId,
supabase\functions\ai-ask\index.ts-375-    p_client_id: null,
supabase\functions\ai-ask\index.ts-376-    p_query_embedding: queryEmbedding,
supabase\functions\ai-ask\index.ts-377-    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.exemplar_top_k : EXEMPLAR_TOP_K),
supabase\functions\ai-ask\index.ts-378-    p_doc_types: useRagPolicy ? ragConfig.exemplar_doc_types : legacyExemplarDocTypes,
```

### Migration grep (embedding-related lines filtered for create/model/dimension)

```text

supabase/migrations\20251223150000_ai_employee_v1_sprint1.sql:71:create table if not exists public.ai_embeddings (
supabase/migrations\20251223150000_ai_employee_v1_sprint1.sql:159:create index if not exists idx_ai_embeddings_filter 
on public.ai_embeddings(agency_id, client_id, doc_type);
supabase/migrations\20251223150000_ai_employee_v1_sprint1.sql:258:create policy "ai_embeddings_select" on 
public.ai_embeddings
supabase/migrations\20251223150000_ai_employee_v1_sprint1.sql:262:create policy "ai_embeddings_insert" on 
public.ai_embeddings
supabase/migrations\20251223150000_ai_employee_v1_sprint1.sql:266:create policy "ai_embeddings_update" on 
public.ai_embeddings
supabase/migrations\20251223150000_ai_employee_v1_sprint1.sql:270:create policy "ai_embeddings_delete" on 
public.ai_embeddings
supabase/migrations\20251224103000_strategy_docs_and_embeddings.sql:26:create or replace function 
public.match_ai_embeddings(
supabase/migrations\20251224103000_strategy_docs_and_embeddings.sql:76:create policy "ai_embeddings_select_service" on 
public.ai_embeddings
supabase/migrations\20251224090000_brain_spine_v1.sql:64:create or replace function public.match_ai_embeddings(
supabase/migrations\20251228120000_ai_ops_metrics_views.sql:11:      when model ilike 'gpt-%' or model ilike 
'text-embedding-%' then 'openai'
supabase/migrations\20251228120000_ai_ops_metrics_views.sql:18:        or model in ('context-missing', 
'embeddings-not-configured', 'retrieval-only')
supabase/migrations\20251228120000_ai_ops_metrics_views.sql:178:create or replace view public.v_ai_embeddings_health as
supabase/migrations\20251228120000_ai_ops_metrics_views.sql:193:        or model in ('embeddings-not-configured', 
'embedding-error')
supabase/migrations\20260105140000_embedding_chunk_status.sql:11:create or replace function public.match_ai_embeddings(
supabase/migrations\20260108123000_brain_documents_rag.sql:27:create or replace function public.match_ai_embeddings(
supabase/migrations\20260108134500_match_ai_embeddings_filters.sql:11:create or replace function 
public.match_ai_embeddings(


```

### `match_ai_embeddings` SQL migration(s)

```sql
=== 20251224133000_harden_match_ai_embeddings_exec.sql ===
-- Harden match_ai_embeddings execution to service role only

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from public;

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from anon;

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from authenticated;

grant execute on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) to service_role;

=== 20260108134500_match_ai_embeddings_filters.sql ===
-- Add filters and thresholds to match_ai_embeddings

drop function if exists public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
);

create or replace function public.match_ai_embeddings(
  p_agency_id uuid,
  p_query_embedding vector(1536),
  p_client_id uuid default null,
  p_match_count int default 8,
  p_doc_types text[] default null,
  p_modules text[] default null,
  p_min_similarity float8 default 0.2
)
returns table (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8,
  title text,
  source jsonb,
  source_url text
)
language sql
stable
as $$
  select
    e.document_id,
    e.chunk_id,
    e.doc_type,
    c.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    d.title,
    d.source,
    d.source_url
  from public.ai_embeddings e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where d.agency_id = p_agency_id
    and c.embedding_status = 'ok'
    and (p_client_id is null or d.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
    and (p_modules is null or (d.metadata->>'module') = any(p_modules))
    and (e.doc_type <> 'brain_document' or (d.metadata->>'status') = 'approved')
    and (1 - (e.embedding <=> p_query_embedding)) >= p_min_similarity
  order by e.embedding <=> p_query_embedding
  limit least(p_match_count, 12);
$$;

=== 20260118000001_harden_match_ai_embeddings_final.sql ===
-- SECURITY CRITICAL: Restrict match_ai_embeddings to service_role only
do $$
declare
  func_sig text;
begin
  for func_sig in
    select pg_get_function_identity_arguments(p.oid)
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public'
      and p.proname = 'match_ai_embeddings'
  loop
    execute format('revoke all on function public.match_ai_embeddings(%s) from anon', func_sig);
    execute format('revoke all on function public.match_ai_embeddings(%s) from authenticated', func_sig);
    execute format('revoke all on function public.match_ai_embeddings(%s) from public', func_sig);
    execute format('grant execute on function public.match_ai_embeddings(%s) to service_role', func_sig);
  end loop;
end $$;


```

## Verification SQL/Commands
```bash
# Identify all TS call sites
rg -n "match_ai_embeddings" -S src supabase/functions

# Verify the hardening migration exists
ls supabase/migrations/*harden_match_ai_embeddings_final*.sql
```

```sql
-- Confirm embeddings exist for a given agency brain doc
SELECT e.id, e.doc_type, e.model, e.metadata
FROM ai_embeddings e
WHERE e.agency_id = :agency_id AND e.doc_type='brain_document'
ORDER BY e.created_at DESC
LIMIT 20;

-- Validate privilege hardening (run in DB as superuser/admin)
-- Note: function signature must match your deployment; see migration for exact signatures.
SELECT has_function_privilege('service_role', 'public.match_ai_embeddings', 'execute') AS service_ok;
SELECT has_function_privilege('authenticated', 'public.match_ai_embeddings', 'execute') AS auth_blocked;
```

## Problems Found
1. Multi-tenant safety depends on both (a) correct filtering inside `match_ai_embeddings` and (b) restrictive privileges so only service-role callers can execute the RPC.
2. Retrieval correctness depends on doc_type selection; the system has both legacy doc_type lists (in edge functions) and a `ragPolicy` path, increasing complexity.
3. Embedding failures can leave chunks with `embedding_status='failed'` and reduce RAG coverage; downstream systems need to surface this clearly.

## Recommendations
1. Ensure `match_ai_embeddings` is service-role only in production and add deployment checks for privilege drift.
2. Prefer `ragPolicy` doc_type allowlists and remove legacy doc_type lists to reduce divergence.
3. Add a UI/admin surface that shows embedding failure counts per brain document/module and provides a “re-index” action.
