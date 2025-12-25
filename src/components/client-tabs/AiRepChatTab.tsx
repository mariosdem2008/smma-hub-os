import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function AiRepChatTab({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me anything about this client." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const { data, error } = await supabase.functions.invoke("ai-rep-chat", {
        body: { client_id: clientId, message: text },
      });
      if (error) throw new Error(error.message);

      const reply = (data?.assistant_message as string | undefined) ?? "UNKNOWN\n\nWhat should we focus on?";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      toast({
        title: "AI Rep error",
        description: err?.message ?? "Failed to send message",
        variant: "destructive",
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "UNKNOWN\n\nI couldn't send that. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-3 max-h-[55vh] overflow-auto">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={
                m.role === "user"
                  ? "ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "mr-auto w-fit max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
              }
            >
              <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        <textarea
          className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message the AI Representative…"
        />
        <Button onClick={send} disabled={sending || input.trim().length === 0}>
          Send
        </Button>
      </div>
    </div>
  );
}

