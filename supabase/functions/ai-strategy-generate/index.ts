import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { evaluateClientBrainForStrategy } from "../_shared/brain-quality.ts";
import { buildChunks, DEFAULT_EMBEDDING_DIM, embedText, tokenize } from "../_shared/embeddings.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function emptySources() {
  return {
    agency_brain_fields: [],
    client_brain_fields: [],
    memory_citations: [],
  };
}

function buildUnknownResponse(gate: { missing_fields: string[]; questions: string[] }) {
  return {
    unknown: true,
    missing_fields: gate.missing_fields,
    questions: gate.questions,
    escalation: false,
  };
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

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

  const startTime = Date.now();
  const body = await req.json().catch(() => ({}));
  const agencyId = body.agency_id as string | undefined;
  const clientId = body.client_id as string | undefined;

  if (!agencyId || !clientId) {
    return jsonResponse({ error: "agency_id and client_id are required" }, 400, corsHeaders(req));
  }

  const { data: membership } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", user.id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (!membership) {
    return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
  }

  const { data: brainRow, error: brainError } = await supabase
    .from("client_brains")
    .select("id, brain_json, usable, status, updated_at")
    .eq("agency_id", agencyId)
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (brainError || !brainRow) {
    return jsonResponse({ error: "Client brain not found" }, 404, corsHeaders(req));
  }

  const gate = evaluateClientBrainForStrategy((brainRow.brain_json as any) ?? {});

  if (!gate.usable || !brainRow.usable) {
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId,
      endpoint: "ai-strategy-generate",
      model: "gate-only",
      tokens_estimate: 0,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - startTime,
      unknown: true,
    });
    return jsonResponse(buildUnknownResponse(gate), 200, corsHeaders(req));
  }

  const { data: agencyBrainRow } = await supabase
    .from("agency_brains")
    .select("brain_json")
    .eq("agency_id", agencyId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!embeddingApiKey) {
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId,
      endpoint: "ai-strategy-generate",
      model: "embeddings-not-configured",
      tokens_estimate: 0,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - startTime,
      unknown: true,
    });
    return jsonResponse(
      buildUnknownResponse({
        missing_fields: ["embedding_api_key"],
        questions: ["AI generation is not configured. Please contact support."],
      }),
      200,
      corsHeaders(req),
    );
  }

  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
  const queryEmbedding = await embedText("strategy_draft", embeddingApiKey, embeddingModel);

  const { data: clientMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: clientId,
    p_query_embedding: queryEmbedding,
    p_match_count: 6,
    p_doc_types: ["client_guidelines", "client_notes", "approved_posts", "ai_artifact", "strategy_draft"],
  });

  const { data: agencyMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: 4,
    p_doc_types: ["agency_sop"],
  });

  const { data: exemplarMatches } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: 2,
    p_doc_types: ["agency_exemplar_strategy"],
  });

  const matches = [
    ...(clientMatches || []),
    ...(agencyMatches || []),
    ...(exemplarMatches || []),
  ];

  if (matches.length === 0) {
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId,
      endpoint: "ai-strategy-generate",
      model: "retrieval-only",
      tokens_estimate: 0,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - startTime,
      unknown: true,
    });
    return jsonResponse(
      buildUnknownResponse({
        missing_fields: ["memory_context"],
        questions: ["Upload client guidelines or approvals to ground strategy."],
      }),
      200,
      corsHeaders(req),
    );
  }

  const clientBrain = (brainRow.brain_json as any) ?? {};
  const agencyBrain = (agencyBrainRow?.brain_json as any) ?? {};

  const context = truncate(
    matches.map((row: any) => `(${row.doc_type}) ${row.chunk_text}`).join("\n\n"),
    6000,
  );

  const systemPrompt =
    "You are a strategy assistant. Use only the provided brains and context. If missing, respond UNKNOWN.";
  const userPrompt = `Agency Brain:\n${JSON.stringify(agencyBrain)}\n\nClient Brain:\n${JSON.stringify(
    clientBrain,
  )}\n\nContext:\n${context}\n\nReturn JSON: {"summary":"", "sections":[{"title":"", "content":""}], "confidence":0-100}`;

  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${embeddingApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!aiResponse.ok) {
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId,
      endpoint: "ai-strategy-generate",
      model: "strategy-generation-failed",
      tokens_estimate: 0,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - startTime,
      unknown: true,
    });
    return jsonResponse(
      buildUnknownResponse({
        missing_fields: ["strategy_generation"],
        questions: ["Strategy generation failed. Please retry."],
      }),
      200,
      corsHeaders(req),
    );
  }

  const aiData = await aiResponse.json();
  const content = aiData?.choices?.[0]?.message?.content ?? "{}";
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
  const rawJson = jsonMatch ? jsonMatch[1] : content;
  const parsed = JSON.parse(rawJson);

  const strategy = {
    summary: parsed.summary || "",
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
  };

  const citations = matches.map((row: any) => ({
    doc_type: row.doc_type,
    document_id: row.document_id,
    chunk_id: row.chunk_id,
    score: row.score,
  }));

  const strategyPayload = JSON.stringify(strategy);

  const { data: docRow } = await supabase
    .from("ai_documents")
    .insert({
      agency_id: agencyId,
      client_id: clientId,
      doc_type: "strategy_draft",
      title: "Strategy draft v1",
      content: strategyPayload,
      extracted_text: strategy.summary || "Strategy draft",
      source: { source_type: "ai_strategy", source_ref: brainRow.id },
      metadata: {
        confidence: parsed.confidence ?? 70,
        brain_version: brainRow.updated_at,
      },
    })
    .select("id")
    .single();

  if (docRow?.id) {
    const tokens = tokenize(strategyPayload);
    const chunks = buildChunks(tokens, 900, 140, 12);
    const zeroVector = Array(DEFAULT_EMBEDDING_DIM).fill(0);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const { data: chunkRow } = await supabase
        .from("ai_document_chunks")
        .insert({
          document_id: docRow.id,
          chunk_index: index,
          chunk_text: chunk.text,
          token_count: chunk.tokenCount,
          chunk_meta: { start_token: chunk.start, end_token: chunk.end },
        })
        .select("id")
        .single();

      if (!chunkRow?.id) continue;

      const embeddingVector = embeddingApiKey
        ? await embedText(chunk.text, embeddingApiKey, embeddingModel)
        : zeroVector;

      await supabase.from("ai_embeddings").insert({
        agency_id: agencyId,
        client_id: clientId,
        doc_type: "strategy_draft",
        document_id: docRow.id,
        chunk_id: chunkRow.id,
        embedding: embeddingVector,
        model: embeddingModel,
        metadata: {
          similarity: "cosine",
          embedding_dim: DEFAULT_EMBEDDING_DIM,
          embedding_fallback: !embeddingApiKey,
        },
      });
    }
  }

  await supabase.from("ai_usage_logs").insert({
    agency_id: agencyId,
    client_id: clientId,
    endpoint: "ai-strategy-generate",
    model: Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini",
    tokens_estimate: Math.ceil(JSON.stringify(strategy).length / 4),
    tokens_in: Math.ceil(userPrompt.length / 4),
    tokens_out: 0,
    latency_ms: Date.now() - startTime,
    unknown: false,
  });

  return jsonResponse(
    {
      unknown: false,
      strategy,
      citations,
      confidence: parsed.confidence ?? 70,
    },
    200,
    corsHeaders(req),
  );
});
