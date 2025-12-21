// src/data/index.ts
// Data layer functions used by pages
import type { Json } from "@/integrations/supabase/types";
import {
  db,
  toDbError,
  safeSingle,
  safeMaybeSingle,
  safeList,
  requireUser,
  getMyAgencyContext,
  type DbError,
} from "./supabase";

// Re-export core helpers
export {
  db,
  toDbError,
  safeSingle,
  safeMaybeSingle,
  safeList,
  requireUser,
  getMyAgencyContext,
  type DbError,
} from "./supabase";

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
    error,
  } = await db.auth.getSession();

  if (error) throw toDbError(error, "Not authenticated");
  const token = session?.access_token;
  if (!token) throw { message: "Not authenticated" } satisfies DbError;

  return token;
}

// ============== Agency ==============

export async function getMyAgency() {
  const { agencyId } = await getMyAgencyContext();
  return safeSingle(
    db.from("agencies").select("*").eq("id", agencyId).single(),
    "Failed to load agency"
  );
}

export async function ensureAgencyExists(agencyName?: string): Promise<string> {
  const user = await requireUser();

  // Check if user already owns an agency
  const existing = await safeMaybeSingle(
    db.from("agencies").select("id").eq("user_id", user.id).maybeSingle(),
    "Failed to check existing agency"
  );

  if (existing?.id) return existing.id;

  // Create new agency
  const name = agencyName || user.email?.split("@")[0] || "My Agency";
  const newId = crypto.randomUUID();

  const { error } = await db.from("agencies").insert({
    id: newId,
    user_id: user.id,
    name,
  });

  if (error) throw toDbError(error, "Failed to create agency");

  // Add user as owner in agency_members
  await db.from("agency_members").insert({
    agency_id: newId,
    user_id: user.id,
    role: "owner",
    accepted_at: new Date().toISOString(),
  });

  return newId;
}

// ============== Clients ==============

export async function listClientsForMyAgency() {
  const { agencyId } = await getMyAgencyContext();
  return safeList(
    db
      .from("clients")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false }),
    "Failed to load clients"
  );
}

export async function createClientForMyAgency(data: {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  niche?: string;
  notes?: string;
}) {
  const { agencyId } = await getMyAgencyContext();
  const newId = crypto.randomUUID();

  const { error } = await db.from("clients").insert({
    id: newId,
    agency_id: agencyId,
    name: data.name,
    company: data.company ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    website: data.website ?? null,
    niche: data.niche ?? null,
    notes: data.notes ?? null,
  });

  if (error) throw toDbError(error, "Failed to create client");

  return safeSingle(
    db.from("clients").select("*").eq("id", newId).single(),
    "Failed to fetch created client"
  );
}

export async function updateClient(
  clientId: string,
  data: Partial<{
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    niche: string | null;
    notes: string | null;
    logo_url: string | null;
    brand_colors: Json | null;
    primary_font: string | null;
    secondary_font: string | null;
    tone_of_voice: string | null;
    portal_enabled: boolean;
    portal_slug: string | null;
    status: string | null;
  }>
) {
  const { error } = await db
    .from("clients")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", clientId);

  if (error) throw toDbError(error, "Failed to update client");
}

export async function deleteClientCascade(clientId: string) {
  const { error } = await db.rpc("delete_client_cascade", { p_client_id: clientId });
  if (error) throw toDbError(error, "Failed to delete client");
}

export async function getClientById(clientId: string) {
  return safeSingle(
    db.from("clients").select("*").eq("id", clientId).single(),
    "Client not found"
  );
}

export async function getClientBrandingPrimaryColor(clientId: string): Promise<string | null> {
  const branding = await safeMaybeSingle(
    db.from("client_branding").select("primary_color").eq("client_id", clientId).maybeSingle(),
    "Failed to load branding"
  );
  return branding?.primary_color ?? null;
}

export async function getClientAssetCount(clientId: string): Promise<number> {
  const { count, error } = await db
    .from("assets")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId);

  if (error) throw toDbError(error, "Failed to count assets");
  return count ?? 0;
}

export async function getClientPublishedVideoCount(clientId: string): Promise<number> {
  const { count, error } = await db
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "published");

  if (error) throw toDbError(error, "Failed to count published videos");
  return count ?? 0;
}

// ============== Team Members ==============

export async function listAgencyMembersWithProfiles() {
  const { agencyId } = await getMyAgencyContext();

  const members = await safeList(
    db
      .from("agency_members")
      .select("id, user_id, role, accepted_at, created_at")
      .eq("agency_id", agencyId),
    "Failed to load team members"
  );

  // Fetch profiles for each member
  const userIds = members.map((m) => m.user_id);
  const profiles = await safeList(
    db.from("profiles").select("id, email, full_name").in("id", userIds),
    "Failed to load profiles"
  );

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return members.map((m) => ({
    ...m,
    profile: profileMap.get(m.user_id) ?? null,
  }));
}

export async function listPendingAgencyInvites() {
  const { agencyId } = await getMyAgencyContext();

  return safeList(
    db
      .from("agency_invites")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("accepted", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    "Failed to load invites"
  );
}

export async function createAgencyInvite(email: string, role: string) {
  const { agencyId } = await getMyAgencyContext();

  const { data, error } = await db
    .from("agency_invites")
    .insert({
      agency_id: agencyId,
      email: email.toLowerCase(),
      role,
    })
    .select("id, token, expires_at, email, role, agency_id")
    .single();

  if (error) throw toDbError(error, "Failed to create invite");
  return data;
}

export async function cancelAgencyInvite(inviteId: string) {
  const { error } = await db.from("agency_invites").delete().eq("id", inviteId);
  if (error) throw toDbError(error, "Failed to cancel invite");
}

export async function getOwnerSubscriptionPlan(userId: string): Promise<string> {
  const { data } = await db
    .from("subscriptions")
    .select("plan_type")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.plan_type || "free";
}

export async function getProfileByEmail(email: string) {
  return safeMaybeSingle(
    db.from("profiles").select("id, email, full_name").eq("email", email).maybeSingle(),
    "Failed to check profile"
  );
}

export async function isUserAgencyMember(agencyId: string, userId: string): Promise<boolean> {
  const { data } = await db
    .from("agency_members")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function hasPendingInvite(agencyId: string, email: string): Promise<boolean> {
  const { data } = await db
    .from("agency_invites")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("email", email.toLowerCase())
    .eq("accepted", false)
    .maybeSingle();
  return !!data;
}

export async function getUserFullName(userId: string): Promise<string | null> {
  const { data } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name ?? null;
}

export async function updateAgencyMemberRole(memberId: string, newRole: string) {
  const { error } = await db
    .from("agency_members")
    .update({ role: newRole })
    .eq("id", memberId);
  if (error) throw toDbError(error, "Failed to update member role");
}

export async function removeAgencyMember(memberId: string) {
  const { error } = await db
    .from("agency_members")
    .delete()
    .eq("id", memberId);
  if (error) throw toDbError(error, "Failed to remove member");
}

export async function getAgencyMemberIdsByUserIds(agencyId: string, userIds: string[]): Promise<string[]> {
  const { data, error } = await db
    .from("agency_members")
    .select("id")
    .eq("agency_id", agencyId)
    .in("user_id", userIds);
  if (error) throw toDbError(error, "Failed to get agency member IDs");
  return (data || []).map((m) => m.id);
}

// ============== Email Functions (via Edge Functions) ==============

export async function sendTeamInviteEmail(params: { inviteToken: string; resend?: boolean }) {
  const accessToken = await getAccessToken();
  const { data, error } = await db.functions.invoke("send-team-invite", {
    body: params,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) throw toDbError(error, "Failed to send team invite email");
  return data;
}

export async function sendPortalInviteEmail(params: {
  email: string;
  clientName: string;
  agencyName: string;
  agencyId: string;
  clientId: string;
  portalBaseUrl: string;
  portalUrl?: string;
  fullName?: string;
  role?: "client" | "approver" | "viewer";
  inviteToken?: string;
}) {
  const accessToken = await getAccessToken();
  const { data, error } = await db.functions.invoke("send-portal-invite", {
    body: params,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) throw toDbError(error, "Failed to send portal invite email");
  return data;
}
