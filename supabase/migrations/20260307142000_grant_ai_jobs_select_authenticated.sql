-- ai_jobs is read by authenticated agency users in /ai/admin.
-- RLS policy exists; grant SELECT so policy can actually be evaluated.

grant select on table public.ai_jobs to authenticated;
