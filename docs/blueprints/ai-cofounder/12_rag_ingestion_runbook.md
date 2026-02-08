SMMAHUB AI Cofounder - RAG Ingestion Runbook

Purpose:
Provide a repeatable process to ingest the canonical RAG handbook and validate retrieval.

Prerequisites:
- Access to Supabase project with service_role.
- Embedding API keys configured (OpenAI or Gemini).
- brain_documents tables and RLS already deployed.

Step 1 - Prepare the handbook
- Source file: docs/blueprints/ai-cofounder/03_rag_handbook.md
- Ensure ASCII-only and final approved content.
- Tag metadata: module=product_docs, source=manual.

Step 2 - Ingest document
- Use the existing brain document ingestion flow:
  - Create brain_document record.
  - Create brain_document_versions.
  - Chunk into ai_document_chunks.
  - Generate embeddings and store in ai_embeddings + shadow tables.

Step 3 - Verify embeddings
- Confirm ai_document_chunks.embedding_status = "ok".
- Confirm ai_embeddings rows created.
- Confirm ai_embeddings_shadow_gemini rows created.

Step 4 - Verify retrieval
- Call ai-retrieve-context with a test query:
  - "Why do we need pricing?"
  - "What does client type split mean?"
  - "How is timezone used?"
- Ensure top K chunks reference the handbook.

Step 5 - Validate tenant isolation
- Ensure match_ai_embeddings_scoped is executed only with service_role.
- Confirm no cross-tenant results.

Step 6 - Publish
- Mark handbook as approved in metadata.
- Store the document_id in config for onboarding clarifier.

Rollback:
- Delete handbook brain_document and embeddings.
- Re-ingest previous approved version.

Notes:
- Re-run ingestion whenever handbook changes.
- Keep a changelog of handbook versions.
