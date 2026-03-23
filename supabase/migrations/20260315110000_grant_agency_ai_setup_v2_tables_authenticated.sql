grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.agency_ai_setup_status_v2 to authenticated;
grant select, insert, update, delete on table public.agency_ai_readiness_scores_v2 to authenticated;
grant select, insert, update, delete on table public.agency_agent_unlocks_v2 to authenticated;
grant select, insert, update, delete on table public.agency_operating_module_reviews_v2 to authenticated;
grant select, insert, update, delete on table public.agency_ai_setup_simulations_v2 to authenticated;
grant select, insert, update, delete on table public.agency_ai_certifications_v2 to authenticated;
grant select, insert, update, delete on table public.agency_ai_certification_events_v2 to authenticated;

grant usage, select on all sequences in schema public to authenticated;
