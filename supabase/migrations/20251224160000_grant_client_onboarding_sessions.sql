-- Grant permissions for client_onboarding_sessions table
-- Fix for: permission denied for table client_onboarding_sessions
-- RLS policies are in place, but table-level grants were missing

grant select on public.client_onboarding_sessions to authenticated;
grant insert on public.client_onboarding_sessions to authenticated;
grant update on public.client_onboarding_sessions to authenticated;
grant delete on public.client_onboarding_sessions to authenticated;
