-- Harden match_ai_embeddings execution to service role only

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from public;

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from anon;

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from authenticated;

grant execute on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) to service_role;