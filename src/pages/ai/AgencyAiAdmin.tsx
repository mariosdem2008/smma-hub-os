import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ThreadRow = { id: string; title: string; created_at: string };
type MessageRow = { id: string; role: string; content: string; created_at: string };

export default function AgencyAiAdmin() {
  const { isAdmin, loading: roleLoading } = useRole();
  const { user } = useAuth();
  const { toast } = useToast();

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loadingAgency, setLoadingAgency] = useState(false);

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    if (!user?.id) return;
    if (agencyId) return;

    const run = async () => {
      setLoadingAgency(true);
      try {
        const { data, error } = await supabase
          .from("agency_members")
          .select("agency_id")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        setAgencyId(data?.agency_id ?? null);
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
        .select("id,title,created_at")
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

  async function loadMessages(threadId: string) {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("agency_ai_chat_messages")
        .select("id,role,content,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages((data ?? []) as any);
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

  const activeTitle = useMemo(() => {
    if (!activeThreadId) return "New session";
    return threads.find((t) => t.id === activeThreadId)?.title ?? "Session";
  }, [activeThreadId, threads]);

  async function send() {
    const text = input.trim();
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
      const { data, error } = await supabase.functions.invoke("ai-agency-admin-chat", {
        body: { thread_id: activeThreadId ?? undefined, message: text },
      });
      if (error) throw new Error(error.message);

      const nextThreadId = (data?.thread_id as string | undefined) ?? null;
      const assistant = (data?.assistant_message as string | undefined) ?? "UNKNOWN";

      if (nextThreadId && nextThreadId !== activeThreadId) {
        setActiveThreadId(nextThreadId);
        if (agencyId) await loadThreads(agencyId);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-assistant-${Date.now()}`,
          role: "assistant",
          content: assistant,
          created_at: new Date().toISOString(),
        },
      ]);
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
          content: "UNKNOWN\n\nPlease try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (roleLoading) {
    return (
      <div className="container max-w-5xl py-10">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container max-w-6xl py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agency AI</h1>
        <p className="text-sm text-muted-foreground">Admin-only</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <Card className="h-[70vh] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Sessions</CardTitle>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setActiveThreadId(null);
                setMessages([]);
              }}
            >
              New session
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t" />
            <div className="max-h-[calc(70vh-56px)] overflow-auto p-2 space-y-1">
              {loadingAgency || loadingThreads ? (
                <div className="p-3 text-sm text-muted-foreground">Loading…</div>
              ) : !agencyId ? (
                <div className="p-3 text-sm text-muted-foreground">No admin agency found.</div>
              ) : threads.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No sessions yet.</div>
              ) : (
                threads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveThreadId(t.id)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                      activeThreadId === t.id ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{new Date(t.created_at).toLocaleString()}</div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-[70vh] overflow-hidden flex flex-col">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">{activeTitle}</CardTitle>
            <div className="text-xs text-muted-foreground">Revelation Chat (v1)</div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col gap-3">
            <div className="flex-1 min-h-0 overflow-auto space-y-2 rounded-md border bg-background p-3">
              {loadingMessages ? (
                <div className="text-sm text-muted-foreground">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">Start a new session or select one on the left.</div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "user"
                        ? "ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "mr-auto w-fit max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
                    }
                  >
                    <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <textarea
                className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message the agency AI…"
              />
              <Button onClick={send} disabled={sending || input.trim().length === 0}>
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

