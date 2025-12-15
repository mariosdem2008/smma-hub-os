-- Ensure uuid generator exists
create extension if not exists pgcrypto;

-- Ensure agencies.id auto-generates
alter table public.agencies
  alter column id set default gen_random_uuid();
