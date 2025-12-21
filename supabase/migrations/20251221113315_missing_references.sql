begin;

-- 1) Make sure RLS is enabled (safe if already enabled)
alter table public.profiles enable row level security;

-- 2) RLS policies (id-based, user can read/update their own profile)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Optional: allow insert only for the user himself (not needed if trigger inserts)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

-- 3) Trigger function: create profile when auth user is created
create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, timezone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', null),
    'Asia/Nicosia'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

-- 4) Recreate trigger cleanly
drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_auth_user_profile();

-- 5) Backfill: create profiles for any existing auth.users missing it
insert into public.profiles (id, email, full_name, timezone)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data->>'full_name', null),
  'Asia/Nicosia'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

commit;