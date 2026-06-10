import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Bot, Check, FileText, Lightbulb, Loader2, Send, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PremiumPage } from "@/components/shared/PremiumPage";

interface OutletContext {
  clientId: string;
}

type Suggestion = { id: string; label: string; user_message: string };

type AssistantProposal = {
  id: string;
  module: string;
  title: string;
  summary: string;
  proposed_content_json: Record<string, unknown>;
  risks?: string[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: Suggestion[];
  proposals?: AssistantProposal[];
};

function safeUuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return String(Date.now());
  }
}

function normalizeProposal(value: unknown): AssistantProposal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = String(record.id ?? "").trim();
  const title = String(record.title ?? "").trim();
  const module = String(record.module ?? "idea").trim();
  const summary = String(record.summary ?? "").trim();
  const proposedContent = record.proposed_content_json;
  if (!id || !title || !proposedContent || typeof proposedContent !== "object" || Array.isArray(proposedContent)) {
    return null;
  }

  return {
    id,
    title,
    module,
    summary,
    proposed_content_json: proposedContent as Record<string, unknown>,
    risks: Array.isArray(record.risks) ? record.risks.map(String).filter(Boolean) : undefined,
  };
}

function moduleLabel(module: string) {
  return module.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

async function sendAssistantMessage(input: {
  clientId: string;
  message: string;
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  const endpoint = session?.access_token ? "ai-assistant" : "ai-rep-chat";
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const body =
    endpoint === "ai-assistant"
      ? {
          action: "send",
          client_id: input.clientId,
          active_tab: "client_portal_ai_assistant",
          message: input.message,
          chat_history: input.chatHistory,
        }
      : {
          client_id: input.clientId,
          message: input.message,
          chat_history: input.chatHistory,
        };

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : {};
  if (!response.ok) {
    throw new Error((data?.error as string | undefined) ?? `Request failed (${response.status})`);
  }

  const proposals = (
    Array.isArray(data?.json?.proposals)
      ? data.json.proposals
      : Array.isArray(data?.proposals)
        ? data.proposals
        : []
  )
    .map(normalizeProposal)
    .filter((proposal): proposal is AssistantProposal => !!proposal);

  return {
    assistantMessage: String(data?.assistant_message ?? "").trim() || "I could not generate a response.",
    proposals,
    suggestions: Array.isArray(data?.suggestions) ? (data.suggestions as Suggestion[]) : [],
  };
}

export function PortalAiAssistant() {
  const { clientId } = useOutletContext<OutletContext>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ask me about approvals, campaign performance, content ideas, or draft a proposal for your agency to review.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [acceptedProposalIds, setAcceptedProposalIds] = useState<Set<string>>(() => new Set());
  const [dismissedProposalIds, setDismissedProposalIds] = useState<Set<string>>(() => new Set());
  const [acceptingProposalId, setAcceptingProposalId] = useState<string | null>(null);

  const visibleMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        proposals: (message.proposals ?? []).filter((proposal) => !dismissedProposalIds.has(proposal.id)),
      })),
    [dismissedProposalIds, messages],
  );

  async function send(nextMessage?: string) {
    const text = (nextMessage ?? input).trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = { id: safeUuid(), role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const result = await sendAssistantMessage({
        clientId,
        message: text,
        chatHistory: nextMessages
          .filter((message) => message.id !== "welcome")
          .slice(-20)
          .map((message) => ({ role: message.role, content: message.content })),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: safeUuid(),
          role: "assistant",
          content: result.assistantMessage,
          suggestions: result.suggestions,
          proposals: result.proposals,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message";
      toast({ title: "AI assistant error", description: message, variant: "destructive" });
      setMessages((prev) => [
        ...prev,
        { id: safeUuid(), role: "assistant", content: "I could not send that. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function acceptProposal(proposal: AssistantProposal) {
    if (acceptedProposalIds.has(proposal.id) || acceptingProposalId) return;

    setAcceptingProposalId(proposal.id);
    try {
      const { error } = await supabase.from("ideas").insert({
        client_id: clientId,
        title: proposal.title,
        description: proposal.summary || `AI assistant proposal for ${moduleLabel(proposal.module)}.`,
        content_body: JSON.stringify(proposal.proposed_content_json, null, 2),
        idea_references: [
          {
            source: "ai_assistant",
            proposal_id: proposal.id,
            module: proposal.module,
            risks: proposal.risks ?? [],
          },
        ],
        tags: ["ai-assistant", proposal.module],
        status: "draft",
      });

      if (error) throw error;

      setAcceptedProposalIds((prev) => new Set(prev).add(proposal.id));
      toast({
        title: "Proposal accepted",
        description: "A draft idea was created in the Ideas workspace.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to accept proposal";
      toast({ title: "Accept failed", description: message, variant: "destructive" });
    } finally {
      setAcceptingProposalId(null);
    }
  }

  function dismissProposal(proposalId: string) {
    setDismissedProposalIds((prev) => new Set(prev).add(proposalId));
  }

  return (
    <PremiumPage
      eyebrow="Assistant"
      title="AI Assistant"
      description="Ask campaign, asset, and performance questions in your client portal."
      className="mx-auto max-w-5xl"
      actions={
        <Button variant="outline" onClick={() => navigate("../ideas")} className="gap-2">
          <Lightbulb className="h-4 w-4" />
          Open Ideas
        </Button>
      }
    >
      <Card>
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="max-h-[58vh] space-y-4 overflow-auto pr-1">
            {visibleMessages.map((message) => (
              <div key={message.id} className="space-y-3">
                <div className={cn("flex gap-3", message.role === "user" && "justify-end")}>
                  {message.role === "assistant" ? (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                      <Bot className="h-4 w-4" />
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "max-w-[86%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border/80 bg-muted/50 text-foreground",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>

                {message.role === "assistant" && message.proposals && message.proposals.length > 0 ? (
                  <div className="ml-0 space-y-3 md:ml-11">
                    {message.proposals.map((proposal) => {
                      const accepted = acceptedProposalIds.has(proposal.id);
                      const accepting = acceptingProposalId === proposal.id;
                      return (
                        <Card key={proposal.id} className="border-primary/25 bg-card/90">
                          <CardHeader className="space-y-2 pb-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-primary" />
                                  <CardTitle className="text-base">{proposal.title}</CardTitle>
                                  <Badge variant="outline">{moduleLabel(proposal.module)}</Badge>
                                </div>
                                {proposal.summary ? (
                                  <p className="text-sm text-muted-foreground">{proposal.summary}</p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => acceptProposal(proposal)}
                                  disabled={accepted || accepting}
                                  className="gap-2"
                                >
                                  {accepting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                  {accepted ? "Accepted" : "Accept"}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => dismissProposal(proposal.id)}
                                  disabled={accepting}
                                  aria-label={`Dismiss ${proposal.title}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 pt-0">
                            <div className="rounded-lg border bg-muted/40 p-3">
                              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                <FileText className="h-3.5 w-3.5" />
                                Proposed content
                              </div>
                              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                                {JSON.stringify(proposal.proposed_content_json, null, 2)}
                              </pre>
                            </div>
                            {proposal.risks && proposal.risks.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {proposal.risks.map((risk) => (
                                  <Badge key={risk} variant="secondary" className="max-w-full whitespace-normal text-left">
                                    {risk}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : null}

                {message.role === "assistant" && message.suggestions && message.suggestions.length > 0 ? (
                  <div className="ml-0 flex flex-wrap gap-2 md:ml-11">
                    {message.suggestions.map((suggestion) => (
                      <Button
                        key={suggestion.id}
                        variant="outline"
                        size="sm"
                        onClick={() => send(suggestion.user_message)}
                        disabled={sending}
                      >
                        {suggestion.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {sending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            ) : null}
          </div>

          <div className="flex gap-2 border-t pt-4">
            <Textarea
              className="min-h-[48px] resize-none"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Message the AI Assistant..."
            />
            <Button onClick={() => send()} disabled={sending || input.trim().length === 0} className="h-auto gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PremiumPage>
  );
}
