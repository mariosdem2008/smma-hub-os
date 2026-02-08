type MinimalSupabase = {
  from: (table: string) => any;
};

export type PersonaPromptContext = {
  assistant_name: string;
  tone_traits: string[];
  expertise_traits: string[];
  cache_version: string;
  reloaded: boolean;
  source: "default" | "onboarding";
};

type CacheEntry = {
  version: string;
  context: Omit<PersonaPromptContext, "reloaded">;
};

const personaPromptCache = new Map<string, CacheEntry>();

function buildCacheKey(scope: "agency" | "client", agencyId: string, clientId: string | null) {
  return `${scope}:${agencyId}:${clientId ?? "none"}`;
}

function normalizeTraits(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 12);
}

async function loadOnboardingStatusVersion(opts: {
  supabase: MinimalSupabase;
  agencyId: string;
  clientId: string | null;
  scope: "agency" | "client";
}) {
  let query = opts.supabase
    .from("ai_onboarding_status")
    .select("status, completed_at, updated_at, metadata")
    .eq("agency_id", opts.agencyId)
    .eq("scope", opts.scope);

  if (opts.clientId) {
    query = query.eq("client_id", opts.clientId);
  } else {
    query = query.is("client_id", null);
  }

  const { data } = await query.maybeSingle();
  const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
  const metadataVersion =
    typeof metadata.prompt_cache_version === "string" && metadata.prompt_cache_version.trim().length > 0
      ? metadata.prompt_cache_version.trim()
      : null;

  const derivedVersion =
    metadataVersion ??
    `status:${String(data?.status ?? "not_started")}|completed:${String(data?.completed_at ?? "null")}|updated:${String(
      data?.updated_at ?? "null",
    )}`;

  return {
    status: String(data?.status ?? "not_started"),
    version: derivedVersion,
  };
}

async function loadPersonaRow(opts: {
  supabase: MinimalSupabase;
  agencyId: string;
  clientId: string | null;
  scope: "agency" | "client";
}) {
  let query = opts.supabase
    .from("ai_persona_vectors")
    .select("assistant_name, tone_traits, expertise_traits, source")
    .eq("agency_id", opts.agencyId)
    .eq("scope", opts.scope);

  if (opts.clientId) {
    query = query.eq("client_id", opts.clientId);
  } else {
    query = query.is("client_id", null);
  }

  const { data } = await query.maybeSingle();
  return data as
    | {
        assistant_name: string | null;
        tone_traits: unknown;
        expertise_traits: unknown;
        source: string | null;
      }
    | null;
}

export async function resolvePersonaPromptContext(opts: {
  supabase: MinimalSupabase;
  agencyId: string;
  clientId: string | null;
  scope: "agency" | "client";
  fallbackToAgencyScope?: boolean;
}) {
  const cacheKey = buildCacheKey(opts.scope, opts.agencyId, opts.clientId);
  const onboarding = await loadOnboardingStatusVersion({
    supabase: opts.supabase,
    agencyId: opts.agencyId,
    clientId: opts.clientId,
    scope: opts.scope,
  });

  const cached = personaPromptCache.get(cacheKey);
  if (cached && cached.version === onboarding.version) {
    return {
      ...cached.context,
      reloaded: false,
    } satisfies PersonaPromptContext;
  }

  let persona = await loadPersonaRow({
    supabase: opts.supabase,
    agencyId: opts.agencyId,
    clientId: opts.clientId,
    scope: opts.scope,
  });

  if (!persona && opts.fallbackToAgencyScope && opts.scope === "client") {
    persona = await loadPersonaRow({
      supabase: opts.supabase,
      agencyId: opts.agencyId,
      clientId: null,
      scope: "agency",
    });
  }

  const assistantName = persona?.assistant_name?.trim() || "Alex";
  const toneTraits = normalizeTraits(persona?.tone_traits);
  const expertiseTraits = normalizeTraits(persona?.expertise_traits);
  const source = onboarding.status === "complete" && persona ? "onboarding" : "default";

  const context = {
    assistant_name: assistantName,
    tone_traits: toneTraits,
    expertise_traits: expertiseTraits,
    cache_version: onboarding.version,
    source,
  } as const;

  personaPromptCache.set(cacheKey, {
    version: onboarding.version,
    context,
  });

  return {
    ...context,
    reloaded: true,
  } satisfies PersonaPromptContext;
}

export function clearPersonaPromptContextCache() {
  personaPromptCache.clear();
}
