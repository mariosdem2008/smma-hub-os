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

export type MissingFieldMeta = {
  label: string;
  reason: string;
  ctaLabel: string;
  href: string;
};

export const missingFieldMeta: Record<string, MissingFieldMeta> = {
  enabled_channels: {
    label: "Connect channels",
    reason: "Select at least one channel to build a channel-aware strategy.",
    ctaLabel: "Fix now",
    href: "onboarding:q16_enabled_channels",
  },
  cadence: {
    label: "Set posting cadence",
    reason: "Define weekly posting volume for each enabled channel.",
    ctaLabel: "Fix now",
    href: "onboarding:q18_cadence",
  },
  primary_goal: {
    label: "Set primary goal",
    reason: "Clarify the main outcome this strategy should drive.",
    ctaLabel: "Fix now",
    href: "onboarding:q17_primary_goal",
  },
  offer_details: {
    label: "Add offer details",
    reason: "Provide your core offer and CTA so messaging is aligned.",
    ctaLabel: "Fix now",
    href: "onboarding:q6_offer_details",
  },
  ideal_customer: {
    label: "Define ideal customer",
    reason: "Describe who this strategy is built for.",
    ctaLabel: "Fix now",
    href: "onboarding:q8_ideal_customer",
  },
  pain_points: {
    label: "Add pain points",
    reason: "List the key challenges your audience is trying to solve.",
    ctaLabel: "Fix now",
    href: "onboarding:q9_pain_points",
  },
  desired_outcome: {
    label: "Set desired outcome",
    reason: "Specify the outcome this strategy should deliver.",
    ctaLabel: "Fix now",
    href: "onboarding:q10_desired_outcome",
  },
  differentiators: {
    label: "Add differentiators",
    reason: "Capture what makes the offer distinct in the market.",
    ctaLabel: "Fix now",
    href: "onboarding:q13_differentiators",
  },
  proof_level: {
    label: "Set proof level",
    reason: "Choose the strength of proof behind your claims.",
    ctaLabel: "Fix now",
    href: "onboarding:q14_proof_level",
  },
  proof_points: {
    label: "Add proof points",
    reason: "Provide evidence to support your positioning claims.",
    ctaLabel: "Fix now",
    href: "onboarding:q15_proof_points",
  },
  competitors: {
    label: "Add competitors",
    reason: "List competitors to shape positioning and differentiation.",
    ctaLabel: "Fix now",
    href: "onboarding:q12_competitors",
  },
  sales_cycle: {
    label: "Define sales cycle",
    reason: "Clarify how long it takes prospects to convert.",
    ctaLabel: "Fix now",
    href: "onboarding:q11_sales_cycle",
  },
  business_name: {
    label: "Add business name",
    reason: "We need the business name to personalize the strategy.",
    ctaLabel: "Fix now",
    href: "onboarding:q1_business_name",
  },
  website: {
    label: "Add website or socials",
    reason: "Provide at least one URL so the strategy has context.",
    ctaLabel: "Fix now",
    href: "onboarding:q2_website_socials",
  },
  onboarding_not_started: {
    label: "Start onboarding",
    reason: "No onboarding details are available for this client yet.",
    ctaLabel: "Start now",
    href: "onboarding:start",
  },
};

const missingFieldAliases: Record<string, string> = {
  enabled_channels: "enabled_channels",
  cadence: "cadence",
  primary_goal: "primary_goal",
  ideal_customer: "ideal_customer",
  differentiators: "differentiators",
  proof_points: "proof_points",
  proof_level: "proof_level",
  offer_name: "offer_details",
  main_cta: "offer_details",
  offer_details: "offer_details",
  business_name: "business_name",
  website: "website",
  website_socials: "website",
  social_links: "website",
  pain_points: "pain_points",
  desired_outcome: "desired_outcome",
  competitors: "competitors",
  sales_cycle: "sales_cycle",
  brand_basics_name: "business_name",
  brand_basics: "business_name",
  offer_details_products_services: "offer_details",
  audience_problems: "pain_points",
  constraints_banned_claims_or_taboo_topics: "proof_level",
  pillars: "offer_details",
  goals: "primary_goal",
  onboarding_not_started: "onboarding_not_started",
};

export function normalizeMissingFieldKey(rawKey: string): string {
  const trimmed = rawKey?.trim().toLowerCase();
  if (!trimmed) return trimmed;
  const withoutPrefix = trimmed.replace(/^q\d+_/, "");
  const normalized = withoutPrefix.replace(/\./g, "_");
  return missingFieldAliases[normalized] ?? normalized;
}

export function getMissingFieldMeta(rawKey: string): MissingFieldMeta | undefined {
  const canonicalKey = normalizeMissingFieldKey(rawKey);
  return missingFieldMeta[canonicalKey];
}

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

export async function getClientBrainStatus(clientId: string): Promise<{
  usable: boolean;
  missingFields?: string[];
  missingFieldsCount?: number;
  status?: string | null;
  locked?: boolean | null;
  version?: number | null;
  updatedAt?: string | null;
}> {
  const { data, error } = await db.rpc("get_client_brain_status", { p_client_id: clientId });

  if (error) throw toDbError(error, "Failed to load client brain status");

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      usable: false,
      missingFields: ["onboarding_not_started"],
      missingFieldsCount: 1,
    };
  }

  const missingFields = Array.isArray(row.missing_fields)
    ? row.missing_fields.map(String)
    : [];
  const missingFieldsCount =
    typeof row.missing_fields_count === "number" ? row.missing_fields_count : missingFields.length;

  return {
    usable: row.usable === true,
    missingFields,
    missingFieldsCount,
    status: row.status ?? null,
    locked: row.locked ?? null,
    version: row.version ?? null,
    updatedAt: row.updated_at ?? null,
  };
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

  const nowIso = new Date().toISOString();
  return safeList(
    db
      .from("agency_invites")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("accepted", false)
      .eq("declined", false)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false }),
    "Failed to load invites"
  );
}

export async function createAgencyInvite(email: string, role: string) {
  const user = await requireUser();
  const { agencyId } = await getMyAgencyContext();

  const normalizedEmail = email.toLowerCase();
  const nowIso = new Date().toISOString();
  const newToken = crypto.randomUUID();
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // If there is already an active pending invite, return it (supports "resend" without churn).
  const existing = await safeMaybeSingle(
    db
      .from("agency_invites")
      .select("id, token, expires_at, email, role, agency_id, invited_by")
      .eq("agency_id", agencyId)
      .eq("email", normalizedEmail)
      .eq("accepted", false)
      .eq("declined", false)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .maybeSingle(),
    "Failed to check existing invite"
  );

  if (existing?.id) {
    // If a legacy/buggy row exists without a token, refresh it so email sending/link sharing works.
    if (!existing.token) {
      const { data, error } = await db
        .from("agency_invites")
        .update({
          role,
          invited_by: user.id,
          token: newToken,
          expires_at: existing.expires_at ?? newExpiry,
        })
        .eq("id", existing.id)
        .select("id, token, expires_at, email, role, agency_id, invited_by")
        .single();

      if (error) throw toDbError(error, "Failed to refresh invite token");
      return data;
    }
    return existing;
  }

  // If there is a stale/expired pending invite, refresh it in-place (new token/expiry).
  const stale = await safeMaybeSingle(
    db
      .from("agency_invites")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("email", normalizedEmail)
      .eq("accepted", false)
      .eq("declined", false)
      .maybeSingle(),
    "Failed to check existing invite"
  );

  if (stale?.id) {
    const { data, error } = await db
      .from("agency_invites")
      .update({
        role,
        invited_by: user.id,
        token: newToken,
        expires_at: newExpiry,
      })
      .eq("id", stale.id)
      .select("id, token, expires_at, email, role, agency_id, invited_by")
      .single();

    if (error) throw toDbError(error, "Failed to refresh invite");
    return data;
  }

  const { data, error } = await db
    .from("agency_invites")
    .insert({
      agency_id: agencyId,
      email: normalizedEmail,
      role,
      invited_by: user.id,
      token: newToken,
      expires_at: newExpiry,
    })
    .select("id, token, expires_at, email, role, agency_id, invited_by")
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
