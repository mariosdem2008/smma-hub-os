alter table public.agency_agent_unlocks_v2
add column if not exists activation_mode text null,
add column if not exists activation_policy_json jsonb not null default '{}'::jsonb;

alter table public.agency_agent_unlocks_v2
drop constraint if exists agency_agent_unlocks_v2_activation_mode_check;

alter table public.agency_agent_unlocks_v2
add constraint agency_agent_unlocks_v2_activation_mode_check check (
  activation_mode is null
  or activation_mode in ('preview_only', 'internal_assist_only', 'operational')
);
