import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);

const getArgValue = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};

const hasFlag = (name) => args.includes(name);

const envOr = (...names) => {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return null;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const formatCount = (n) => (typeof n === "number" ? n.toString() : "null");

const supabaseUrl = getArgValue("--supabase-url") ?? envOr("SUPABASE_URL", "VITE_SUPABASE_URL");
const supabaseKey =
  getArgValue("--service-role-key") ?? envOr("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");
const agencyId = getArgValue("--agency-id") ?? envOr("TEST_AGENCY_ID", "AGENCY_ID");

if (!supabaseUrl || !supabaseKey || !agencyId) {
  console.error(
    [
      "Missing required inputs.",
      "Provide via args: --supabase-url --service-role-key --agency-id",
      "Or env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + TEST_AGENCY_ID",
    ].join("\n"),
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function countRows(table, filterFn) {
  const query = filterFn(supabase.from(table)).select("id", { count: "exact", head: true });
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function listAiDocumentIdsForBrainDocs() {
  const { data, error } = await supabase
    .from("ai_documents")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("doc_type", "brain_document");
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

async function strategyCitationsSmokeTest() {
  const clientId = getArgValue("--client-id") ?? envOr("TEST_CLIENT_ID", "CLIENT_ID");
  const cronSecret = getArgValue("--cron-secret") ?? envOr("CRON_SECRET");

  if (!clientId) {
    throw new Error("Smoke test requires --client-id or TEST_CLIENT_ID env var.");
  }
  if (!cronSecret) {
    throw new Error("Smoke test requires --cron-secret or CRON_SECRET env var (so ai-strategy-generate can run in cron mode).");
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/ai-strategy-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify({
      client_id: clientId,
      instruction: "Use the agency Rep Policy and Quality Bar from Agency Brain documents. Cite sources.",
      source: "default_brain_pack_v1_verification",
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error ?? `ai-strategy-generate failed (${res.status})`);
  }

  if (json?.unknown === true) {
    const missing = Array.isArray(json?.missing_fields) ? json.missing_fields.join(", ") : "unknown";
    throw new Error(`ai-strategy-generate returned unknown=true (missing_fields: ${missing})`);
  }

  const citations = Array.isArray(json?.citations) ? json.citations : [];
  const hasBrainDocCitation = citations.some((c) => c?.doc_type === "brain_document");
  assert(hasBrainDocCitation, "Expected at least 1 citation with doc_type='brain_document'.");
  return { citationsCount: citations.length };
}

const run = async () => {
  console.log("Default Brain Pack v1 verification");
  console.log(`- agency_id: ${agencyId}`);
  console.log("");

  const brainDocs = await countRows("brain_documents", (q) => q.eq("agency_id", agencyId));
  console.log(`brain_documents (agency): ${formatCount(brainDocs)} ${brainDocs >= 3 ? "PASS" : "FAIL"}`);

  const aiDocs = await countRows("ai_documents", (q) => q.eq("agency_id", agencyId).eq("doc_type", "brain_document"));
  console.log(`ai_documents (doc_type='brain_document'): ${formatCount(aiDocs)} ${aiDocs >= 3 ? "PASS" : "FAIL"}`);

  const aiDocIds = await listAiDocumentIdsForBrainDocs();
  const chunks = aiDocIds.length
    ? await countRows("ai_document_chunks", (q) => q.in("document_id", aiDocIds))
    : 0;
  console.log(`ai_document_chunks (brain docs): ${formatCount(chunks)} ${chunks > 0 ? "PASS" : "FAIL"}`);

  const embeddings = aiDocIds.length
    ? await countRows("ai_embeddings", (q) => q.in("document_id", aiDocIds).eq("doc_type", "brain_document"))
    : 0;
  console.log(`ai_embeddings (brain docs): ${formatCount(embeddings)} ${embeddings > 0 ? "PASS" : "FAIL"}`);

  if (hasFlag("--smoke")) {
    console.log("");
    console.log("Smoke test: ai-strategy-generate citations");
    const smoke = await strategyCitationsSmokeTest();
    console.log(`ai-strategy-generate citations: ${formatCount(smoke.citationsCount)} PASS`);
  } else {
    console.log("");
    console.log("Smoke test skipped (pass --smoke to run ai-strategy-generate).");
  }

  const ok = brainDocs >= 3 && aiDocs >= 3 && chunks > 0 && embeddings > 0;
  console.log("");
  console.log(ok ? "OVERALL: PASS" : "OVERALL: FAIL");
  process.exit(ok ? 0 : 2);
};

run().catch((error) => {
  console.error("OVERALL: FAIL");
  console.error(error?.message ?? error);
  process.exit(1);
});

