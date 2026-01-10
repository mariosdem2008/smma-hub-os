export type SeedDefaultBrainPackRequest = {
  agency_id?: string;
};

export type SeedDefaultBrainPackError = {
  stage: "auth" | "resolve_agency" | "membership" | "agency_fetch" | "seed_rpc" | "approve" | "ingest";
  document_id?: string;
  message: string;
};

export type SeedDefaultBrainPackResult = {
  seeded: boolean;
  document_ids: string[];
  approved: boolean;
  ingested: boolean;
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
  renderPack: (fields: { agency_name: string; agency_website: string; agency_niche: string }) => Array<{
    module: string;
    title: string;
    content_json: Record<string, unknown>;
  }>;
  approveBrainDocument: (supabase: any, documentId: string, approvedBy?: string) => Promise<any>;
  ingestBrainDocumentForRag: (supabase: any, doc: any) => Promise<any>;
  log: (level: "info" | "error", event: string, payload: Record<string, unknown>) => void;
}): Promise<SeedDefaultBrainPackResult> {
  const { supabase, userId, agencyId, renderPack, approveBrainDocument, ingestBrainDocumentForRag, log } = opts;

  const errors: SeedDefaultBrainPackError[] = [];

  const { data: agencyRow, error: agencyError }: SupabaseResult<AgencyRow> = await supabase
    .from("agencies")
    .select("id, name, website, niche")
    .eq("id", agencyId)
    .single();

  if (agencyError || !agencyRow) {
    const message = agencyError?.message ?? "Failed to fetch agency";
    log("error", "seed_default_brain_pack_v1_agency_fetch_failed", { agencyId, userId, message });
    return { seeded: false, document_ids: [], approved: false, ingested: false, errors: [{ stage: "agency_fetch", message }] };
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
      document_ids: [],
      approved: false,
      ingested: false,
      errors: [{ stage: "seed_rpc", message }],
    };
  }

  const inserted = seedRows ?? [];
  if (inserted.length === 0) {
    return { seeded: false, document_ids: [], approved: false, ingested: false };
  }

  const documentIds = inserted.map((row) => row.document_id);

  let allApproved = true;
  let allIngested = true;

  for (const documentId of documentIds) {
    try {
      const approvedDoc = await approveBrainDocument(supabase as any, documentId, userId);
      try {
        await ingestBrainDocumentForRag(supabase as any, approvedDoc);
      } catch (err: any) {
        allIngested = false;
        const message = err?.message ?? "Ingest failed";
        errors.push({ stage: "ingest", document_id: documentId, message });
        log("error", "seed_default_brain_pack_v1_ingest_failed", { agencyId, userId, documentId, message });
      }
    } catch (err: any) {
      allApproved = false;
      allIngested = false;
      const message = err?.message ?? "Approve failed";
      errors.push({ stage: "approve", document_id: documentId, message });
      log("error", "seed_default_brain_pack_v1_approve_failed", { agencyId, userId, documentId, message });
    }
  }

  const result: SeedDefaultBrainPackResult = {
    seeded: true,
    document_ids: documentIds,
    approved: allApproved,
    ingested: allIngested,
  };

  if (errors.length) result.errors = errors;
  return result;
}

