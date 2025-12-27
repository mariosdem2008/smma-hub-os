export type Citation = {
  doc_id?: string;
  chunk_id?: string;
  doc_type?: string;
  similarity?: number;
};

export type CitationSources = {
  memory_citations?: Citation[];
  client_brain_fields?: string[];
  agency_brain_fields?: string[];
};

export type CitationValidationResult = {
  valid: boolean;
  errors: string[];
  coverage: number;
};

export function validateCitations(
  output: { sources?: CitationSources; unknown?: boolean; escalate_to_human?: boolean },
  ragMatches: Array<{ doc_id?: string; document_id?: string }>,
): CitationValidationResult {
  const errors: string[] = [];
  const sources = output.sources ?? {};
  const memoryCitations = sources.memory_citations ?? [];
  const clientBrainFields = sources.client_brain_fields ?? [];
  const agencyBrainFields = sources.agency_brain_fields ?? [];

  const hasCitations = memoryCitations.length > 0 || clientBrainFields.length > 0 || agencyBrainFields.length > 0;
  const requiresCitations = !output.unknown && !output.escalate_to_human;
  if (requiresCitations && !hasCitations) {
    errors.push("missing_citations");
  }

  const validDocIds = new Set(
    ragMatches
      .map((match) => match.doc_id ?? match.document_id)
      .filter((value): value is string => typeof value === "string"),
  );
  for (const citation of memoryCitations) {
    if (!citation.doc_id || !validDocIds.has(citation.doc_id)) {
      errors.push(`invalid_citation:${citation.doc_id ?? "missing_doc_id"}`);
    }
  }

  const coverage = ragMatches.length > 0 ? memoryCitations.length / ragMatches.length : 0;
  return { valid: errors.length === 0, errors, coverage };
}
