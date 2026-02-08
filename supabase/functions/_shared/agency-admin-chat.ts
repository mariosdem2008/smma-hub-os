import { handleAgencyAdminSetup } from "./agency-admin-setup.ts";
import { buildAgencyContextSnapshot, buildAiContextSummary, fetchAgencyBrain, upsertAgencyBrain } from "./ai-context.ts";
import {
  extractAssistantMessageFromText,
  parseGeneralChatOutputFromText,
  isAdminChatSchemaEnabled,
  isAdminChatStrategicEnabled,
  runAdminGeneralChatAi,
  runAdminGeneralChatAiStream,
} from "./agency-admin-general-ai.ts";

export type AgencyAdminChatRequestBody = {
  thread_id?: string;
  message?: string;
};

export type AgencyAdminChatResponseBody =
  | { error: string }
  | {
      thread_id: string;
      assistant_message: string;
      step_id?: string;
      progress_percent?: number;
      expects?: "choice" | "text" | "faq_pair";
      suggested_choices?: string[];
      suggestions?: Array<{ id: string; label: string; user_message: string }>;
      choices?: Array<{ id: string; label: string }>;
      done?: boolean;
    };

export type AgencyAdminChatHandlerResult = {
  status: number;
  body: AgencyAdminChatResponseBody;
};

export type AgencyAdminChatStreamChunk =
  | { event: "meta"; data: Record<string, unknown> }
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: Record<string, unknown> }
  | { event: "error"; data: { error: string; code?: string } };

type MaybeSingleResult<T> = { data: T | null; error?: { message?: string } | null };
type InsertResult<T> = { data: T | null; error?: { message?: string } | null };

type MinimalSupabase = {
  from: (table: string) => any;
};

function mergeAiContext(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...existing, ...patch };
}

function inferTitleFromFirstMessage(message: string) {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New session";
  return trimmed.length > 64 ? `${trimmed.slice(0, 64)}...` : trimmed;
}

async function fetchThreadMessages(supabase: MinimalSupabase, threadId: string, limit = 16) {
  const res: MaybeSingleResult<Array<{ role: string; content: string; created_at: string }>> = await supabase
    .from("agency_ai_chat_messages")
    .select("role, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (res?.error) {
    throw new Error(res.error.message ?? "Failed to load chat messages");
  }
  return res?.data ?? [];
}

function buildConversationText(messages: Array<{ role: string; content: string }>) {
  if (!messages.length) return "";
  return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
}

async function handleGeneralChat(opts: {
  supabase: MinimalSupabase;
  userId: string;
  agencyId: string;
  message: string;
  threadId?: string | null;
}): Promise<AgencyAdminChatHandlerResult> {
  const message = opts.message.trim();
  if (!message) {
    return { status: 400, body: { error: "message is required" } };
  }

  let effectiveThreadId = opts.threadId ?? null;

  if (!effectiveThreadId) {
    const title = inferTitleFromFirstMessage(message);
    const insertThread: InsertResult<{ id: string }> = await opts.supabase
      .from("agency_ai_chat_threads")
      .insert({ agency_id: opts.agencyId, created_by: opts.userId, title, kind: "general" })
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

  let messages: Array<{ role: string; content: string }> = [];
  try {
    const rows = await fetchThreadMessages(opts.supabase, effectiveThreadId);
    messages = rows.map((row) => ({ role: row.role, content: row.content }));
  } catch (error: any) {
    return { status: 500, body: { error: error.message ?? "Failed to load messages" } };
  }

  const conversation = buildConversationText([...messages, { role: "user", content: message }]);

  const insertUserMsg: InsertResult<{ id: string }> = await opts.supabase
    .from("agency_ai_chat_messages")
    .insert({ thread_id: effectiveThreadId, role: "user", content: message, meta_json: {} })
    .select("id")
    .single();

  if (insertUserMsg?.error) {
    return { status: 500, body: { error: insertUserMsg.error.message ?? "Failed to store user message" } };
  }

  let brain: Record<string, unknown> | null = null;
  let brainId: string | null = null;
  try {
    const brainRes = await fetchAgencyBrain(opts.supabase, opts.agencyId);
    brainId = (brainRes.id ?? null) as string | null;
    brain = (brainRes.brain ?? {}) as Record<string, unknown>;
  } catch {
    brain = null;
  }

  let snapshot;
  try {
    snapshot = await buildAgencyContextSnapshot({
      supabase: opts.supabase,
      agencyId: opts.agencyId,
      userId: opts.userId,
      agencyBrain: brain,
    });
  } catch {
    snapshot = {
      agency: null,
      admin: null,
      persona: null,
      prompt_cache: null,
      onboarding_known_facts: null,
      agency_brain_existing: brain,
    };
  }

  const contextSummary = buildAiContextSummary(snapshot);
  if (brain) {
    const existing = (brain as any).ai_context_v1 ?? {};
    const nextContext = mergeAiContext(existing, contextSummary);
    if (JSON.stringify(existing) !== JSON.stringify(nextContext)) {
      const nextBrain = { ...brain, ai_context_v1: nextContext };
      try {
        await upsertAgencyBrain(opts.supabase, opts.agencyId, brainId, nextBrain);
        brain = nextBrain;
      } catch {
        // ignore context snapshot write failures for chat response
      }
    }
  }

  const aiReply = await runAdminGeneralChatAi({
    message,
    agencyId: opts.agencyId,
    userId: opts.userId,
    snapshot,
    brain,
    conversation,
    supabase: opts.supabase,
  });

  if (aiReply.statePatch && brain) {
    const existingContext = (brain as any).ai_context_v1 ?? {};
    const nextContext = mergeAiContext(existingContext, aiReply.statePatch);
    const nextBrain = { ...brain, ai_context_v1: nextContext };
    try {
      await upsertAgencyBrain(opts.supabase, opts.agencyId, brainId, nextBrain);
      brain = nextBrain;
    } catch {
      // ignore state patch failures
    }
  }

  const insertAssistantMsg: InsertResult<{ id: string }> = await opts.supabase
    .from("agency_ai_chat_messages")
    .insert({
      thread_id: effectiveThreadId,
      role: "assistant",
      content: aiReply.assistant_message,
      meta_json: { suggestions: aiReply.suggestions ?? [], provider: aiReply.meta?.provider ?? null, model: aiReply.meta?.model ?? null },
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
      assistant_message: aiReply.assistant_message,
      suggestions: aiReply.suggestions ?? [],
    },
  };
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
  const rawMessage = opts.body?.message ?? "";
  const message = rawMessage.trim();
  const threadId = (opts.body?.thread_id ?? "").trim() || null;

  let agencyId: string | null = null;
  let threadKind: "general" | "setup" = "general";

  if (threadId) {
    const threadRes: MaybeSingleResult<{ id: string; agency_id: string; kind?: string | null; title?: string | null }> =
      await opts.supabase
      .from("agency_ai_chat_threads")
      .select("id, agency_id, kind, title")
      .eq("id", threadId)
      .maybeSingle();

    if (threadRes?.error) {
      return { status: 500, body: { error: threadRes.error.message ?? "Failed to load thread" } };
    }
    if (!threadRes?.data?.agency_id) {
      return { status: 404, body: { error: "Thread not found" } };
    }
    agencyId = threadRes.data.agency_id;
    const title = (threadRes.data.title ?? "").toLowerCase().trim();
    const inferredSetup = /^setup\b/.test(title) || (title.includes("setup") && title.includes("guided"));
    threadKind = threadRes.data.kind === "setup" || inferredSetup ? "setup" : "general";
    if (!threadRes.data.kind && inferredSetup) {
      await opts.supabase
        .from("agency_ai_chat_threads")
        .update({ kind: "setup" })
        .eq("id", threadId);
    }
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

  if (threadKind === "setup") {
    if (!threadId) {
      return { status: 400, body: { error: "thread_id is required for setup threads" } };
    }
    const setupResult = await handleAgencyAdminSetup({
      supabase: opts.supabase,
      userId: opts.userId,
      agencyId,
      threadId,
      message: rawMessage,
    });
    return setupResult;
  }

  return handleGeneralChat({
    supabase: opts.supabase,
    userId: opts.userId,
    agencyId,
    message,
    threadId,
  });
}

export async function* handleAgencyAdminChatStream(opts: {
  supabase: MinimalSupabase;
  userId: string;
  body: AgencyAdminChatRequestBody;
}): AsyncGenerator<AgencyAdminChatStreamChunk> {
  if (isAdminChatSchemaEnabled() || isAdminChatStrategicEnabled()) {
    yield {
      event: "error",
      data: {
        error: "Schema mode requires buffered admin chat responses.",
        code: "SCHEMA_MODE_REQUIRES_BUFFERED",
      },
    };
    return;
  }

  const rawMessage = opts.body?.message ?? "";
  const message = rawMessage.trim();
  const threadId = (opts.body?.thread_id ?? "").trim() || null;

  let agencyId: string | null = null;
  let threadKind: "general" | "setup" = "general";

  if (threadId) {
    const threadRes: MaybeSingleResult<{ id: string; agency_id: string; kind?: string | null; title?: string | null }> =
      await opts.supabase
      .from("agency_ai_chat_threads")
      .select("id, agency_id, kind, title")
      .eq("id", threadId)
      .maybeSingle();

    if (threadRes?.error) {
      yield { event: "error", data: { error: threadRes.error.message ?? "Failed to load thread" } };
      return;
    }
    if (!threadRes?.data?.agency_id) {
      yield { event: "error", data: { error: "Thread not found" } };
      return;
    }
    agencyId = threadRes.data.agency_id;
    const title = (threadRes.data.title ?? "").toLowerCase().trim();
    const inferredSetup = /^setup\b/.test(title) || (title.includes("setup") && title.includes("guided"));
    threadKind = threadRes.data.kind === "setup" || inferredSetup ? "setup" : "general";
    if (!threadRes.data.kind && inferredSetup) {
      await opts.supabase
        .from("agency_ai_chat_threads")
        .update({ kind: "setup" })
        .eq("id", threadId);
    }
  } else {
    const { agencyId: resolvedAgencyId, error } = await getAdminAgencyIdForUser(opts.supabase, opts.userId);
    if (error) {
      yield { event: "error", data: { error } };
      return;
    }
    agencyId = resolvedAgencyId;
  }

  if (!agencyId) {
    yield { event: "error", data: { error: "Forbidden" } };
    return;
  }

  const allowed = await isAdminForAgency(opts.supabase, opts.userId, agencyId);
  if (!allowed) {
    yield { event: "error", data: { error: "Forbidden" } };
    return;
  }

  if (threadKind === "setup") {
    if (!threadId) {
      yield { event: "error", data: { error: "thread_id is required for setup threads" } };
      return;
    }

    const setupResult = await handleAgencyAdminSetup({
      supabase: opts.supabase,
      userId: opts.userId,
      agencyId,
      threadId,
      message: rawMessage,
    });

    if (setupResult.status !== 200) {
      yield { event: "error", data: { error: (setupResult.body as any)?.error ?? "Setup failed" } };
      return;
    }

    const payload = setupResult.body as Record<string, unknown>;
    yield {
      event: "meta",
      data: {
        thread_id: payload.thread_id ?? threadId,
        step_id: payload.step_id ?? null,
        progress_percent: payload.progress_percent ?? null,
        done: payload.done ?? false,
        choices: payload.choices ?? [],
        suggestions: payload.suggestions ?? [],
      },
    };
    const assistantMessage = (payload.assistant_message as string | undefined) ?? "";
    if (assistantMessage) {
      yield { event: "delta", data: { text: assistantMessage } };
    }
    yield { event: "done", data: payload };
    return;
  }

  if (!message) {
    yield { event: "error", data: { error: "message is required" } };
    return;
  }

  let effectiveThreadId = threadId ?? null;

  if (!effectiveThreadId) {
    const title = inferTitleFromFirstMessage(message);
    const insertThread: InsertResult<{ id: string }> = await opts.supabase
      .from("agency_ai_chat_threads")
      .insert({ agency_id: agencyId, created_by: opts.userId, title, kind: "general" })
      .select("id")
      .single();

    if (insertThread?.error) {
      yield { event: "error", data: { error: insertThread.error.message ?? "Failed to create thread" } };
      return;
    }

    effectiveThreadId = insertThread?.data?.id ?? null;
    if (!effectiveThreadId) {
      yield { event: "error", data: { error: "Failed to create thread" } };
      return;
    }
  }

  let messages: Array<{ role: string; content: string }> = [];
  try {
    const rows = await fetchThreadMessages(opts.supabase, effectiveThreadId);
    messages = rows.map((row) => ({ role: row.role, content: row.content }));
  } catch (error: any) {
    yield { event: "error", data: { error: error.message ?? "Failed to load messages" } };
    return;
  }

  const conversation = buildConversationText([...messages, { role: "user", content: message }]);

  const insertUserMsg: InsertResult<{ id: string }> = await opts.supabase
    .from("agency_ai_chat_messages")
    .insert({ thread_id: effectiveThreadId, role: "user", content: message, meta_json: {} })
    .select("id")
    .single();

  if (insertUserMsg?.error) {
    yield { event: "error", data: { error: insertUserMsg.error.message ?? "Failed to store user message" } };
    return;
  }

  let brain: Record<string, unknown> | null = null;
  let brainId: string | null = null;
  try {
    const brainRes = await fetchAgencyBrain(opts.supabase, agencyId);
    brainId = (brainRes.id ?? null) as string | null;
    brain = (brainRes.brain ?? {}) as Record<string, unknown>;
  } catch {
    brain = null;
  }

  let snapshot;
  try {
    snapshot = await buildAgencyContextSnapshot({
      supabase: opts.supabase,
      agencyId,
      userId: opts.userId,
      agencyBrain: brain,
    });
  } catch {
    snapshot = {
      agency: null,
      admin: null,
      persona: null,
      prompt_cache: null,
      onboarding_known_facts: null,
      agency_brain_existing: brain,
    };
  }

  const contextSummary = buildAiContextSummary(snapshot);
  if (brain) {
    const existing = (brain as any).ai_context_v1 ?? {};
    const nextContext = mergeAiContext(existing, contextSummary);
    if (JSON.stringify(existing) !== JSON.stringify(nextContext)) {
      const nextBrain = { ...brain, ai_context_v1: nextContext };
      try {
        await upsertAgencyBrain(opts.supabase, agencyId, brainId, nextBrain);
        brain = nextBrain;
      } catch {
        // ignore context snapshot write failures for chat response
      }
    }
  }

  if (isAdminChatSchemaEnabled() || isAdminChatStrategicEnabled()) {
    const aiReply = await runAdminGeneralChatAi({
      message,
      agencyId,
      userId: opts.userId,
      snapshot,
      brain,
      conversation,
      supabase: opts.supabase,
    });

    if (aiReply.statePatch && brain) {
      const existingContext = (brain as any).ai_context_v1 ?? {};
      const nextContext = mergeAiContext(existingContext, aiReply.statePatch);
      const nextBrain = { ...brain, ai_context_v1: nextContext };
      try {
        await upsertAgencyBrain(opts.supabase, agencyId, brainId, nextBrain);
        brain = nextBrain;
      } catch {
        // ignore state patch failures
      }
    }

    const insertAssistantMsg: InsertResult<{ id: string }> = await opts.supabase
      .from("agency_ai_chat_messages")
      .insert({
        thread_id: effectiveThreadId,
        role: "assistant",
        content: aiReply.assistant_message,
        meta_json: { suggestions: aiReply.suggestions ?? [], provider: aiReply.meta?.provider ?? null, model: aiReply.meta?.model ?? null },
      })
      .select("id")
      .single();

    if (insertAssistantMsg?.error) {
      yield { event: "error", data: { error: insertAssistantMsg.error.message ?? "Failed to store assistant message" } };
      return;
    }

    yield { event: "meta", data: { thread_id: effectiveThreadId } };
    if (aiReply.assistant_message) {
      yield { event: "delta", data: { text: aiReply.assistant_message } };
    }
    yield {
      event: "done",
      data: {
        thread_id: effectiveThreadId,
        assistant_message: aiReply.assistant_message,
        suggestions: aiReply.suggestions ?? [],
      },
    };
    return;
  }

  const stream = await runAdminGeneralChatAiStream({
    message,
    agencyId,
    userId: opts.userId,
    snapshot,
    conversation,
    supabase: opts.supabase,
  });

  yield { event: "meta", data: { thread_id: effectiveThreadId } };

  let rawBuffer = "";
  let lastSent = 0;

  try {
    for await (const chunk of stream) {
      if (chunk.type === "delta") {
        rawBuffer += chunk.text;
        const assistantText = extractAssistantMessageFromText(rawBuffer);
        if (assistantText.length > lastSent) {
          const delta = assistantText.slice(lastSent);
          lastSent = assistantText.length;
          if (delta) {
            yield { event: "delta", data: { text: delta } };
          }
        }
      }
    }
  } catch (error: any) {
    yield { event: "error", data: { error: error?.message ?? "Streaming failed" } };
    return;
  }

  const parsed = parseGeneralChatOutputFromText(rawBuffer);
  if (!parsed) {
    const fallback = {
      assistant_message:
        "I couldn't parse that response. Tell me what you need help with (strategy, offers, workflow, or client questions) and I'll jump in.",
      suggestions: [
        { id: "draft_offer", label: "Draft offer", user_message: "Draft our core offer with pricing ranges." },
        { id: "weekly_plan", label: "Weekly plan", user_message: "Create a weekly priorities plan for the agency." },
      ],
    };
    yield { event: "done", data: { thread_id: effectiveThreadId, ...fallback } };
    return;
  }

  const insertAssistantMsg: InsertResult<{ id: string }> = await opts.supabase
    .from("agency_ai_chat_messages")
    .insert({
      thread_id: effectiveThreadId,
      role: "assistant",
      content: parsed.assistant_message,
      meta_json: { suggestions: parsed.suggestions ?? [] },
    })
    .select("id")
    .single();

  if (insertAssistantMsg?.error) {
    yield { event: "error", data: { error: insertAssistantMsg.error.message ?? "Failed to store assistant message" } };
    return;
  }

  yield {
    event: "done",
    data: {
      thread_id: effectiveThreadId,
      assistant_message: parsed.assistant_message,
      suggestions: parsed.suggestions ?? [],
    },
  };
}
