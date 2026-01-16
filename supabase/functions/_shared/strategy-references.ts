export type StrategyMatchRow = {
  doc_type: string;
  document_id?: string | null;
  chunk_id?: string | null;
  chunk_text?: string | null;
  score?: number | null;
};

export type BrainDocumentReference = {
  module: string | null;
  title: string | null;
  brain_document_id: string | null;
  version: number | null;
};

type AiDocumentRow = {
  id: string;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function buildBrainDocumentReferences(args: {
  matches: StrategyMatchRow[];
  aiDocuments: AiDocumentRow[];
  maxReferences?: number;
}): BrainDocumentReference[] {
  const maxReferences = args.maxReferences ?? 20;
  const matches = args.matches ?? [];
  const aiDocuments = args.aiDocuments ?? [];

  const brainDocumentIds = new Set(
    matches
      .filter((row) => row.doc_type === "brain_document")
      .map((row) => normalizeString(row.document_id))
      .filter((id): id is string => Boolean(id)),
  );

  if (brainDocumentIds.size === 0) return [];

  const refs: BrainDocumentReference[] = [];

  for (const doc of aiDocuments) {
    if (!brainDocumentIds.has(doc.id)) continue;
    const module = normalizeString(doc.metadata?.module);
    const title = normalizeString(doc.title) ?? normalizeString(doc.metadata?.title);
    const brainDocumentId = normalizeString(doc.metadata?.brain_document_id);
    const version = normalizeNumber(doc.metadata?.version);
    refs.push({
      module,
      title,
      brain_document_id: brainDocumentId,
      version,
    });
  }

  refs.sort((a, b) => {
    const moduleCmp = String(a.module ?? "").localeCompare(String(b.module ?? ""));
    if (moduleCmp) return moduleCmp;
    const titleCmp = String(a.title ?? "").localeCompare(String(b.title ?? ""));
    if (titleCmp) return titleCmp;
    const idCmp = String(a.brain_document_id ?? "").localeCompare(String(b.brain_document_id ?? ""));
    if (idCmp) return idCmp;
    return Number(a.version ?? -1) - Number(b.version ?? -1);
  });

  return refs.slice(0, Math.max(0, maxReferences));
}

export function formatBrainDocumentReferencesMarkdown(args: {
  references: BrainDocumentReference[];
  maxReferences?: number;
}): string {
  const maxReferences = args.maxReferences ?? 20;
  const refs = (args.references ?? []).slice(0, Math.max(0, maxReferences));
  if (refs.length === 0) return "References:\n(none)";

  const lines = refs.map((ref) => {
    const module = ref.module ?? "unknown";
    const title = ref.title ?? "untitled";
    const brainDocumentId = ref.brain_document_id ?? "unknown";
    const version = ref.version ?? null;
    return `- module=${module} title="${title}" brain_document_id=${brainDocumentId} version=${version ?? "unknown"}`;
  });

  return `References:\n${lines.join("\n")}`;
}

