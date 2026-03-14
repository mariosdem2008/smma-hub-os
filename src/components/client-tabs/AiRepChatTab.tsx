import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { parseEdgeFunctionResponse } from "@/lib/edgeFunctionError";
import { AiWorkflowBlockNotice } from "@/components/ai/AiWorkflowBlockNotice";
import { buildActivationBlockState, type AiWorkflowBlockState } from "@/lib/aiWorkflowBlock";

type Suggestion = { id: string; label: string; user_message: string };
type ChatMessage = { role: "user" | "assistant"; content: string; suggestions?: Suggestion[] };

export default function AiRepChatTab({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me anything about this client." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [blocker, setBlocker] = useState<AiWorkflowBlockState | null>(null);

  async function send(nextMessage?: string) {
    const text = (nextMessage ?? input).trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-rep-chat`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ client_id: clientId, message: text }),
      });
      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

      if (!response.ok) {
        const parsed = parseEdgeFunctionResponse(data);
        if (!parsed.success && parsed.error?.code === "AGENT_ACTIVATION_REQUIRED") {
          setBlocker(buildActivationBlockState({
            message: parsed.error.message,
            deepLink: parsed.error.deepLink,
            requiredMode: parsed.error.requiredMode,
            unlockState: parsed.error.unlockState,
            activationMode: parsed.error.activationMode,
            missingCertificationScenarios: parsed.error.missingCertificationScenarios,
            hasAgencySession: !!session?.access_token,
          }));
          throw new Error(parsed.error.message);
        }
        throw new Error((data?.error as string | undefined) ?? `Request failed (${response.status})`);
      }

      setBlocker(null);
      const reply = (data?.assistant_message as string | undefined) ?? "UNKNOWN\n\nWhat should we focus on?";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          suggestions: Array.isArray(data?.suggestions) ? (data.suggestions as Suggestion[]) : [],
        },
      ]);
    } catch (err: any) {
      toast({
        title: "AI Rep error",
        description: err?.message ?? "Failed to send message",
        variant: "destructive",
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "UNKNOWN\n\nI couldn't send that. Please try again.", suggestions: [] },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {blocker ? (
        <AiWorkflowBlockNotice block={blocker} fallbackLabel="Open AI Setup" />
      ) : null}

      <Card className="p-4">
        <div className="space-y-3 max-h-[55vh] overflow-auto">
          {messages.map((m, idx) => (
            <div key={idx} className="space-y-2">
              <div
                className={
                  m.role === "user"
                    ? "ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "mr-auto w-fit max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
                }
              >
                <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              </div>
              {m.role === "assistant" && m.suggestions && m.suggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {m.suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => send(suggestion.user_message)}
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
        </div>
      </Card>

      <div className="flex gap-2">
        <textarea
          className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message the AI Representative..."
        />
        <Button onClick={() => send()} disabled={sending || input.trim().length === 0}>
          Send
        </Button>
      </div>
    </div>
  );
}
