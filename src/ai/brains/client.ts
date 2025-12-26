type MinimalSupabase = {
  from: (table: string) => any;
};

export async function getClientBrainContext(supabase: MinimalSupabase, clientId: string) {
  const res = await supabase
    .from("client_brains")
    .select("brain_json, updated_at, version")
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res?.error) {
    return { data: null as Record<string, unknown> | null, error: res.error.message ?? "Failed to load client brain" };
  }
  return { data: (res?.data?.brain_json as Record<string, unknown>) ?? null, error: null as string | null };
}
