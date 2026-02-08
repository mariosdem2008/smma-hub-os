type MaybeSingleResult<T> = { data: T | null; error?: { message?: string } | null };

type MinimalSupabase = {
  from: (table: string) => any;
};

export type AgencyContextSnapshot = {
  agency: {
    id: string;
    name: string | null;
    website?: string | null;
    niche?: string | null;
  } | null;
  admin: {
    id: string;
    full_name?: string | null;
    first_name?: string | null;
    role?: string | null;
  } | null;
  persona: {
    assistant_name: string;
    tone_traits: string[];
    expertise_traits: string[];
    source: string;
  } | null;
  prompt_cache: {
    status: string | null;
    completed_at: string | null;
    prompt_cache_version: string | null;
    prompt_cache_invalidated_at: string | null;
  } | null;
  onboarding_known_facts: Record<string, unknown> | null;
  agency_brain_existing: Record<string, unknown> | null;
};

function deriveFirstName(fullName?: string | null) {
  if (!fullName) return null;
  const parts = fullName.trim().split(/\s+/g);
  return parts.length > 0 ? parts[0] : null;
}

async function fetchAgency(supabase: MinimalSupabase, agencyId: string) {
  const res: MaybeSingleResult<{ id: string; name: string; website?: string | null; niche?: string | null } | null> = await supabase
    .from("agencies")
    .select("id, name, website, niche")
    .eq("id", agencyId)
    .maybeSingle();
  if (res?.error) throw new Error(res.error.message ?? "Failed to load agency");
  return res?.data ?? null;
}

async function fetchAdminProfile(supabase: MinimalSupabase, userId: string) {
  const res: MaybeSingleResult<{ id: string; full_name?: string | null } | null> = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (res?.error) throw new Error(res.error.message ?? "Failed to load admin profile");
  return res?.data ?? null;
}

async function fetchOnboardingSession(supabase: MinimalSupabase, agencyId: string) {
  const res: MaybeSingleResult<{ answers_json: Record<string, unknown> | null } | null> = await supabase
    .from("agency_onboarding_sessions")
    .select("answers_json")
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (res?.error) throw new Error(res.error.message ?? "Failed to load onboarding session");
  return res?.data?.answers_json ?? null;
}

async function fetchOnboardingStatus(supabase: MinimalSupabase, agencyId: string) {
  const res: MaybeSingleResult<
    | {
        status: string;
        completed_at: string | null;
        metadata: Record<string, unknown> | null;
      }
    | null
  > = await supabase
    .from("ai_onboarding_status")
    .select("status, completed_at, metadata")
    .eq("agency_id", agencyId)
    .eq("scope", "agency")
    .is("client_id", null)
    .maybeSingle();
  if (res?.error) throw new Error(res.error.message ?? "Failed to load onboarding status");
  return res?.data ?? null;
}

async function fetchPersona(supabase: MinimalSupabase, agencyId: string) {
  const res: MaybeSingleResult<
    | {
        assistant_name: string | null;
        tone_traits: unknown;
        expertise_traits: unknown;
        source: string | null;
      }
    | null
  > = await supabase
    .from("ai_persona_vectors")
    .select("assistant_name, tone_traits, expertise_traits, source")
    .eq("agency_id", agencyId)
    .eq("scope", "agency")
    .is("client_id", null)
    .maybeSingle();
  if (res?.error) throw new Error(res.error.message ?? "Failed to load persona");
  return res?.data ?? null;
}

async function fetchAgencyBrainInternal(supabase: MinimalSupabase, agencyId: string) {
  const res: MaybeSingleResult<{ id: string; brain_json: Record<string, unknown> | null } | null> = await supabase
    .from("agency_brains")
    .select("id, brain_json")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res?.error) throw new Error(res.error.message ?? "Failed to load agency brain");
  return { id: res?.data?.id ?? null, brain: (res?.data?.brain_json ?? {}) as Record<string, unknown> };
}

async function upsertAgencyBrainInternal(
  supabase: MinimalSupabase,
  agencyId: string,
  brainId: string | null,
  brain: Record<string, unknown>,
) {
  if (brainId) {
    const res: MaybeSingleResult<{ id: string } | null> = await supabase
      .from("agency_brains")
      .update({ brain_json: brain })
      .eq("id", brainId)
      .select("id")
      .maybeSingle();
    if (res?.error) throw new Error(res.error.message ?? "Failed to update agency brain");
    return brainId;
  }

  const res: MaybeSingleResult<{ id: string } | null> = await supabase
    .from("agency_brains")
    .insert({
      agency_id: agencyId,
      version: 1,
      status: "draft",
      locked: false,
      brain_json: brain,
      json_diff: null,
      confidence: 0,
    })
    .select("id")
    .maybeSingle();
  if (res?.error) throw new Error(res.error.message ?? "Failed to create agency brain");
  return res?.data?.id ?? null;
}

async function buildAgencyContextSnapshotInternal(opts: {
  supabase: MinimalSupabase;
  agencyId: string;
  userId: string;
  agencyBrain?: Record<string, unknown> | null;
}) {
  const [agency, profile, onboarding, onboardingStatus, persona] = await Promise.all([
    fetchAgency(opts.supabase, opts.agencyId),
    fetchAdminProfile(opts.supabase, opts.userId),
    fetchOnboardingSession(opts.supabase, opts.agencyId),
    fetchOnboardingStatus(opts.supabase, opts.agencyId),
    fetchPersona(opts.supabase, opts.agencyId),
  ]);

  const onboardingMetadata = (onboardingStatus?.metadata ?? {}) as Record<string, unknown>;
  const promptCacheVersion =
    typeof onboardingMetadata.prompt_cache_version === "string" ? onboardingMetadata.prompt_cache_version : null;
  const promptCacheInvalidatedAt =
    typeof onboardingMetadata.prompt_cache_invalidated_at === "string"
      ? onboardingMetadata.prompt_cache_invalidated_at
      : null;

  const snapshot: AgencyContextSnapshot = {
    agency: agency
      ? {
          id: agency.id,
          name: agency.name ?? null,
          website: "website" in agency ? (agency.website ?? null) : null,
          niche: "niche" in agency ? (agency.niche ?? null) : null,
        }
      : null,
    admin: profile
      ? {
          id: profile.id,
          full_name: profile.full_name ?? null,
          first_name: deriveFirstName(profile.full_name),
          role: "admin",
        }
      : null,
    persona: {
      assistant_name: persona?.assistant_name?.trim() || "Alex",
      tone_traits: Array.isArray(persona?.tone_traits) ? (persona?.tone_traits as string[]) : [],
      expertise_traits: Array.isArray(persona?.expertise_traits) ? (persona?.expertise_traits as string[]) : [],
      source: persona?.source ?? "default",
    },
    prompt_cache: {
      status: onboardingStatus?.status ?? null,
      completed_at: onboardingStatus?.completed_at ?? null,
      prompt_cache_version: promptCacheVersion,
      prompt_cache_invalidated_at: promptCacheInvalidatedAt,
    },
    onboarding_known_facts: onboarding ?? null,
    agency_brain_existing: opts.agencyBrain ?? null,
  };

  return snapshot;
}

function buildAiContextSummaryInternal(snapshot: AgencyContextSnapshot) {
  return {
    agency_name: snapshot.agency?.name ?? null,
    assistant_name: snapshot.persona?.assistant_name ?? "Alex",
    persona_tone_traits: snapshot.persona?.tone_traits ?? [],
    persona_expertise_traits: snapshot.persona?.expertise_traits ?? [],
    prompt_cache_version: snapshot.prompt_cache?.prompt_cache_version ?? null,
    admin_first_name: snapshot.admin?.first_name ?? null,
    services: (snapshot.agency_brain_existing as any)?.setup_profile_v1?.agency?.primary_services ?? null,
    niche: snapshot.agency?.niche ?? null,
    last_updated: new Date().toISOString(),
  };
}

export const fetchAgencyBrain = fetchAgencyBrainInternal;
export const upsertAgencyBrain = upsertAgencyBrainInternal;
export const buildAgencyContextSnapshot = buildAgencyContextSnapshotInternal;
export const buildAiContextSummary = buildAiContextSummaryInternal;
