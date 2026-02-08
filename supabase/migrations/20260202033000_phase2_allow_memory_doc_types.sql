-- Phase 2: allow memory-backed documents in ai_documents
--
-- Memory ingestion writes ai_documents rows with doc_type in ('client_memory','agency_memory').
-- This must be allowed by the ai_documents_doc_type_check constraint to avoid runtime 500s.

alter table public.ai_documents
  drop constraint if exists ai_documents_doc_type_check;

alter table public.ai_documents
  add constraint ai_documents_doc_type_check
  check (doc_type in (
    'agency_exemplar_strategy',
    'agency_sop',
    'client_guidelines',
    'client_notes',
    'approved_posts',
    'ai_artifact',
    'strategy_draft',
    'brain_document',
    'client_memory',
    'agency_memory'
  ));

