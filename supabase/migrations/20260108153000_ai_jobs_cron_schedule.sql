-- Schedule AI job worker via pg_cron + pg_net
-- Requires app.settings.supabase_url and app.settings.cron_secret to be set server-side.
-- Store cron_secret in Vault or DB settings (not in code), then set app.settings.cron_secret accordingly.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.invoke_ai_job_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := current_setting('app.settings.supabase_url', true);
  v_secret text := current_setting('app.settings.cron_secret', true);
begin
  if v_url is null or v_secret is null then
    raise notice 'Skipping ai-job-worker cron: missing app.settings.supabase_url or app.settings.cron_secret';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/ai-job-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.invoke_ai_job_worker() from public;
grant execute on function public.invoke_ai_job_worker() to service_role;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'ai-job-worker'
  ) then
    perform cron.schedule('ai-job-worker', '*/2 * * * *', $job$select public.invoke_ai_job_worker();$job$);
  end if;
end $$;
