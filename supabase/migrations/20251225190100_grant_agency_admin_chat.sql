grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.agency_ai_chat_threads to authenticated;
grant select, insert, update, delete on table public.agency_ai_chat_messages to authenticated;

grant usage, select on all sequences in schema public to authenticated;

