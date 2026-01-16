import { isAgencyAdminOrOwner, type MinimalAgencyMembersSupabase } from "./agency-members.ts";

type MinimalAuth = {
  getUser: (token: string) => Promise<{ data: { user: { id: string } | null } | null; error: any }>;
};

export type MinimalApproveSupabase = MinimalAgencyMembersSupabase & {
  auth: MinimalAuth;
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export async function handleBrainDocumentApproveRequest(
  req: Request,
  deps: {
    corsHeaders: Record<string, string>;
    supabase: MinimalApproveSupabase;
    approveBrainDocument: (supabase: any, documentId: string, approvedBy?: string) => Promise<any>;
    ingestBrainDocumentForRag: (supabase: any, doc: any) => Promise<any>;
  },
): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401, deps.corsHeaders);
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await deps.supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401, deps.corsHeaders);
  }

  const body = await req.json().catch(() => ({}));
  const documentId = body.document_id as string | undefined;
  if (!documentId) {
    return jsonResponse({ error: "document_id is required" }, 400, deps.corsHeaders);
  }

  const { data: docRow, error: docError } = await deps.supabase
    .from("brain_documents")
    .select("id, agency_id")
    .eq("id", documentId)
    .maybeSingle();

  if (docError || !docRow) {
    return jsonResponse({ error: "Document not found" }, 404, deps.corsHeaders);
  }

  const isAdmin = await isAgencyAdminOrOwner(deps.supabase as any, docRow.agency_id as string, user.id);
  if (!isAdmin) {
    return jsonResponse({ error: "Forbidden", code: "FORBIDDEN_ROLE" }, 403, deps.corsHeaders);
  }

  try {
    const approvedDoc = await deps.approveBrainDocument(deps.supabase as any, documentId, user.id);
    const ragResult = await deps.ingestBrainDocumentForRag(deps.supabase as any, approvedDoc);
    return jsonResponse({ ok: true, document: approvedDoc, rag: ragResult }, 200, deps.corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve brain document";
    return jsonResponse({ error: message }, 500, deps.corsHeaders);
  }
}

