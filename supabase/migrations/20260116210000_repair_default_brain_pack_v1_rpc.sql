begin;

-- Repair Default Brain Pack v1 for an agency (seed missing defaults only), atomically and idempotently.
--
-- Modules: bootstrap, rep_policy, quality_bar
-- Atomicity: function runs in a single transaction, with an advisory lock per agency to prevent races.
-- Idempotency rule: insert ONLY modules that do not already exist (status <> 'archived') for this agency.
create or replace function public.repair_default_brain_pack_v1(
  p_agency_id uuid,
  p_user_id uuid,
  p_docs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_existing_modules text[];
  v_missing_modules text[];
  v_inserted_ids uuid[];
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

  -- Prevent races on concurrent repair attempts per agency
  perform pg_advisory_xact_lock(hashtextextended(p_agency_id::text, 0));

  -- Resolve user identity: prefer auth.uid() when present, otherwise allow explicit p_user_id.
  v_user_id := auth.uid();
  if v_user_id is null then
    v_user_id := p_user_id;
  elsif v_user_id <> p_user_id then
    raise exception 'p_user_id must match auth.uid()';
  end if;

  -- Permission check: only admin/owner can repair
  if not exists (
    select 1
    from public.agency_members am
    where am.agency_id = p_agency_id
      and am.user_id = v_user_id
      and am.role in ('owner', 'admin')
  ) then
    raise exception 'Permission denied: user is not an admin of this agency';
  end if;

  select coalesce(array_agg(distinct bd.module::text), '{}'::text[])
    into v_existing_modules
  from public.brain_documents bd
  where bd.agency_id = p_agency_id
    and bd.status <> 'archived'
    and bd.module in ('bootstrap'::public.brain_module, 'rep_policy'::public.brain_module, 'quality_bar'::public.brain_module);

  select array_agg(m.module)
    into v_missing_modules
  from (
    select unnest(array['bootstrap','rep_policy','quality_bar']::text[]) as module
    except
    select unnest(v_existing_modules)
  ) m;

  if v_missing_modules is null or array_length(v_missing_modules, 1) is null then
    return jsonb_build_object(
      'inserted_count', 0,
      'inserted_document_ids', '[]'::jsonb,
      'skipped_existing_modules', coalesce(to_jsonb(v_existing_modules), '[]'::jsonb)
    );
  end if;

  with input_docs as (
    select
      (doc->>'module')::public.brain_module as module,
      nullif(btrim(doc->>'title'), '') as title,
      coalesce(doc->'content_json', '{}'::jsonb) as content_json,
      coalesce(nullif(doc->>'source', ''), 'onboarding')::public.brain_document_source as source
    from jsonb_array_elements(p_docs) doc
  ),
  filtered as (
    select
      d.module,
      coalesce(d.title, initcap(replace(d.module::text, '_', ' '))) as title,
      d.content_json,
      d.source
    from input_docs d
    where d.module::text = any(v_missing_modules)
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
      f.module,
      f.title,
      f.content_json,
      'draft'::public.brain_document_status,
      1,
      f.source,
      v_user_id
    from filtered f
    returning id, content_json
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
      'Repaired Default Brain Pack v1 (seed missing modules)',
      v_user_id
    from inserted i
    returning document_id
  )
  select coalesce(array_agg(i.id), '{}'::uuid[])
    into v_inserted_ids
  from inserted i;

  return jsonb_build_object(
    'inserted_count', coalesce(array_length(v_inserted_ids, 1), 0),
    'inserted_document_ids', coalesce(to_jsonb(v_inserted_ids), '[]'::jsonb),
    'skipped_existing_modules', coalesce(to_jsonb(v_existing_modules), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.repair_default_brain_pack_v1(uuid, uuid, jsonb) from public;
grant execute on function public.repair_default_brain_pack_v1(uuid, uuid, jsonb) to authenticated;
grant execute on function public.repair_default_brain_pack_v1(uuid, uuid, jsonb) to service_role;

commit;

