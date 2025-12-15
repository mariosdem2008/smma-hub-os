-- EMERGENCY ROLLBACK: restore app responsiveness

-- 1) Drop the specific policies we introduced (safe)
drop policy if exists "social_post_metrics_select_client_members_v2" on public.social_post_metrics;
drop policy if exists "tasks_select_scope_v2" on public.tasks;

-- 2) Disable RLS on the 2 tables that are freezing the dashboard
alter table public.social_post_metrics disable row level security;
alter table public.tasks disable row level security;

-- IMPORTANT: do NOT drop public.is_member_of_client(uuid)
-- because other existing policies depend on it.
