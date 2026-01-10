import { TaskType } from "./taskTypes.ts";
import { getEnvVar } from "./utils.ts";

export type RagConfig = {
  client_memory_top_k: number;
  client_doc_types: string[];
  agency_memory_top_k: number;
  agency_doc_types: string[];
  exemplar_top_k: number;
  exemplar_doc_types: string[];
  min_similarity: number;
  max_context_chars: number;
  max_context_tokens: number;
};

export type RagMatch = {
  doc_type: string;
  chunk_text: string;
  similarity?: number;
  score?: number;
  doc_id?: string;
  document_id?: string;
  chunk_id?: string;
};

export type RagPolicyResult = {
  context: string;
  contextTruncated: boolean;
  selectedMatches: RagMatch[];
  retrievalCount: number;
  docTypesUsed: string[];
};

const DEFAULT_RAG_CONFIG: Partial<Record<TaskType, RagConfig>> = {
  [TaskType.CLIENT_PORTAL_QA]: {
    client_memory_top_k: 6,
    client_doc_types: ["client_memory", "onboarding_v3", "strategy_plan"],
    agency_memory_top_k: 4,
    agency_doc_types: ["agency_memory", "setup_progress_v1"],
    exemplar_top_k: 2,
    exemplar_doc_types: ["exemplar"],
    min_similarity: 0.2,
    max_context_chars: 6000,
    max_context_tokens: 900,
  },
  [TaskType.STRATEGY_PLAN]: {
    // Mirrors legacy ai-strategy-generate retrieval defaults.
    client_memory_top_k: 6,
    client_doc_types: ["client_guidelines", "client_notes", "approved_posts", "ai_artifact", "strategy_draft"],
    agency_memory_top_k: 4,
    agency_doc_types: ["agency_sop", "brain_document"],
    exemplar_top_k: 2,
    exemplar_doc_types: ["agency_exemplar_strategy"],
    min_similarity: 0.2,
    max_context_chars: 6000,
    max_context_tokens: 1200,
  },
};

const FALLBACK_RAG_CONFIG: RagConfig = {
  client_memory_top_k: 0,
  client_doc_types: [],
  agency_memory_top_k: 0,
  agency_doc_types: [],
  exemplar_top_k: 0,
  exemplar_doc_types: [],
  min_similarity: 0,
  max_context_chars: 6000,
  max_context_tokens: 1200,
};

export function getRagConfig(taskType: TaskType): RagConfig {
  return DEFAULT_RAG_CONFIG[taskType] ?? FALLBACK_RAG_CONFIG;
}

function similarityScore(match: RagMatch) {
  if (typeof match.similarity === "number") return match.similarity;
  if (typeof match.score === "number") return match.score;
  return 0;
}

function selectTop(matches: RagMatch[], topK: number) {
  if (topK <= 0) return [];
  return [...matches]
    .sort((a, b) => similarityScore(b) - similarityScore(a))
    .slice(0, topK);
}

function estimateTokens(text: string) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function applyRagPolicy(matches: RagMatch[], config: RagConfig): RagPolicyResult {
  const clientMatches = matches.filter((match) => config.client_doc_types.includes(match.doc_type));
  const agencyMatches = matches.filter((match) => config.agency_doc_types.includes(match.doc_type));
  const exemplarMatches = matches.filter((match) => config.exemplar_doc_types.includes(match.doc_type));

  const preSelected = [
    ...selectTop(clientMatches, config.client_memory_top_k),
    ...selectTop(agencyMatches, config.agency_memory_top_k),
    ...selectTop(exemplarMatches, config.exemplar_top_k),
  ];

  let usedTokens = 0;
  const selectedMatches: RagMatch[] = [];
  for (const match of preSelected) {
    const tokens = estimateTokens(match.chunk_text ?? "");
    if (usedTokens + tokens > config.max_context_tokens) break;
    selectedMatches.push(match);
    usedTokens += tokens;
  }

  const contextParts = selectedMatches.map((match) => `(${match.doc_type}) ${match.chunk_text}`);
  const fullContext = contextParts.join("\n\n");

  if (fullContext.length <= config.max_context_chars) {
    return {
      context: fullContext,
      contextTruncated: selectedMatches.length < preSelected.length,
      selectedMatches,
      retrievalCount: selectedMatches.length,
      docTypesUsed: Array.from(new Set(selectedMatches.map((match) => match.doc_type))),
    };
  }

  return {
    context: `${fullContext.slice(0, config.max_context_chars)}\n...(context truncated)`,
    contextTruncated: true,
    selectedMatches,
    retrievalCount: selectedMatches.length,
    docTypesUsed: Array.from(new Set(selectedMatches.map((match) => match.doc_type))),
  };
}

function hashToBucket(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

export function shouldUseRagPolicy(ids: { agencyId?: string | null; clientId?: string | null }) {
  const raw = getEnvVar("AI_RAG_CENTRALIZED");
  if (!raw) return false;

  const normalized = raw.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  const percent = Number.parseInt(raw, 10);
  if (!Number.isFinite(percent) || percent <= 0) return false;
  if (percent >= 100) return true;

  const key = ids.clientId ?? ids.agencyId;
  if (!key) return false;
  return hashToBucket(key) < percent;
}
