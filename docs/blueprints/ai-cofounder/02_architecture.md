SMMAHUB AI Cofounder - Architecture

ASCII system diagram:

User UI (Onboarding Chat)
  |
  v
Supabase Edge Function: ai-onboarding
  |-- deterministic question engine
  |-- validation rules
  |-- clarify trigger
  |
  v
RAG Retrieval (ai-retrieve-context)
  |-- match_ai_embeddings_scoped (service_role)
  v
RAG Context Pack (product docs + agency brain)
  |
  v
LLM (Vertex AI Gemini)
  |
  v
Response (clarification + follow-up) -> UI

Request flow (clarify case):
1) User answer detected as unclear.
2) ai-onboarding calls ONBOARDING_CLARIFY.
3) RAG retrieval pulls product docs.
4) LLM returns clarification + follow-up.
5) ai-onboarding returns same question, not advanced.

Data boundaries:
- All RAG retrieval uses scoped RPC and service_role.
- Tenant isolation enforced by RLS + scoped RPCs.
- No client-side access to embeddings or match_* functions.

Security:
- No cross-tenant leakage.
- Only service_role can run match_ai_embeddings_scoped.
- All AI calls logged to ai_runs and ai_otel_spans.
