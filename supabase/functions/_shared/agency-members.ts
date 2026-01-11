export type MinimalAgencyMembersSupabase = {
  from: (table: string) => any;
};

export async function resolveAgencyAdminUserId(
  supabase: MinimalAgencyMembersSupabase,
  agencyId: string,
): Promise<string | null> {
  const { data: adminRow } = await supabase
    .from("agency_members")
    .select("user_id")
    .eq("agency_id", agencyId)
    .in("role", ["owner", "admin"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (adminRow?.user_id) return adminRow.user_id as string;

  const { data: anyMember } = await supabase
    .from("agency_members")
    .select("user_id")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (anyMember?.user_id as string | undefined) ?? null;
}

