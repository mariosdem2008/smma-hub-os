-- Client asset counts (tenant-scoped view)

create or replace view public.client_asset_counts as
select
  c.id as client_id,
  coalesce(asset_counts.asset_count, 0) as asset_count,
  coalesce(published_counts.published_video_count, 0) as published_video_count
from public.clients c
left join (
  select client_id, count(*)::int as asset_count
  from public.assets
  group by client_id
) asset_counts on asset_counts.client_id = c.id
left join (
  select client_id, count(*)::int as published_video_count
  from public.projects
  where status = 'published'
  group by client_id
) published_counts on published_counts.client_id = c.id
where exists (
  select 1
  from public.agency_members am
  where am.agency_id = c.agency_id
    and am.user_id = auth.uid()
);

alter view public.client_asset_counts owner to postgres;

revoke all on table public.client_asset_counts from public;
revoke select on table public.client_asset_counts from anon;
grant select on table public.client_asset_counts to authenticated;