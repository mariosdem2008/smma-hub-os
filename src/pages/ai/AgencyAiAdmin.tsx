import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getActiveAgencyId } from "@/lib/active-agency";

type ThreadRow = { id: string; title: string; created_at: string; kind?: string | null };
type Suggestion = { id: string; label: string; user_message: string };
type MessageRow = { id: string; role: string; content: string; created_at: string; suggestions?: Suggestion[] };
type SetupMeta = {
  stepId: string;
  progressPercent: number;
  done?: boolean;
  choices?: Array<{ id: string; label: string }>;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function isStreamingEnabled() {
  return !(globalThis as any).__SMMAHUB_STREAMING_DISABLED__;
}

export default function AgencyAiAdmin() {
  const { isAdmin, loading: roleLoading } = useRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loadingAgency, setLoadingAgency] = useState(false);

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [startingSetup, setStartingSetup] = useState(false);
  const [primedSetupThreadId, setPrimedSetupThreadId] = useState<string | null>(null);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [setupMeta, setSetupMeta] = useState<SetupMeta | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const streamingAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    if (!user?.id) return;
    if (agencyId) return;

    const run = async () => {
      setLoadingAgency(true);
      try {
        setAgencyId(getActiveAgencyId());
      } catch (err: any) {
        toast({
          title: "Failed to load agency",
          description: err?.message ?? "Unknown error",
          variant: "destructive",
        });
      } finally {
        setLoadingAgency(false);
      }
    };

    run();
  }, [agencyId, isAdmin, toast, user?.id]);

  async function loadThreads(nextAgencyId: string) {
    setLoadingThreads(true);
    try {
      const { data, error } = await supabase
        .from("agency_ai_chat_threads")
        .select("id,title,created_at,kind")
        .eq("agency_id", nextAgencyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setThreads((data ?? []) as any);
    } catch (err: any) {
      toast({
        title: "Failed to load sessions",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingThreads(false);
    }
  }

  useEffect(() => {
    if (!agencyId) return;
    loadThreads(agencyId);
  }, [agencyId]);

  const setupThread = useMemo(() => threads.find((t) => t.kind === "setup") ?? null, [threads]);
  const generalThreads = useMemo(() => threads.filter((t) => t.kind !== "setup"), [threads]);

  async function loadMessages(threadId: string) {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("agency_ai_chat_messages")
        .select("id,role,content,created_at,meta_json")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages(
        (data ?? []).map((row: any) => ({
          id: row.id,
          role: row.role,
          content: row.content,
          created_at: row.created_at,
          suggestions: Array.isArray(row?.meta_json?.suggestions) ? row.meta_json.suggestions : [],
        })),
      );
    } catch (err: any) {
      toast({
        title: "Failed to load messages",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    if (!activeThreadId) return;
    loadMessages(activeThreadId);
  }, [activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) {
      setSetupMeta(null);
      return;
    }
    if (setupThread?.id !== activeThreadId) {
      setSetupMeta(null);
    }
  }, [activeThreadId, setupThread?.id]);

  useEffect(() => {
    if (setupMeta) {
      setSetupComplete(Boolean(setupMeta.done));
    }
  }, [setupMeta]);

  const isSetupActive = Boolean(setupThread?.id && activeThreadId === setupThread.id);

  const createGeneralThread = useCallback(async () => {
    if (!agencyId || !user?.id) return;
    setLoadingThreads(true);
    try {
      const { data, error } = await supabase
        .from("agency_ai_chat_threads")
        .insert({ agency_id: agencyId, created_by: user.id, title: "New chat", kind: "general" })
        .select("id,title,created_at,kind")
        .single();
      if (error) throw error;
      if (data?.id) {
        setThreads((prev) => [data as ThreadRow, ...prev.filter((t) => t.id !== data.id)]);
        setActiveThreadId(data.id);
        setMessages([]);
      }
    } catch (err: any) {
      toast({
        title: "Failed to create chat",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingThreads(false);
    }
  }, [agencyId, toast, user?.id]);

  const ensureSetupThread = useCallback(async () => {
    if (!agencyId || !user?.id) return;
    if (setupThread?.id) {
      setActiveThreadId(setupThread.id);
      setMessages([]);
      return;
    }

    setStartingSetup(true);
    try {
      const { data, error } = await supabase
        .from("agency_ai_chat_threads")
        .insert({ agency_id: agencyId, created_by: user.id, title: "Setup (Guided)", kind: "setup" })
        .select("id,title,created_at,kind")
        .single();
      if (error) throw error;
      if (data?.id) {
        setThreads((prev) => [data as ThreadRow, ...prev.filter((t) => t.id !== data.id)]);
        setActiveThreadId(data.id);
        setMessages([]);
      }
    } catch (err: any) {
      const message = err?.message ?? "Unknown error";
      if (message.includes("agency_ai_chat_threads_one_setup_idx") || message.includes("duplicate")) {
        await loadThreads(agencyId);
        const existing = setupThread?.id ?? threads.find((t) => t.kind === "setup")?.id;
        if (existing) {
          setActiveThreadId(existing);
          setMessages([]);
        }
      } else {
        toast({
          title: "Failed to start setup",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setStartingSetup(false);
    }
  }, [agencyId, loadThreads, setupThread?.id, threads, toast, user?.id]);

  const primeSetupThread = useCallback(
    async (threadId: string) => {
      if (sending) return;
      setSending(true);
      try {
        const next = await streamAgencyAdminChat({
          payload: { thread_id: threadId, message: "" },
          onStart: (assistantId) => {
            setMessages((prev) => [
              ...prev,
              {
                id: assistantId,
                role: "assistant",
                content: "",
                created_at: new Date().toISOString(),
                suggestions: [],
              },
            ]);
          },
          onDelta: (assistantId, delta) => {
            if (!delta) return;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: `${msg.content}${delta}` } : msg,
              ),
            );
          },
          onDone: (assistantId, data) => {
            const assistant = (data?.assistant_message as string | undefined) ?? "UNKNOWN";
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: assistant,
                      suggestions: Array.isArray(data?.suggestions) ? (data.suggestions as Suggestion[]) : [],
                    }
                  : msg,
              ),
            );

            setPrimedSetupThreadId(threadId);
            if (typeof data?.progress_percent === "number" || typeof data?.done === "boolean" || data?.step_id) {
              setSetupMeta({
                stepId: (data?.step_id as string | undefined) ?? "guided_setup",
                progressPercent: Number(data.progress_percent ?? 0),
                choices: (data.choices as SetupMeta["choices"]) ?? [],
                done: Boolean(data.done),
              });
            }
          },
        });

        if (!next) throw new Error("Streaming failed");
      } catch (err: any) {
        toast({
          title: "Agency AI error",
          description: err?.message ?? "Failed to start setup",
          variant: "destructive",
        });
      } finally {
        setSending(false);
      }
    },
    [sending, toast],
  );

  const sendUserMessage = useCallback(
    async (nextText?: string) => {
      const text = (nextText ?? input).trim();
      if (!text || sending) return;

      setSending(true);
      setInput("");

      const optimisticUserMsg: MessageRow = {
        id: `tmp-user-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);

      try {
        const next = await streamAgencyAdminChat({
          payload: { thread_id: activeThreadId ?? undefined, message: text },
          onStart: (assistantId) => {
            setMessages((prev) => [
              ...prev,
              {
                id: assistantId,
                role: "assistant",
                content: "",
                created_at: new Date().toISOString(),
                suggestions: [],
              },
            ]);
          },
          onDelta: (assistantId, delta) => {
            if (!delta) return;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: `${msg.content}${delta}` } : msg,
              ),
            );
          },
          onDone: async (assistantId, data) => {
            const nextThreadId = (data?.thread_id as string | undefined) ?? null;
            const assistant = (data?.assistant_message as string | undefined) ?? "UNKNOWN";

            if (nextThreadId && nextThreadId !== activeThreadId) {
              setActiveThreadId(nextThreadId);
              if (agencyId) await loadThreads(agencyId);
            }

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: assistant,
                      suggestions: Array.isArray(data?.suggestions) ? (data.suggestions as Suggestion[]) : [],
                    }
                  : msg,
              ),
            );

            const resolvedThreadId = nextThreadId ?? activeThreadId;
            if (setupThread?.id && resolvedThreadId === setupThread.id) {
              setSetupMeta({
                stepId: (data?.step_id as string | undefined) ?? "guided_setup",
                progressPercent: Number(data.progress_percent ?? 0),
                choices: (data.choices as SetupMeta["choices"]) ?? [],
                done: Boolean(data.done),
              });
            }
          },
        });

        if (!next) throw new Error("Streaming failed");
      } catch (err: any) {
        toast({
          title: "Agency AI error",
          description: err?.message ?? "Failed to send message",
          variant: "destructive",
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `tmp-error-${Date.now()}`,
            role: "assistant",
            content: "UNKNOWN\\n\\nPlease try again.",
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [activeThreadId, agencyId, input, loadThreads, sending, setupThread?.id, toast],
  );

  async function streamAgencyAdminChat({
    payload,
    onStart,
    onDelta,
    onDone,
  }: {
    payload: { thread_id?: string; message: string };
    onStart: (assistantId: string) => void;
    onDelta: (assistantId: string, delta: string) => void;
    onDone: (assistantId: string, data: any) => void | Promise<void>;
  }) {
    if (!isStreamingEnabled() || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      const { data, error } = await supabase.functions.invoke("ai-agency-admin-chat", {
        body: payload,
      });
      if (error) throw new Error(error.message);
      const assistantId = `tmp-assistant-${Date.now()}`;
      onStart(assistantId);
      onDone(assistantId, data ?? {});
      return data ?? null;
    }

    streamingAbortRef.current?.abort();
    const controller = new AbortController();
    streamingAbortRef.current = controller;

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (!accessToken) throw new Error("Not authenticated");

    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-agency-admin-chat?stream=1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `HTTP ${response.status}`);
    }

    const assistantId = `tmp-assistant-${Date.now()}`;
    onStart(assistantId);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx = buffer.indexOf("\n\n");
      while (idx !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        idx = buffer.indexOf("\n\n");

        const lines = raw.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data += line.slice(5).trim();
        }

        if (!data) continue;
        let parsed: any = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = null;
        }

        if (event === "delta" && parsed?.text) {
          onDelta(assistantId, parsed.text);
        }
        if (event === "done" && parsed) {
          await onDone(assistantId, parsed);
          return parsed;
        }
        if (event === "error") {
          throw new Error(parsed?.error ?? "Streaming error");
        }
      }
    }

    return null;
  }

  const handleChoiceClick = useCallback(
    (choice: { id: string; label: string }) => {
      if (choice.id === "custom") {
        setInput("Custom: ");
        return;
      }
      sendUserMessage(choice.id);
    },
    [sendUserMessage],
  );

  useEffect(() => {
    if (!agencyId || !isAdmin) return;
    if (loadingThreads) return;
    if (searchParams.get("mode") !== "guided_onboarding") return;

    ensureSetupThread();

    const next = new URLSearchParams(searchParams);
    next.delete("mode");
    setSearchParams(next, { replace: true });
  }, [agencyId, ensureSetupThread, isAdmin, loadingThreads, searchParams, setSearchParams]);

  useEffect(() => {
    if (!activeThreadId) return;
    if (setupThread?.id !== activeThreadId) return;
    if (primedSetupThreadId === activeThreadId) return;
    if (loadingMessages) return;
    if (messages.length > 0) return;

    primeSetupThread(activeThreadId);
  }, [activeThreadId, loadingMessages, messages.length, primeSetupThread, primedSetupThreadId, setupThread?.id]);

  if (roleLoading) {
    return (
      <div className="container max-w-5xl py-10">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="h-[calc(100vh-2rem)] w-full px-4 py-4">
      <div className="flex h-full gap-3">
        <aside
          className={cn(
            "flex h-full flex-col rounded-2xl border bg-background/70 backdrop-blur transition-all",
            sidebarOpen ? "w-72" : "w-12",
          )}
        >
          <div className={cn("flex items-center justify-between", sidebarOpen ? "px-3 py-2" : "p-2")}>
            {sidebarOpen ? (
              <div className="text-xs font-medium text-muted-foreground">Chats</div>
            ) : (
              <div />
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="h-8 w-8"
            >
              {sidebarOpen ? "⟨" : "⟩"}
            </Button>
          </div>

          {sidebarOpen ? (
            <>
              <div className="flex items-center justify-between px-3">
                <Button size="sm" variant="secondary" onClick={createGeneralThread} disabled={loadingThreads}>
                  New chat
                </Button>
              </div>

              <div className="mt-3 flex-1 overflow-auto px-2 pb-3 space-y-4">
                {loadingAgency || loadingThreads ? (
                  <div className="px-2 text-sm text-muted-foreground">Loading...</div>
                ) : !agencyId ? (
                  <div className="px-2 text-sm text-muted-foreground">No admin agency found.</div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="px-2 text-[11px] font-semibold uppercase text-muted-foreground">Setup</div>
                      {setupThread ? (
                        <button
                          onClick={() => setActiveThreadId(setupThread.id)}
                          className={cn(
                            "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                            activeThreadId === setupThread.id
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium truncate">Setup (Guided)</div>
                            {setupComplete ? <span className="h-2 w-2 rounded-full bg-emerald-400" /> : null}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {new Date(setupThread.created_at).toLocaleString()}
                          </div>
                        </button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={ensureSetupThread}
                          disabled={startingSetup}
                          className="mx-2 w-[calc(100%-16px)]"
                        >
                          {startingSetup ? "Starting..." : "Start Setup"}
                        </Button>
                      )}
                    </div>

                    <div className="border-t" />

                    <div className="space-y-1">
                      <div className="px-2 text-[11px] font-semibold uppercase text-muted-foreground">
                        General chats
                      </div>
                      {generalThreads.length === 0 ? (
                        <div className="px-2 text-sm text-muted-foreground">No chats yet.</div>
                      ) : (
                        generalThreads.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setActiveThreadId(t.id)}
                            className={cn(
                              "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                              activeThreadId === t.id ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                            )}
                          >
                            <div className="font-medium truncate">{t.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {new Date(t.created_at).toLocaleString()}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </aside>

        <main className="flex h-full flex-1 flex-col">
          <div className="flex-1 overflow-auto rounded-2xl border bg-background p-6 shadow-sm">
            {loadingMessages ? (
              <div className="text-sm text-muted-foreground">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Start a new chat or select one from the left.
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => (
                  <div key={m.id} className="space-y-2">
                    <div
                      className={cn(
                        "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-base leading-relaxed",
                        m.role === "user"
                          ? "ml-auto bg-primary text-primary-foreground shadow"
                          : "mr-auto bg-muted text-foreground",
                      )}
                    >
                      {m.content}
                    </div>
                    {m.role === "assistant" && m.suggestions && m.suggestions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {m.suggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            onClick={() => sendUserMessage(suggestion.user_message)}
                            className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-transform hover:scale-[1.02] hover:bg-muted active:scale-[0.98]"
                            disabled={sending}
                          >
                            {suggestion.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {sending ? (
                  <div className="mr-auto w-fit max-w-[80%] rounded-2xl bg-muted px-4 py-3 text-base text-foreground">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {isSetupActive && setupMeta?.choices && setupMeta.choices.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {setupMeta.choices.map((choice) => (
                <Button
                  key={choice.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleChoiceClick(choice)}
                  disabled={sending}
                >
                  {choice.label}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex gap-2">
            <textarea
              className="min-h-[60px] w-full rounded-2xl border border-input bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message the agency AI"
            />
            <Button onClick={() => sendUserMessage()} disabled={sending || input.trim().length === 0} className="px-6">
              Send
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
