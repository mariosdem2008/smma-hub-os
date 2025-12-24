import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const agencyId = process.env.TEST_AGENCY_ID;
const clientId = process.env.TEST_CLIENT_ID;
const otherAgencyId = process.env.TEST_OTHER_AGENCY_ID;

if (!supabaseUrl || !supabaseKey || !agencyId || !clientId || !otherAgencyId) {
  console.error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_AGENCY_ID, TEST_CLIENT_ID, TEST_OTHER_AGENCY_ID");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

const zeroVector = Array(1536).fill(0.001);

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  console.log("1) Insert minimal client brain (missing fields)...");
  const { data: brainInsert } = await supabase
    .from("client_brains")
    .insert({
      agency_id: agencyId,
      client_id: clientId,
      version: 99,
      status: "draft",
      locked: false,
      usable: false,
      brain_json: { brand_basics: { name: "" } },
      confidence: 0,
    })
    .select("id")
    .single();

  assert(brainInsert?.id, "Failed to insert client brain");

  console.log("2) Strategy gate returns UNKNOWN...");
  const { data: strategyGate } = await supabase.functions.invoke("ai-strategy-generate", {
    body: { agency_id: agencyId, client_id: clientId, mode: "draft_v1" },
  });
  assert(strategyGate?.unknown === true, "Expected unknown=true for missing fields");

  console.log("3) Insert memory doc + embeddings...");
  const { data: docRow } = await supabase
    .from("ai_documents")
    .insert({
      agency_id: agencyId,
      client_id: clientId,
      doc_type: "client_notes",
      title: "Smoke Test Notes",
      content: "Client wants premium strategy for Q1.",
      extracted_text: "Client wants premium strategy for Q1.",
      source: { source_type: "smoke_test", source_ref: "notes" },
    })
    .select("id")
    .single();

  assert(docRow?.id, "Failed to insert ai_documents");

  const { data: chunkRow } = await supabase
    .from("ai_document_chunks")
    .insert({
      document_id: docRow.id,
      chunk_index: 0,
      chunk_text: "Client wants premium strategy for Q1.",
      token_count: 7,
      chunk_meta: { start_token: 0, end_token: 7 },
    })
    .select("id")
    .single();

  assert(chunkRow?.id, "Failed to insert ai_document_chunks");

  await supabase.from("ai_embeddings").insert({
    agency_id: agencyId,
    client_id: clientId,
    doc_type: "client_notes",
    document_id: docRow.id,
    chunk_id: chunkRow.id,
    embedding: zeroVector,
    model: "smoke-test",
    metadata: { similarity: "cosine", embedding_dim: 1536 },
  });

  console.log("4) Retrieval respects agency filter...");
  const { data: matchSame } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: clientId,
    p_query_embedding: zeroVector,
    p_match_count: 3,
    p_doc_types: ["client_notes"],
  });
  assert((matchSame || []).length > 0, "Expected matches for same agency");

  const { data: matchOther } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: otherAgencyId,
    p_client_id: null,
    p_query_embedding: zeroVector,
    p_match_count: 3,
    p_doc_types: ["client_notes"],
  });
  assert((matchOther || []).length === 0, "Expected no matches for other agency");

  console.log("5) Update client brain to usable and generate strategy...");
  await supabase
    .from("client_brains")
    .update({
      brain_json: {
        brand_basics: { name: "Test Brand" },
        offer_details: { products_services: ["Offer A"] },
        audience: { problems: ["Problem A"] },
        pillars: [{ name: "Pillar A", examples: [] }],
        constraints: { banned_claims: ["No claims"], taboo_topics: [] },
        goals: ["Grow leads"],
      },
      usable: true,
      status: "usable",
    })
    .eq("id", brainInsert.id);

  const { data: strategyDraft } = await supabase.functions.invoke("ai-strategy-generate", {
    body: { agency_id: agencyId, client_id: clientId, mode: "draft_v1" },
  });

  assert(strategyDraft?.unknown === false, "Expected unknown=false for usable brain");
  assert(Array.isArray(strategyDraft?.citations), "Expected citations array");

  console.log("Smoke tests passed.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
