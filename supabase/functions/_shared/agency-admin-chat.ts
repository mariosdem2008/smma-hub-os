export type AgencyAdminChatRequestBody = {
  thread_id?: string;
  message?: string;
};

export type AgencyAdminChatResponseBody =
  | { error: string }
  | {
      thread_id: string;
      assistant_message: string;
      suggested_choices?: string[];
    };

export type AgencyAdminChatHandlerResult = {
  status: number;
  body: AgencyAdminChatResponseBody;
};

type MaybeSingleResult<T> = { data: T | null; error?: { message?: string } | null };
type InsertResult<T> = { data: T | null; error?: { message?: string } | null };

type MinimalSupabase = {
  from: (table: string) => any;
};

function inferTitleFromFirstMessage(message: string) {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New session";
  return trimmed.length > 64 ? `${trimmed.slice(0, 64)}…` : trimmed;
}

function buildAssistantResponse(message: string) {
  const base = message.trim();
  const assistant_message =
    `Revelation Chat (v1)\n\n` +
    `I’m here to help you run the agency.\n\n` +
    `You said:\n${base}\n\n` +
    `Reply with what you want next (e.g., "audit current clients", "review onboarding friction", "draft SOP").`;

  const suggested_choices = [
    "Audit client onboarding + gate issues",
    "Draft an agency SOP for content pipeline",
    "Generate a weekly priorities list",
  ];

  return { assistant_message, suggested_choices };
}

async function getAdminAgencyIdForUser(supabase: MinimalSupabase, userId: string) {
  const res: MaybeSingleResult<{ agency_id: string }> = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (res?.error) {
    return { agencyId: null as string | null, error: res.error.message ?? "Failed to load agency membership" };
  }
  return { agencyId: res?.data?.agency_id ?? null, error: null as string | null };
}

async function isAdminForAgency(supabase: MinimalSupabase, userId: string, agencyId: string) {
  const res: MaybeSingleResult<{ agency_id: string }> = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .eq("agency_id", agencyId)
    .limit(1)
    .maybeSingle();

  return !!res?.data?.agency_id;
}

export async function handleAgencyAdminChat(opts: {
  supabase: MinimalSupabase;
  userId: string;
  body: AgencyAdminChatRequestBody;
}): Promise<AgencyAdminChatHandlerResult> {
  const message = (opts.body?.message ?? "").trim();
  const threadId = (opts.body?.thread_id ?? "").trim() || null;

  if (!message) {
    return { status: 400, body: { error: "message is required" } };
  }

  let agencyId: string | null = null;

  if (threadId) {
    const threadRes: MaybeSingleResult<{ id: string; agency_id: string }> = await opts.supabase
      .from("agency_ai_chat_threads")
      .select("id, agency_id")
      .eq("id", threadId)
      .maybeSingle();

    if (threadRes?.error) {
      return { status: 500, body: { error: threadRes.error.message ?? "Failed to load thread" } };
    }
    if (!threadRes?.data?.agency_id) {
      return { status: 404, body: { error: "Thread not found" } };
    }
    agencyId = threadRes.data.agency_id;
  } else {
    const { agencyId: resolvedAgencyId, error } = await getAdminAgencyIdForUser(opts.supabase, opts.userId);
    if (error) return { status: 500, body: { error } };
    agencyId = resolvedAgencyId;
  }

  if (!agencyId) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const allowed = await isAdminForAgency(opts.supabase, opts.userId, agencyId);
  if (!allowed) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  let effectiveThreadId = threadId;

  if (!effectiveThreadId) {
    const title = inferTitleFromFirstMessage(message);
    const insertThread: InsertResult<{ id: string }> = await opts.supabase
      .from("agency_ai_chat_threads")
      .insert({ agency_id: agencyId, created_by: opts.userId, title })
      .select("id")
      .single();

    if (insertThread?.error) {
      return { status: 500, body: { error: insertThread.error.message ?? "Failed to create thread" } };
    }

    effectiveThreadId = insertThread?.data?.id ?? null;
    if (!effectiveThreadId) {
      return { status: 500, body: { error: "Failed to create thread" } };
    }
  }

  const insertUserMsg: InsertResult<{ id: string }> = await opts.supabase
    .from("agency_ai_chat_messages")
    .insert({ thread_id: effectiveThreadId, role: "user", content: message, meta_json: {} })
    .select("id")
    .single();

  if (insertUserMsg?.error) {
    return { status: 500, body: { error: insertUserMsg.error.message ?? "Failed to store user message" } };
  }

  const { assistant_message, suggested_choices } = buildAssistantResponse(message);

  const insertAssistantMsg: InsertResult<{ id: string }> = await opts.supabase
    .from("agency_ai_chat_messages")
    .insert({
      thread_id: effectiveThreadId,
      role: "assistant",
      content: assistant_message,
      meta_json: { suggested_choices },
    })
    .select("id")
    .single();

  if (insertAssistantMsg?.error) {
    return { status: 500, body: { error: insertAssistantMsg.error.message ?? "Failed to store assistant message" } };
  }

  return {
    status: 200,
    body: {
      thread_id: effectiveThreadId,
      assistant_message,
      suggested_choices,
    },
  };
}

