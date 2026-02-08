import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { AdaptiveInputField } from "@/components/onboarding-chat/AdaptiveInputField";
import type { OnboardingChatMessage, OnboardingTurnResponse } from "@/components/onboarding-chat/types";

const SESSION_PREFIX = "ai_onboarding_chat_agency_";
const PLACEHOLDER_PATTERN = /ready to begin onboarding/i;

type PersistedSession = {
  messages: OnboardingChatMessage[];
  draftInput: string;
  expects: string;
  suggestions: string[];
  lastResponse?: OnboardingTurnResponse;
};

function createTurnId() {
  return `turn_${Date.now()}_${crypto.randomUUID()}`;
}

function createMessage(role: "assistant" | "user", text: string, json?: Record<string, unknown> | null): OnboardingChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    json: json ?? null,
  };
}

export default function AiOnboardingAgency() {
  const { agencyId } = useAgency();

  const storageKey = useMemo(() => (agencyId ? `${SESSION_PREFIX}${agencyId}` : null), [agencyId]);

  const [messages, setMessages] = useState<OnboardingChatMessage[]>([]);
  const [draftInput, setDraftInput] = useState("");
  const [expects, setExpects] = useState("text");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastResponse, setLastResponse] = useState<OnboardingTurnResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [needsReset, setNeedsReset] = useState(false);

  useEffect(() => {
    if (!storageKey) {
      setSessionHydrated(true);
      return;
    }
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PersistedSession;
        const hasPlaceholder = parsed.messages?.some((message) => PLACEHOLDER_PATTERN.test(message.text));
        if (hasPlaceholder) {
          localStorage.removeItem(storageKey);
          setNeedsReset(true);
        } else {
          setMessages(parsed.messages ?? []);
          setDraftInput(parsed.draftInput ?? "");
          setExpects(parsed.expects ?? "text");
          setSuggestions(parsed.suggestions ?? []);
          setLastResponse(parsed.lastResponse ?? null);
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
    setSessionHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !sessionHydrated) return;
    const payload: PersistedSession = {
      messages,
      draftInput,
      expects,
      suggestions,
      lastResponse: lastResponse ?? undefined,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [storageKey, sessionHydrated, messages, draftInput, expects, suggestions, lastResponse]);

  const sendTurn = async (
    input: string,
    mode: "input" | "chip_fill" | "skip" | "skip_all" | "undo" = "input"
  ) => {
    if (!agencyId) return;
    const trimmed = input.trim();
    if (!trimmed && mode !== "skip" && mode !== "skip_all" && mode !== "undo") return;

    setError(null);
    setLoading(true);

    const payload: Record<string, unknown> = {
      agency_id: agencyId,
      scope: "agency",
      client_turn_id: createTurnId(),
    };

    if (mode === "skip") {
      payload.skip_optional = true;
    } else if (mode === "skip_all") {
      payload.skip_all_optional = true;
    } else if (mode === "undo") {
      payload.undo_last = true;
    } else {
      payload.user_message = trimmed;
    }

    setLastPayload(payload);
    if (trimmed && mode !== "undo") {
      const userMessage = createMessage("user", trimmed);
      setMessages((prev) => [...prev, userMessage]);
      setDraftInput("");
    }

    const { data, error: invokeError } = await supabase.functions.invoke("ai-onboarding", {
      body: payload,
    });

    setLoading(false);

    if (invokeError || !data) {
      setError(invokeError?.message ?? "Failed to send onboarding turn.");
      return;
    }

    const response = data as OnboardingTurnResponse;
    setLastResponse(response);
    setExpects(response.expects || "text");
    setSuggestions(response.suggestions ?? []);

    const assistantText = response.unknown
      ? `${response.assistant_message}\n\nReason: ${response.unknown_reason ?? "unknown"}`
      : response.assistant_message;

    setMessages((prev) => [
      ...prev,
      createMessage("assistant", assistantText, {
        state: response.state,
        onboarding_status: response.onboarding_status,
        brain_snapshot: response.brain_snapshot,
      }),
    ]);
  };

  const requestInitialPrompt = async () => {
    if (!agencyId) return;
    setLoading(true);
    setError(null);

    const payload = {
      agency_id: agencyId,
      scope: "agency",
      client_turn_id: createTurnId(),
      reset_onboarding: needsReset,
    };
    setLastPayload(payload);

    const { data, error: invokeError } = await supabase.functions.invoke("ai-onboarding", {
      body: payload,
    });

    setLoading(false);
    if (invokeError || !data) {
      setError(invokeError?.message ?? "Failed to start onboarding.");
      return;
    }

    const response = data as OnboardingTurnResponse;
    setLastResponse(response);
    setExpects(response.expects || "text");
    setSuggestions(response.suggestions ?? []);
    setNeedsReset(false);
    setMessages([
      createMessage("assistant", response.assistant_message, {
        state: response.state,
        onboarding_status: response.onboarding_status,
        brain_snapshot: response.brain_snapshot,
      }),
    ]);
  };

  useEffect(() => {
    if (!agencyId || !initializing || !sessionHydrated) return;
    setInitializing(false);
    if (messages.length === 0) {
      void requestInitialPrompt();
    }
  }, [agencyId, initializing, sessionHydrated, messages.length]);

  const retryLast = async () => {
    if (!lastPayload) return;
    setLoading(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke("ai-onboarding", {
      body: lastPayload,
    });
    setLoading(false);

    if (invokeError || !data) {
      setError(invokeError?.message ?? "Retry failed.");
      return;
    }

    const response = data as OnboardingTurnResponse;
    setLastResponse(response);
    setExpects(response.expects || "text");
    setSuggestions(response.suggestions ?? []);
    setMessages((prev) => [
      ...prev,
      createMessage("assistant", response.assistant_message, {
        state: response.state,
        onboarding_status: response.onboarding_status,
        brain_snapshot: response.brain_snapshot,
      }),
    ]);
  };

  if (!agencyId) {
    return (
      <div className="min-h-screen p-6">
        <Alert>
          <AlertTitle>No active agency selected</AlertTitle>
          <AlertDescription>Select an agency first, then return to AI onboarding.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const questionIndex = lastResponse?.progress?.current_index ?? 1;
  const questionTotal = lastResponse?.progress?.total_required ?? 1;
  const isComplete = lastResponse?.onboarding_status.status === "complete";
  const requiredComplete = lastResponse?.progress?.required_complete ?? false;

  return (
    <div className="onboarding-topo min-h-screen p-8 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-white/60">AI-guided onboarding</div>
          <h1 className="mt-2 text-3xl font-semibold">Agency Profile Setup</h1>
          <p className="mt-2 text-sm text-white/60">
            Answer a few focused questions. This builds your agency brain automatically.
          </p>
        </div>

        <Card className="flex min-h-[640px] flex-col border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 text-xs uppercase tracking-[0.2em] text-white/50">
            <span>
              Required {questionIndex}/{questionTotal}
            </span>
            <span className="text-white/70">{isComplete ? "Required complete" : "In progress"}</span>
          </div>

          {error && (
            <div className="px-6 pt-4">
              <Alert variant="destructive">
                <AlertTitle>Turn failed</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>{error}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void retryLast()} className="ml-3">
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex-1 px-6 py-5">
            <div className="flex flex-col gap-4">
              {(messages.length === 0
                ? [
                    {
                      id: "initial-assistant",
                      role: "assistant" as const,
                      text: lastResponse?.assistant_message ?? "Loading...",
                    },
                  ]
                : messages.slice(-6)
              ).map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      message.role === "user"
                        ? "bg-primary/25 text-white"
                        : "bg-white/5 text-white/90"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                      {message.role === "user" ? "You" : "AI Cofounder"}
                    </div>
                    <div className="mt-1">{message.text}</div>
                  </div>
                </div>
              ))}

              {suggestions.length > 0 && (
                <div className="flex justify-start">
                  <div className="w-full max-w-[75%] rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                      AI Cofounder
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/50">
                      Suggested replies
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {suggestions.slice(0, 4).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          disabled={loading}
                          onClick={() => setDraftInput(suggestion)}
                          className="rounded-xl border border-white/10 bg-[#0b0f1a] px-3 py-2 text-left text-sm text-white/90 hover:border-primary/40 hover:bg-[#0f1524] disabled:opacity-60"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                      Tap to autofill
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {requiredComplete && !isComplete && (
            <div className="mx-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              Essential questions are complete. You can skip all remaining optional questions.
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-400/40 text-emerald-100"
                  disabled={loading}
                  onClick={() => void sendTurn("", "skip_all")}
                >
                  Skip all optional
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-white/10 px-6 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Your answer</div>
            <div className="mt-3">
              <AdaptiveInputField
                inputId="onboarding-input"
                value={draftInput}
                onChange={setDraftInput}
                expects={expects}
                disabled={loading}
                showSendButton={false}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70"
                  disabled={loading}
                  onClick={() => void sendTurn("", "undo")}
                >
                  Undo last answer
                </Button>
                {lastResponse?.can_skip ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70"
                    disabled={loading}
                    onClick={() => void sendTurn("", "skip")}
                  >
                    Skip optional
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70"
                  disabled={loading}
                  onClick={() => void sendTurn("I do not know", "input")}
                >
                  I do not know
                </Button>
              </div>
              <Button
                size="sm"
                disabled={loading || !draftInput.trim()}
                onClick={() => void sendTurn(draftInput, "input")}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
