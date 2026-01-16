import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { approveBrainDocument, ingestBrainDocumentForRag } from "../_shared/brain-documents.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { handleBrainDocumentApproveRequest } from "../_shared/ai-brain-document-approve-handler.ts";

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  return handleBrainDocumentApproveRequest(req, {
    corsHeaders: corsHeaders(req),
    supabase: supabase as any,
    approveBrainDocument,
    ingestBrainDocumentForRag,
  });
});
