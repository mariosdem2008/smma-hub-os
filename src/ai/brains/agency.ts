type MinimalSupabase = {
  from: (table: string) => any;
};

export async function getAgencyBrainContext(supabase: MinimalSupabase, agencyId: string) {
  const res = await supabase
    .from("agency_brains")
    .select("brain_json, updated_at, version")
    .eq("agency_id", agencyId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res?.error) {
    return { data: null as Record<string, unknown> | null, error: res.error.message ?? "Failed to load agency brain" };
  }
  return { data: (res?.data?.brain_json as Record<string, unknown>) ?? null, error: null as string | null };
}
