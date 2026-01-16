export type SeedDefaultBrainPackRequest = {
  agency_id?: string;
  mode?: "seed_or_repair" | "seed" | "repair" | "ingest_only";
};

export type SeedDefaultBrainPackError = {
  stage:
    | "auth"
    | "resolve_agency"
    | "membership"
    | "agency_fetch"
    | "seed_rpc"
    | "repair_rpc"
    | "ingest_only"
    | "approve"
    | "ingest";
  document_id?: string;
  message: string;
};

export type SeedDefaultBrainPackResult = {
  seeded: boolean;
  repaired: boolean;
  inserted_count: number;
  document_ids: string[];
  ingested_count: number;
  failed_ids: string[];
  errors?: SeedDefaultBrainPackError[];
};

type AgencyRow = {
  id: string;
  name: string;
  website: string | null;
  niche: string | null;
};

type MembershipRow = {
  agency_id: string;
};

type SupabaseResult<T> = { data: T | null; error: { message?: string } | null };

export type MinimalSupabaseClient = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<SupabaseResult<any>>;
};

export function inferAgencyIdFromMemberships(
  requestedAgencyId: string | undefined,
  memberships: MembershipRow[],
): { agencyId?: string; error?: string } {
  if (requestedAgencyId) return { agencyId: requestedAgencyId };
  if (!memberships.length) return { error: "No agency membership found" };
  const unique = Array.from(new Set(memberships.map((m) => m.agency_id)));
  if (unique.length === 1) return { agencyId: unique[0] };
  return { error: "Multiple agencies found; agency_id is required" };
}

export async function seedApproveAndIngestDefaultBrainPackV1(opts: {
  supabase: MinimalSupabaseClient;
  userId: string;
  agencyId: string;
  mode?: "seed_or_repair" | "seed" | "repair" | "ingest_only";
  renderPack: (fields: { agency_name: string; agency_website: string; agency_niche: string }) => Array<{
    module: string;
    title: string;
    content_json: Record<string, unknown>;
  }>;
  approveBrainDocument: (supabase: any, documentId: string, approvedBy?: string) => Promise<any>;
  ingestBrainDocumentForRag: (supabase: any, doc: any) => Promise<any>;
  log: (level: "info" | "error", event: string, payload: Record<string, unknown>) => void;
}): Promise<SeedDefaultBrainPackResult> {
  const { supabase, userId, agencyId, mode, renderPack, approveBrainDocument, ingestBrainDocumentForRag, log } = opts;

  const errors: SeedDefaultBrainPackError[] = [];

  const { data: agencyRow, error: agencyError }: SupabaseResult<AgencyRow> = await supabase
    .from("agencies")
    .select("id, name, website, niche")
    .eq("id", agencyId)
    .single();

  if (agencyError || !agencyRow) {
    const message = agencyError?.message ?? "Failed to fetch agency";
    log("error", "seed_default_brain_pack_v1_agency_fetch_failed", { agencyId, userId, message });
    return {
      seeded: false,
      repaired: false,
      inserted_count: 0,
      document_ids: [],
      ingested_count: 0,
      failed_ids: [],
      errors: [{ stage: "agency_fetch", message }],
    };
  }

  const renderedDocs = renderPack({
    agency_name: agencyRow.name ?? "",
    agency_website: agencyRow.website ?? "",
    agency_niche: agencyRow.niche ?? "",
  });

  const seedDocsPayload = renderedDocs.map((doc) => ({
    module: doc.module,
    title: doc.title,
    content_json: doc.content_json,
    source: "onboarding",
  }));

  const requestedMode = mode ?? "seed_or_repair";
  if (requestedMode === "ingest_only") {
    // Ingest-only: re-index the latest approved defaults without creating new docs.
    const defaultModules = ["bootstrap", "rep_policy", "quality_bar"];
    const { data: approvedDocs, error: approvedDocsError } = await supabase
      .from("brain_documents")
      .select("id, agency_id, module, title, content_json, status, version, approved_at, approved_by")
      .eq("agency_id", agencyId)
      .eq("status", "approved")
      .in("module", defaultModules);

    if (approvedDocsError) {
      const message = approvedDocsError?.message ?? "Failed to fetch approved defaults";
      log("error", "seed_default_brain_pack_v1_ingest_only_fetch_failed", { agencyId, userId, message });
      return {
        seeded: false,
        repaired: false,
        inserted_count: 0,
        document_ids: [],
        ingested_count: 0,
        failed_ids: [],
        errors: [{ stage: "ingest_only", message }],
      };
    }

    const docs = (approvedDocs ?? []) as any[];
    let ingestedCount = 0;
    const failedIds: string[] = [];

    for (const doc of docs) {
      const documentId = String(doc.id);
      try {
        await ingestBrainDocumentForRag(supabase as any, doc);
        ingestedCount += 1;
      } catch (err: any) {
        const message = err?.message ?? "Ingest failed";
        failedIds.push(documentId);
        errors.push({ stage: "ingest", document_id: documentId, message });
        log("error", "seed_default_brain_pack_v1_ingest_failed", { agencyId, userId, documentId, message });
      }
    }

    const result: SeedDefaultBrainPackResult = {
      seeded: false,
      repaired: false,
      inserted_count: 0,
      document_ids: [],
      ingested_count: ingestedCount,
      failed_ids: failedIds,
    };
    if (errors.length) result.errors = errors;
    return result;
  }

  let rpcMode: "seed" | "repair";
  if (requestedMode === "seed" || requestedMode === "repair") {
    rpcMode = requestedMode;
  } else {
    const { data: anyDocs, error: anyDocsError } = await supabase
      .from("brain_documents")
      .select("id")
      .eq("agency_id", agencyId)
      .limit(1);

    if (anyDocsError) {
      const message = anyDocsError?.message ?? "Failed to check existing brain docs";
      log("error", "seed_default_brain_pack_v1_existing_docs_check_failed", { agencyId, userId, message });
      return {
        seeded: false,
        repaired: false,
        inserted_count: 0,
        document_ids: [],
        ingested_count: 0,
        failed_ids: [],
        errors: [{ stage: "seed_rpc", message }],
      };
    }

    const hasAnyBrainDocs = Array.isArray(anyDocs) ? anyDocs.length > 0 : Boolean(anyDocs);
    rpcMode = hasAnyBrainDocs ? "repair" : "seed";
  }

  let seeded = false;
  let repaired = false;
  let insertedRows: Array<{ document_id: string; module: string }> = [];

  if (rpcMode === "seed") {
    const { data: seedRows, error: seedError }: SupabaseResult<Array<{ document_id: string; module: string }>> =
      await supabase.rpc("seed_default_brain_pack_v1", {
        p_agency_id: agencyId,
        p_user_id: userId,
        p_docs: seedDocsPayload,
      });

    if (seedError) {
      const message = seedError?.message ?? "Seed RPC failed";
      log("error", "seed_default_brain_pack_v1_rpc_failed", { agencyId, userId, message });
      return {
        seeded: false,
        repaired: false,
        inserted_count: 0,
        document_ids: [],
        ingested_count: 0,
        failed_ids: [],
        errors: [{ stage: "seed_rpc", message }],
      };
    }

    insertedRows = seedRows ?? [];
    seeded = insertedRows.length > 0;
  } else {
    const { data: repairData, error: repairError }: SupabaseResult<{
      inserted_count?: number;
      inserted_document_ids?: string[];
      skipped_existing_modules?: string[];
    }> = await supabase.rpc("repair_default_brain_pack_v1", {
      p_agency_id: agencyId,
      p_user_id: userId,
      p_docs: seedDocsPayload,
    });

    if (repairError) {
      const message = repairError?.message ?? "Repair RPC failed";
      log("error", "repair_default_brain_pack_v1_rpc_failed", { agencyId, userId, message });
      return {
        seeded: false,
        repaired: false,
        inserted_count: 0,
        document_ids: [],
        ingested_count: 0,
        failed_ids: [],
        errors: [{ stage: "repair_rpc", message }],
      };
    }

    const insertedIds = (repairData as any)?.inserted_document_ids ?? [];
    insertedRows = insertedIds.map((id: string) => ({ document_id: id, module: "" }));
    repaired = insertedIds.length > 0;
  }

  const documentIds = insertedRows.map((row) => row.document_id).filter(Boolean);
  if (documentIds.length === 0) {
    return {
      seeded: false,
      repaired,
      inserted_count: 0,
      document_ids: [],
      ingested_count: 0,
      failed_ids: [],
    };
  }

  let ingestedCount = 0;
  const failedIds: string[] = [];

  for (const documentId of documentIds) {
    try {
      const approvedDoc = await approveBrainDocument(supabase as any, documentId, userId);
      try {
        await ingestBrainDocumentForRag(supabase as any, approvedDoc);
        ingestedCount += 1;
      } catch (err: any) {
        const message = err?.message ?? "Ingest failed";
        failedIds.push(documentId);
        errors.push({ stage: "ingest", document_id: documentId, message });
        log("error", "seed_default_brain_pack_v1_ingest_failed", { agencyId, userId, documentId, message });
      }
    } catch (err: any) {
      const message = err?.message ?? "Approve failed";
      failedIds.push(documentId);
      errors.push({ stage: "approve", document_id: documentId, message });
      log("error", "seed_default_brain_pack_v1_approve_failed", { agencyId, userId, documentId, message });
    }
  }

  const result: SeedDefaultBrainPackResult = {
    seeded,
    repaired,
    inserted_count: documentIds.length,
    document_ids: documentIds,
    ingested_count: ingestedCount,
    failed_ids: failedIds,
  };

  if (errors.length) result.errors = errors;
  return result;
}
