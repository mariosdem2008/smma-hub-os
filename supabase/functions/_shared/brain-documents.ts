/**
 * Brain Documents Helper Functions
 *
 * Server-side utilities for working with the versioned brain document system.
 * Used by Supabase Edge Functions for brain document CRUD operations.
 */

import { buildChunks, embedText, getExpectedEmbeddingDim, tokenize } from "./embeddings.ts";
import { embedWithPolicy } from "./embedding-policy.ts";
import { persistEmbeddingResult } from "./embedding-store.ts";

type MaybeSingleResult<T> = { data: T | null; error?: { message?: string } | null };
type MaybeArrayResult<T> = { data: T[] | null; error?: { message?: string } | null };

type MinimalSupabase = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

/**
 * Brain module types (matches PostgreSQL enum)
 */
export const BRAIN_MODULES = [
  "bootstrap",
  "rep_policy",
  "sop_strategy",
  "sop_scripting",
  "tone_voice",
  "faq_objections",
  "ai_permissions",
  "offer_stack",
  "quality_bar",
] as const;

export type BrainModule = (typeof BRAIN_MODULES)[number];

/**
 * Brain document status types (matches PostgreSQL enum)
 */
export const BRAIN_DOCUMENT_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "archived",
] as const;

export type BrainDocumentStatus = (typeof BRAIN_DOCUMENT_STATUSES)[number];

/**
 * Brain document source types (matches PostgreSQL enum)
 */
export const BRAIN_DOCUMENT_SOURCES = [
  "onboarding",
  "chat",
  "manual",
  "ai_proposed",
] as const;

export type BrainDocumentSource = (typeof BRAIN_DOCUMENT_SOURCES)[number];

/**
 * Brain document record from database
 */
export interface BrainDocument {
  id: string;
  agency_id: string;
  module: BrainModule;
  title: string;
  content_json: Record<string, unknown>;
  status: BrainDocumentStatus;
  version: number;
  approved_at: string | null;
  approved_by: string | null;
  parent_version_id: string | null;
  source: BrainDocumentSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const CHUNK_SIZE_TOKENS = 900;
const OVERLAP_TOKENS = 140;
const MAX_CHUNKS = 120;
const MAX_EXTRACTED_CHARS = 150000;

/**
 * Brain document version record
 */
export interface BrainDocumentVersion {
  id: string;
  document_id: string;
  version: number;
  content_json: Record<string, unknown>;
  diff_json: Record<string, unknown> | null;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

/**
 * Calibration state for idempotent setup flow
 */
export interface CalibrationState {
  session_id: string;
  current_step: string | null;
  answered_keys: string[];
  last_question_id: string | null;
  last_question_hash: string | null;
  completed_at: string | null;
}

/**
 * Default empty calibration state
 */
export const EMPTY_CALIBRATION_STATE: CalibrationState = {
  session_id: "",
  current_step: null,
  answered_keys: [],
  last_question_id: null,
  last_question_hash: null,
  completed_at: null,
};

/**
 * Fetch all approved brain documents for an agency
 */
export async function fetchApprovedBrainDocuments(
  supabase: MinimalSupabase,
  agencyId: string
): Promise<BrainDocument[]> {
  const res: MaybeArrayResult<BrainDocument> = await supabase
    .from("brain_documents")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("status", "approved")
    .order("module");

  if (res?.error) {
    throw new Error(res.error.message ?? "Failed to fetch approved brain documents");
  }

  return res?.data ?? [];
}

/**
 * Fetch a specific brain document by module
 * Returns the approved version if exists, otherwise the latest draft
 */
export async function fetchBrainDocument(
  supabase: MinimalSupabase,
  agencyId: string,
  module: BrainModule
): Promise<BrainDocument | null> {
  // Try approved first
  const approvedRes: MaybeSingleResult<BrainDocument> = await supabase
    .from("brain_documents")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("module", module)
    .eq("status", "approved")
    .maybeSingle();

  if (approvedRes?.data) {
    return approvedRes.data;
  }

  // Fall back to latest draft
  const draftRes: MaybeSingleResult<BrainDocument> = await supabase
    .from("brain_documents")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("module", module)
    .in("status", ["draft", "pending_approval"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftRes?.error) {
    throw new Error(draftRes.error.message ?? "Failed to fetch brain document");
  }

  return draftRes?.data ?? null;
}

/**
 * Fetch all brain documents for an agency (including drafts)
 */
export async function fetchAllBrainDocuments(
  supabase: MinimalSupabase,
  agencyId: string
): Promise<BrainDocument[]> {
  const res: MaybeArrayResult<BrainDocument> = await supabase
    .from("brain_documents")
    .select("*")
    .eq("agency_id", agencyId)
    .neq("status", "archived")
    .order("module")
    .order("updated_at", { ascending: false });

  if (res?.error) {
    throw new Error(res.error.message ?? "Failed to fetch brain documents");
  }

  return res?.data ?? [];
}

/**
 * Create a new brain document draft
 */
export async function createBrainDocumentDraft(
  supabase: MinimalSupabase,
  agencyId: string,
  module: BrainModule,
  title: string,
  contentJson: Record<string, unknown>,
  source: BrainDocumentSource = "manual",
  createdBy?: string
): Promise<BrainDocument> {
  const insertData: Record<string, unknown> = {
    agency_id: agencyId,
    module,
    title,
    content_json: contentJson,
    status: "draft",
    source,
  };

  if (createdBy) {
    insertData.created_by = createdBy;
  }

  const res: MaybeSingleResult<BrainDocument> = await supabase
    .from("brain_documents")
    .insert(insertData)
    .select("*")
    .single();

  if (res?.error) {
    throw new Error(res.error.message ?? "Failed to create brain document draft");
  }

  if (!res?.data) {
    throw new Error("No data returned after creating brain document");
  }

  // Create initial version record
  await supabase.from("brain_document_versions").insert({
    document_id: res.data.id,
    version: 1,
    content_json: contentJson,
    change_summary: "Initial draft created",
    created_by: createdBy ?? null,
  });

  return res.data;
}

/**
 * Update a brain document (creates new version)
 */
export async function updateBrainDocument(
  supabase: MinimalSupabase,
  documentId: string,
  contentJson: Record<string, unknown>,
  changeSummary?: string,
  updatedBy?: string
): Promise<BrainDocument> {
  // Get current document
  const currentRes: MaybeSingleResult<BrainDocument> = await supabase
    .from("brain_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (currentRes?.error || !currentRes?.data) {
    throw new Error(currentRes?.error?.message ?? "Document not found");
  }

  const current = currentRes.data;

  if (current.status === "approved") {
    throw new Error("Cannot edit approved document directly. Create a new draft instead.");
  }

  const newVersion = current.version + 1;

  // Update document
  const updateRes: MaybeSingleResult<BrainDocument> = await supabase
    .from("brain_documents")
    .update({
      content_json: contentJson,
      version: newVersion,
    })
    .eq("id", documentId)
    .select("*")
    .single();

  if (updateRes?.error || !updateRes?.data) {
    throw new Error(updateRes?.error?.message ?? "Failed to update brain document");
  }

  // Create version record
  await supabase.from("brain_document_versions").insert({
    document_id: documentId,
    version: newVersion,
    content_json: contentJson,
    change_summary: changeSummary ?? "Content updated",
    created_by: updatedBy ?? null,
  });

  return updateRes.data;
}

/**
 * Approve a brain document
 */
export async function approveBrainDocument(
  supabase: MinimalSupabase,
  documentId: string,
  approvedBy?: string
): Promise<BrainDocument> {
  // Get document
  const docRes: MaybeSingleResult<BrainDocument> = await supabase
    .from("brain_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (docRes?.error || !docRes?.data) {
    throw new Error(docRes?.error?.message ?? "Document not found");
  }

  const doc = docRes.data;

  // Archive existing approved document for this module
  await supabase
    .from("brain_documents")
    .update({ status: "archived" })
    .eq("agency_id", doc.agency_id)
    .eq("module", doc.module)
    .eq("status", "approved")
    .neq("id", documentId);

  // Approve the document
  const updateData: Record<string, unknown> = {
    status: "approved",
    approved_at: new Date().toISOString(),
  };

  if (approvedBy) {
    updateData.approved_by = approvedBy;
  }

  const updateRes: MaybeSingleResult<BrainDocument> = await supabase
    .from("brain_documents")
    .update(updateData)
    .eq("id", documentId)
    .select("*")
    .single();

  if (updateRes?.error || !updateRes?.data) {
    throw new Error(updateRes?.error?.message ?? "Failed to approve brain document");
  }

  return updateRes.data;
}

/**
 * Fetch version history for a document
 */
export async function fetchDocumentHistory(
  supabase: MinimalSupabase,
  documentId: string
): Promise<BrainDocumentVersion[]> {
  const res: MaybeArrayResult<BrainDocumentVersion> = await supabase
    .from("brain_document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("version", { ascending: false });

  if (res?.error) {
    throw new Error(res.error.message ?? "Failed to fetch document history");
  }

  return res?.data ?? [];
}

/**
 * Fetch calibration state from agency brain
 */
export async function fetchCalibrationState(
  supabase: MinimalSupabase,
  agencyId: string
): Promise<CalibrationState> {
  const res: MaybeSingleResult<{ calibration_state: CalibrationState | null }> = await supabase
    .from("agency_brains")
    .select("calibration_state")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res?.error) {
    throw new Error(res.error.message ?? "Failed to fetch calibration state");
  }

  return res?.data?.calibration_state ?? { ...EMPTY_CALIBRATION_STATE };
}

/**
 * Update calibration state in agency brain
 */
export async function updateCalibrationState(
  supabase: MinimalSupabase,
  agencyId: string,
  state: CalibrationState
): Promise<void> {
  // Get agency brain ID
  const brainRes: MaybeSingleResult<{ id: string }> = await supabase
    .from("agency_brains")
    .select("id")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (brainRes?.error) {
    throw new Error(brainRes.error.message ?? "Failed to fetch agency brain");
  }

  if (!brainRes?.data) {
    // No brain exists yet, create one
    const insertRes = await supabase
      .from("agency_brains")
      .insert({
        agency_id: agencyId,
        version: 1,
        status: "draft",
        locked: false,
        brain_json: {},
        calibration_state: state,
        confidence: 0,
      })
      .select("id")
      .single();

    if (insertRes?.error) {
      throw new Error(insertRes.error.message ?? "Failed to create agency brain");
    }
    return;
  }

  // Update existing brain
  const updateRes = await supabase
    .from("agency_brains")
    .update({ calibration_state: state })
    .eq("id", brainRes.data.id);

  if (updateRes?.error) {
    throw new Error(updateRes.error.message ?? "Failed to update calibration state");
  }
}

/**
 * Mark a question as answered in calibration state
 */
export async function markQuestionAnswered(
  supabase: MinimalSupabase,
  agencyId: string,
  questionKey: string
): Promise<CalibrationState> {
  const currentState = await fetchCalibrationState(supabase, agencyId);

  // Don't add duplicates
  if (currentState.answered_keys.includes(questionKey)) {
    return currentState;
  }

  const newState: CalibrationState = {
    ...currentState,
    answered_keys: [...currentState.answered_keys, questionKey],
    current_step: null, // Will be set by next question selection
    last_question_id: null,
    last_question_hash: null,
  };

  await updateCalibrationState(supabase, agencyId, newState);
  return newState;
}

/**
 * Check if a question has already been answered (idempotency check)
 */
export function isQuestionAnswered(
  state: CalibrationState,
  questionKey: string
): boolean {
  return state.answered_keys.includes(questionKey);
}

/**
 * Generate a hash for idempotency token
 */
export function generateQuestionHash(
  questionKey: string,
  questionText: string
): string {
  // Simple hash for deduplication
  const input = `${questionKey}:${questionText}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Build a resolved brain context from approved documents
 * Maps modules to a single context object for AI consumption
 */
export async function buildResolvedBrainContext(
  supabase: MinimalSupabase,
  agencyId: string,
  requiredModules?: BrainModule[]
): Promise<Record<string, Record<string, unknown>>> {
  const documents = await fetchApprovedBrainDocuments(supabase, agencyId);

  const context: Record<string, Record<string, unknown>> = {};

  for (const doc of documents) {
    // If specific modules required, filter
    if (requiredModules && !requiredModules.includes(doc.module)) {
      continue;
    }
    context[doc.module] = doc.content_json;
  }

  return context;
}

/**
 * Check which required modules are missing or incomplete
 */
export async function findMissingModules(
  supabase: MinimalSupabase,
  agencyId: string,
  requiredModules: BrainModule[]
): Promise<BrainModule[]> {
  const documents = await fetchApprovedBrainDocuments(supabase, agencyId);
  const approvedModules = new Set(documents.map((d) => d.module));

  return requiredModules.filter((m) => !approvedModules.has(m));
}

function formatHeading(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function renderMarkdown(value: unknown, depth: number): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return value.map((item) => `- ${String(item)}`).join("\n");
    }

    return value
      .map((item, index) => {
        const itemText = renderMarkdown(item, depth + 1);
        if (!itemText) return "";
        const lines = itemText.split("\n").filter(Boolean);
        const indented = lines.map((line) => `  ${line}`).join("\n");
        return `- Item ${index + 1}\n${indented}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  if (typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>).sort();
    return entries
      .map((key) => {
        const rendered = renderMarkdown((value as Record<string, unknown>)[key], depth + 1);
        if (!rendered) return "";
        const heading = `${"#".repeat(Math.min(depth, 6))} ${formatHeading(key)}`;
        return `${heading}\n\n${rendered}`;
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}

export function brainDocumentToMarkdown(doc: BrainDocument): string {
  const title = doc.title?.trim() || formatHeading(doc.module);
  const body = renderMarkdown(doc.content_json, 2);
  if (!body) return `# ${title}`;
  return `# ${title}\n\n${body}`;
}

export async function ingestBrainDocumentForRag(
  supabase: MinimalSupabase,
  doc: BrainDocument,
  options?: {
    failHard?: boolean;
    embeddingApiKey?: string;
    embeddingModel?: string;
  }
): Promise<{ documentId: string; chunksCreated: number; tokenCount: number }> {
  const failHard = options?.failHard ?? (typeof Deno !== "undefined" && Deno.env.get("AI_EMBEDDING_FAIL_HARD") === "true");
  const embeddingApiKey =
    options?.embeddingApiKey ??
    (typeof Deno !== "undefined"
      ? (Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("OPENAI_API_KEY"))
      : typeof process !== "undefined"
      ? (process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY)
      : undefined);
  const embeddingModel =
    options?.embeddingModel ??
    (typeof Deno !== "undefined"
      ? Deno.env.get("EMBEDDING_MODEL_ID")
      : typeof process !== "undefined"
      ? process.env.EMBEDDING_MODEL_ID
      : undefined) ??
    "text-embedding-3-small";

  if (doc.status !== "approved") {
    throw new Error("Only approved brain documents can be indexed");
  }

  const markdown = brainDocumentToMarkdown(doc);
  const extractedText = markdown.slice(0, MAX_EXTRACTED_CHARS);
  const tokens = tokenize(extractedText);
  const chunks = buildChunks(tokens, CHUNK_SIZE_TOKENS, OVERLAP_TOKENS, MAX_CHUNKS);

  if (chunks.length === 0) {
    throw new Error("No content to index");
  }

  await supabase
    .from("ai_documents")
    .delete()
    .eq("agency_id", doc.agency_id)
    .eq("doc_type", "brain_document")
    .eq("metadata->>module", doc.module);

  const { data: documentRow, error: documentError } = await supabase
    .from("ai_documents")
    .insert({
      agency_id: doc.agency_id,
      client_id: null,
      doc_type: "brain_document",
      title: doc.title || formatHeading(doc.module),
      content: markdown,
      extracted_text: extractedText,
      source: { source_type: "brain_document", source_ref: doc.id },
      metadata: {
        brain_document_id: doc.id,
        module: doc.module,
        version: doc.version,
        status: doc.status,
        approved_at: doc.approved_at,
        chunk_size_tokens: CHUNK_SIZE_TOKENS,
        overlap_tokens: OVERLAP_TOKENS,
        max_chunks_per_doc: MAX_CHUNKS,
        token_count: tokens.length,
      },
    })
    .select("id")
    .single();

  if (documentError || !documentRow) {
    throw new Error(documentError?.message ?? "Failed to create ai_document for brain doc");
  }

  const expectedDim = getExpectedEmbeddingDim();

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const { data: chunkRow, error: chunkError } = await supabase
      .from("ai_document_chunks")
      .insert({
        document_id: documentRow.id,
        chunk_index: index,
        chunk_text: chunk.text,
        token_count: chunk.tokenCount,
        chunk_meta: { start_token: chunk.start, end_token: chunk.end },
        embedding_status: "failed",
      })
      .select("id")
      .single();

    if (chunkError || !chunkRow) {
      throw new Error(chunkError?.message ?? "Failed to create chunk");
    }

    const embeddingResult = await embedWithPolicy({
      text: chunk.text,
      apiKey: embeddingApiKey ?? undefined,
      failHard,
      embed: (text) => embedText(text, embeddingApiKey ?? "", embeddingModel),
    });

    const persistResult = await persistEmbeddingResult({
      supabase,
      chunkId: chunkRow.id,
      embeddingResult,
      embeddingPayload: {
        agency_id: doc.agency_id,
        client_id: null,
        doc_type: "brain_document",
        document_id: documentRow.id,
        chunk_id: chunkRow.id,
        embedding: [],
        model: embeddingModel,
        metadata: {
          similarity: "cosine",
          embedding_dim: expectedDim,
        },
      },
    });

    if (!persistResult.stored && persistResult.errorCode === "EMBEDDING_DIM_MISMATCH") {
      throw new Error("Embedding dimension mismatch");
    }
  }

  return {
    documentId: documentRow.id,
    chunksCreated: chunks.length,
    tokenCount: tokens.length,
  };
}
