-- Align ai_jobs read contract with AI admin route access.
-- Owners and admins can access /ai/admin, so both must be allowed to read ai_jobs.

drop policy if exists "ai_jobs_admin_select" on public.ai_jobs;

create policy "ai_jobs_admin_select"
on public.ai_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = ai_jobs.agency_id
      and am.user_id = auth.uid()
      and am.role in ('owner', 'admin')
  )
  or exists (
    select 1
    from public.agencies a
    where a.id = ai_jobs.agency_id
      and a.user_id = auth.uid()
  )
);
