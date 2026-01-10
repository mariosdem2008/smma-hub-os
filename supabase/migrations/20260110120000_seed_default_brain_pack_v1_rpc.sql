begin;

-- Seed Default Brain Pack v1 (draft) for an agency, atomically and idempotently.
--
-- Idempotency rule: seed ONLY when the agency has 0 brain_documents total.
-- Atomicity: function runs in a single transaction, with an advisory lock per agency to prevent races.
create or replace function public.seed_default_brain_pack_v1(
  p_agency_id uuid,
  p_user_id uuid,
  p_docs jsonb
)
returns table (document_id uuid, module text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_agency_id is null then
    raise exception 'p_agency_id is required';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_docs is null or jsonb_typeof(p_docs) <> 'array' then
    raise exception 'p_docs must be a JSON array';
  end if;

  if jsonb_array_length(p_docs) <> 3 then
    raise exception 'p_docs must contain exactly 3 docs';
  end if;

  -- Prevent races on concurrent seed attempts per agency
  perform pg_advisory_xact_lock(hashtextextended(p_agency_id::text, 0));

  -- Resolve user identity: prefer auth.uid() when present, otherwise allow explicit p_user_id.
  v_user_id := auth.uid();
  if v_user_id is null then
    v_user_id := p_user_id;
  elsif v_user_id <> p_user_id then
    raise exception 'p_user_id must match auth.uid()';
  end if;

  -- Permission check: only admin/owner can seed
  if not exists (
    select 1
    from public.agency_members am
    where am.agency_id = p_agency_id
      and am.user_id = v_user_id
      and am.role in ('owner', 'admin')
  ) then
    raise exception 'Permission denied: user is not an admin of this agency';
  end if;

  -- Idempotent no-op if any brain_documents exist for this agency
  if exists (
    select 1
    from public.brain_documents
    where agency_id = p_agency_id
    limit 1
  ) then
    return;
  end if;

  return query
  with input_docs as (
    select
      (doc->>'module')::public.brain_module as module,
      nullif(btrim(doc->>'title'), '') as title,
      coalesce(doc->'content_json', '{}'::jsonb) as content_json,
      coalesce(nullif(doc->>'source', ''), 'onboarding')::public.brain_document_source as source
    from jsonb_array_elements(p_docs) doc
  ),
  validated as (
    select
      module,
      coalesce(title, initcap(replace(module::text, '_', ' '))) as title,
      content_json,
      source
    from input_docs
  ),
  inserted as (
    insert into public.brain_documents (
      agency_id,
      module,
      title,
      content_json,
      status,
      version,
      source,
      created_by
    )
    select
      p_agency_id,
      v.module,
      v.title,
      v.content_json,
      'draft'::public.brain_document_status,
      1,
      v.source,
      v_user_id
    from validated v
    returning id, module, content_json
  ),
  versions as (
    insert into public.brain_document_versions (
      document_id,
      version,
      content_json,
      change_summary,
      created_by
    )
    select
      i.id,
      1,
      i.content_json,
      'Seeded Default Brain Pack v1',
      v_user_id
    from inserted i
    returning document_id
  )
  select i.id as document_id, i.module::text as module
  from inserted i
  order by i.module::text;
end;
$$;

revoke all on function public.seed_default_brain_pack_v1(uuid, uuid, jsonb) from public;
grant execute on function public.seed_default_brain_pack_v1(uuid, uuid, jsonb) to authenticated;

commit;

