-- Team invite email logging and rate limiting support
begin;

create table if not exists public.agency_invite_email_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  invite_id uuid not null references public.agency_invites(id) on delete cascade,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  to_email text not null,
  sent_at timestamptz not null default now(),
  ip text null,
  user_agent text null
);

create index if not exists idx_agency_invite_email_logs_agency_sent_at
  on public.agency_invite_email_logs (agency_id, sent_at desc);

create index if not exists idx_agency_invite_email_logs_inviter_sent_at
  on public.agency_invite_email_logs (inviter_user_id, sent_at desc);

-- Prevent duplicate send unless explicitly allowed (resend flag)
create unique index if not exists agency_invite_email_logs_invite_unique
  on public.agency_invite_email_logs (invite_id);

commit;
