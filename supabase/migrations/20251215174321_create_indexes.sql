create index if not exists idx_agency_members_agency_user on public.agency_members (agency_id, user_id);
create index if not exists idx_clients_id_agency on public.clients (id, agency_id);

create index if not exists idx_assets_client_id on public.assets (client_id);

create index if not exists idx_client_branding_client_id on public.client_branding (client_id);

create index if not exists idx_tasks_client_id on public.tasks (client_id);

create index if not exists idx_social_post_metrics_client_date on public.social_post_metrics (client_id, date);
