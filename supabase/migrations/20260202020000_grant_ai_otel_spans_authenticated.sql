-- Grants for ai_otel_spans (Phase 0 fix)
--
-- RLS policies alone do not grant table privileges; authenticated users need explicit GRANTs.
-- Tenant scoping remains enforced by RLS (0 cross-tenant leaks).

grant select, insert, update, delete on table public.ai_otel_spans to authenticated;

