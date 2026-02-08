SMMAHUB AI Cofounder - RAG Pipeline

Ingestion steps:
1) Store canonical handbook in brain_documents (module=product_docs, source=manual).
2) Chunk the document into ai_document_chunks.
3) Create embeddings (1536) and store in ai_embeddings.
4) Create shadow embeddings (768) and store in ai_embeddings_shadow_gemini + vector table.

Embeddings:
- Primary: 1536 dim (OpenAI text-embedding-3-small or equivalent).
- Shadow: 768 dim (Gemini embedding model).
- Both are stored for cross-provider retrieval and redundancy.

Retrieval config:
- Use match_ai_embeddings_scoped via service_role.
- Filter by agency_id, client_id, doc_type, and module where applicable.
- Top K: 3-6 chunks for onboarding clarifications.
- Min similarity threshold tuned to avoid empty results.

Caching:
- Cache RAG results for the current onboarding turn.
- Avoid repeated retrieval when the same question is asked again.
- Cache TTL: 2-5 minutes.

Security:
- No client-side RAG calls.
- Service_role only for match_* functions.
- RLS enforced for all embeddings tables.
