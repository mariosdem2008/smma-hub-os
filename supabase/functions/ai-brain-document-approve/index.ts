import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { approveBrainDocument, ingestBrainDocumentForRag } from "../_shared/brain-documents.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

  const guardResponse = getEndpointGuardResponse("ai-brain-document-approve", corsHeaders(req));
  if (guardResponse) return guardResponse;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401, corsHeaders(req));
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
  }

  const body = await req.json().catch(() => ({}));
  const documentId = body.document_id as string | undefined;
  if (!documentId) {
    return jsonResponse({ error: "document_id is required" }, 400, corsHeaders(req));
  }

  const { data: docRow, error: docError } = await supabase
    .from("brain_documents")
    .select("id, agency_id")
    .eq("id", documentId)
    .maybeSingle();

  if (docError || !docRow) {
    return jsonResponse({ error: "Document not found" }, 404, corsHeaders(req));
  }

  const { data: membership } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", user.id)
    .eq("agency_id", docRow.agency_id)
    .maybeSingle();

  if (!membership) {
    return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
  }

  try {
    const approvedDoc = await approveBrainDocument(supabase as any, documentId, user.id);
    const ragResult = await ingestBrainDocumentForRag(supabase as any, approvedDoc);
    return jsonResponse({ ok: true, document: approvedDoc, rag: ragResult }, 200, corsHeaders(req));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve brain document";
    return jsonResponse({ error: message }, 500, corsHeaders(req));
  }
});
