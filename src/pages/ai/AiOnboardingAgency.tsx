import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CheckCircle2, Clipboard, Loader2, Mail, Pencil, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { useAuth } from "@/lib/auth";
import { AdaptiveInputField } from "@/components/onboarding-chat/AdaptiveInputField";
import type { OnboardingChatMessage, OnboardingTurnResponse } from "@/components/onboarding-chat/types";
import { QUESTION_BANK, REQUIRED_P0, isAnswered } from "@/ai/onboardingScript";
import { resolveSnapshotValue } from "@/ai/onboardingState";
import { track } from "@/lib/analytics";

const SESSION_PREFIX = "ai_onboarding_chat_agency_";
const PLACEHOLDER_PATTERN = /ready to begin onboarding/i;

type PersistedSession = {
  messages: OnboardingChatMessage[];
  draftInput: string;
  expects: string;
  suggestions: string[];
  lastResponse?: OnboardingTurnResponse;
  startedAtMs?: number;
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

function formatSnapshotValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.trim() || "-";
  if (Array.isArray(value)) {
    if (value.length === 0) return "-";
    return value.map((item) => String(item)).join(", ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "-";
    return entries.map(([k, v]) => `${k}: ${String(v)}`).join(", ");
  }
  return String(value);
}

function formatValueForEditor(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => String(item)).join("\n");
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.map(([key, entry]) => `${key}: ${String(entry)}`).join("\n");
  }
  return String(value);
}

function buildMemoryPatch(fieldPath: string, value: unknown) {
  const parts = fieldPath.split(".");
  if (parts.length === 1) return { [fieldPath]: value };
  const [root, ...rest] = parts;
  const patch: Record<string, unknown> = {};
  let cursor: Record<string, unknown> = {};
  patch[root] = cursor;
  for (let index = 0; index < rest.length - 1; index += 1) {
    const key = rest[index];
    cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[rest[rest.length - 1]] = value;
  return patch;
}

function hasPaidAdsInServiceCatalog(snapshot: Record<string, unknown>) {
  const value = resolveSnapshotValue(snapshot, "agency", "service_catalog");
  if (Array.isArray(value)) return value.some((item) => String(item).toLowerCase().includes("paid ads"));
  if (typeof value === "string") return value.toLowerCase().includes("paid ads");
  return false;
}

function isQuestionApplicable(question: (typeof QUESTION_BANK)[number], snapshot: Record<string, unknown>) {
  if (!question.condition) return true;
  if (question.condition === "requires_paid_ads") return hasPaidAdsInServiceCatalog(snapshot);
  return true;
}

export default function AiOnboardingAgency() {
  const navigate = useNavigate();
  const { user, session, loading: authLoading } = useAuth();
  const sessionExpiresAtMs = session?.expires_at ? session.expires_at * 1000 : null;
  const hasValidSession = session
    ? (!sessionExpiresAtMs || sessionExpiresAtMs > Date.now())
    : Boolean(user);
  const isAuthenticated = Boolean(user && hasValidSession);
  const { agencyId } = useAgency();

  const storageKey = useMemo(() => (agencyId ? `${SESSION_PREFIX}${agencyId}` : null), [agencyId]);
  const resumeUrl = useMemo(() => {
    if (typeof window === "undefined") return "/ai/onboarding/agency";
    return `${window.location.origin}/ai/onboarding/agency`;
  }, []);

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
  const [clientValidationError, setClientValidationError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [copiedResume, setCopiedResume] = useState(false);
  const [reviewStage, setReviewStage] = useState<"core" | "operations" | "advanced" | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number>(Date.now());
  const [editingQuestion, setEditingQuestion] = useState<(typeof QUESTION_BANK)[number] | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editValidationError, setEditValidationError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [dismissedCoreReview, setDismissedCoreReview] = useState(false);
  const [dismissedOperationsReview, setDismissedOperationsReview] = useState(false);
  const [dismissedAdvancedReview, setDismissedAdvancedReview] = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);

  const startedTrackedRef = useRef(false);
  const completedCoreTrackedRef = useRef(false);
  const activatedTrackedRef = useRef(false);
  const lastValidationEventRef = useRef<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const prevRequiredCompleteRef = useRef(false);
  const prevOperationsCompleteRef = useRef(false);
  const prevAdvancedCompleteRef = useRef(false);

  const currentQuestionMeta = useMemo(() => {
    const fieldPath = lastResponse?.field_path;
    if (!fieldPath) return null;
    return QUESTION_BANK.find((q) => q.field_path === fieldPath) ?? null;
  }, [lastResponse?.field_path]);

  const displayedSuggestions = useMemo(() => {
    if (suggestions.length > 0) return suggestions.slice(0, 4);

    const examplesFallback = (currentQuestionMeta?.examples ?? []).slice(0, 4);
    if (examplesFallback.length > 0) return examplesFallback;

    if (!currentQuestionMeta) {
      return [
        "Can you give me a concrete example answer?",
        "Skip this for now",
        "Let's continue to the next question",
      ];
    }

    const questionTitle = currentQuestionMeta.question_text.replace(/\.$/, "");
    return [
      `For ${questionTitle}: example #1`,
      `For ${questionTitle}: example #2`,
      "Skip for now",
    ];
  }, [suggestions, currentQuestionMeta]);

  const coreQuestions = REQUIRED_P0;
  const optionalQuestions = useMemo(
    () => QUESTION_BANK.filter((q) => q.priority === "P1" && !q.field_path.startsWith("operations.")),
    []
  );
  const operationsQuestions = useMemo(
    () => QUESTION_BANK.filter((q) => q.field_path.startsWith("operations.")),
    []
  );

  const snapshot = lastResponse?.brain_snapshot ?? {};

  const sectionProgress = useMemo(() => {
    const countComplete = (questions: typeof QUESTION_BANK) =>
      questions.filter((question) => isAnswered(snapshot, question.field_path)).length;
    const countTotal = (questions: typeof QUESTION_BANK) =>
      questions.filter((question) => isQuestionApplicable(question, snapshot)).length;

    return {
      core: { complete: countComplete(coreQuestions), total: countTotal(coreQuestions) },
      optional: { complete: countComplete(optionalQuestions), total: countTotal(optionalQuestions) },
      operations: { complete: countComplete(operationsQuestions), total: countTotal(operationsQuestions) },
    };
  }, [snapshot, coreQuestions, optionalQuestions, operationsQuestions]);

  const saveSession = () => {
    if (!storageKey || !sessionHydrated) return;
    const payload: PersistedSession = {
      messages,
      draftInput,
      expects,
      suggestions,
      lastResponse: lastResponse ?? undefined,
      startedAtMs,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
    setLastSavedAt(Date.now());
  };

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
          setStartedAtMs(parsed.startedAtMs ?? Date.now());
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
    setSessionHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !sessionHydrated) return;
    const timer = window.setInterval(() => {
      saveSession();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [storageKey, sessionHydrated, messages, draftInput, expects, suggestions, lastResponse, startedAtMs]);

  useEffect(() => {
    if (!storageKey || !sessionHydrated) return;
    const onBeforeUnload = () => saveSession();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [storageKey, sessionHydrated, messages, draftInput, expects, suggestions, lastResponse, startedAtMs]);

  useEffect(() => {
    if (!clientValidationError) {
      lastValidationEventRef.current = null;
      return;
    }

    const fieldPath = lastResponse?.field_path ?? "unknown";
    const key = `${fieldPath}:${clientValidationError}`;
    if (lastValidationEventRef.current === key) return;

    track("onboarding_validation_failed", {
      field_path: fieldPath,
      error_message: clientValidationError,
      error_code: currentQuestionMeta?.error_code ?? "CLIENT_VALIDATION",
    });
    lastValidationEventRef.current = key;
  }, [clientValidationError, lastResponse?.field_path, currentQuestionMeta?.error_code]);

  useEffect(() => {
    if (!lastResponse || startedTrackedRef.current) return;
    startedTrackedRef.current = true;
    track("onboarding_started", {
      onboarding_status_id: lastResponse.onboarding_status.id,
      scope: lastResponse.onboarding_status.scope,
    });
  }, [lastResponse]);

  useEffect(() => {
    if (!lastResponse) return;
    if (!lastResponse.question_id && !lastResponse.field_path) return;
    track("onboarding_question_viewed", {
      question_id: lastResponse.question_id ?? null,
      field_path: lastResponse.field_path ?? null,
      priority: lastResponse.priority ?? null,
    });
  }, [lastResponse?.question_id, lastResponse?.field_path, lastResponse?.priority]);

  useEffect(() => {
    if (!lastResponse?.progress?.required_complete || completedCoreTrackedRef.current) return;
    completedCoreTrackedRef.current = true;
    track("onboarding_completed_core", {
      required_complete: true,
      current_index: lastResponse.progress.current_index,
      total_required: lastResponse.progress.total_required,
    });
  }, [lastResponse?.progress?.required_complete, lastResponse?.progress?.current_index, lastResponse?.progress?.total_required]);

  useEffect(() => {
    const requiredNowComplete = Boolean(lastResponse?.progress?.required_complete);
    const operationsNowComplete = requiredNowComplete && sectionProgress.operations.total > 0
      ? sectionProgress.operations.complete >= sectionProgress.operations.total
      : false;
    const advancedNowComplete = requiredNowComplete && sectionProgress.optional.total > 0
      ? sectionProgress.optional.complete >= sectionProgress.optional.total
      : false;

    if (requiredNowComplete && !prevRequiredCompleteRef.current && !dismissedCoreReview) {
      setReviewStage("core");
    } else if (operationsNowComplete && !prevOperationsCompleteRef.current && !dismissedOperationsReview) {
      setReviewStage("operations");
    } else if (advancedNowComplete && !prevAdvancedCompleteRef.current && !dismissedAdvancedReview) {
      setReviewStage("advanced");
    }

    prevRequiredCompleteRef.current = requiredNowComplete;
    prevOperationsCompleteRef.current = operationsNowComplete;
    prevAdvancedCompleteRef.current = advancedNowComplete;
  }, [
    lastResponse?.progress?.required_complete,
    sectionProgress.operations.complete,
    sectionProgress.operations.total,
    sectionProgress.optional.complete,
    sectionProgress.optional.total,
    dismissedCoreReview,
    dismissedOperationsReview,
    dismissedAdvancedReview,
  ]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!lastResponse || lastResponse.onboarding_status.status === "complete") return;
      track("onboarding_abandoned", {
        last_field_path: lastResponse.field_path ?? null,
        elapsed_s: Math.round((Date.now() - startedAtMs) / 1000),
      });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [lastResponse, startedAtMs]);

  useEffect(() => {
    if (chatBottomRef.current && typeof chatBottomRef.current.scrollIntoView === "function") {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading, suggestions]);

  const sendTurn = async (
    input: string,
    mode: "input" | "chip_fill" | "skip" | "skip_all" | "undo" = "input"
  ) => {
    if (!agencyId) return;
    const trimmed = input.trim();
    if (!trimmed && mode !== "skip" && mode !== "skip_all" && mode !== "undo") return;
    if (
      mode === "input" &&
      isComplete &&
      /review my answer(s)?/i.test(trimmed)
    ) {
      if (sectionProgress.optional.total > 0) {
        setReviewStage("advanced");
      } else if (sectionProgress.operations.total > 0) {
        setReviewStage("operations");
      } else {
        setReviewStage("core");
      }
      return;
    }

    if (mode === "input" && clientValidationError) return;

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
      track("onboarding_answer_submitted", {
        field_path: lastResponse?.field_path ?? null,
        input_type: lastResponse?.input_type ?? expects,
        chars: trimmed.length,
        mode,
      });

      const userMessage = createMessage("user", trimmed);
      setMessages((prev) => [...prev, userMessage]);
      setDraftInput("");
      setClientValidationError(null);
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

    saveSession();
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

    saveSession();
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

    saveSession();
  };

  const handleCopyResume = async () => {
    try {
      await navigator.clipboard.writeText(resumeUrl);
      setCopiedResume(true);
      setTimeout(() => setCopiedResume(false), 1200);
    } catch {
      setCopiedResume(false);
    }
  };

  const handleEmailResume = () => {
    const subject = encodeURIComponent("Resume Agency AI Onboarding");
    const body = encodeURIComponent(`Use this link to resume your onboarding: ${resumeUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleActivateWorkspace = () => {
    if (!lastResponse || activatedTrackedRef.current) {
      navigate("/agency/welcome-ai", { replace: true });
      return;
    }

    activatedTrackedRef.current = true;
    track("onboarding_activated_workspace", {
      onboarding_status_id: lastResponse.onboarding_status.id,
      required_complete: lastResponse.progress?.required_complete ?? false,
      elapsed_s: Math.round((Date.now() - startedAtMs) / 1000),
    });
    navigate("/agency/welcome-ai", { replace: true });
  };

  const openEditorForQuestion = (question: (typeof QUESTION_BANK)[number]) => {
    const { module, path } = question.field_path.includes(".")
      ? { module: question.field_path.split(".")[0], path: question.field_path.split(".").slice(1).join(".") }
      : { module: "agency", path: question.field_path };
    const currentValue = resolveSnapshotValue(snapshot, module, path);
    setEditingQuestion(question);
    setEditingValue(formatValueForEditor(currentValue));
    setEditValidationError(null);
    setEditError(null);
    track("onboarding_review_opened", { field_path: question.field_path });
  };

  const submitReviewEdit = async () => {
    if (!editingQuestion || !agencyId) return;
    if (!editingValue.trim() || editValidationError) return;

    setSavingEdit(true);
    setEditError(null);

    const payload = {
      agency_id: agencyId,
      scope: "agency",
      client_turn_id: createTurnId(),
      memory_patch: buildMemoryPatch(editingQuestion.field_path, editingValue.trim()),
      metadata: {
        review_edit: true,
        edited_field: editingQuestion.field_path,
      },
    };

    const { data, error: invokeError } = await supabase.functions.invoke("ai-onboarding", {
      body: payload,
    });

    setSavingEdit(false);

    if (invokeError || !data) {
      setEditError(invokeError?.message ?? "Failed to save field update.");
      return;
    }

    const response = data as OnboardingTurnResponse;
    setLastResponse(response);
    setExpects(response.expects || "text");
    setSuggestions(response.suggestions ?? []);
    setEditingQuestion(null);
    setEditingValue("");
    setReviewStage((current) => current ?? "core");
    saveSession();

    track("onboarding_review_edited", {
      field_path: payload.metadata.edited_field,
      required_complete: response.progress?.required_complete ?? false,
    });
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

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
  const questionTotal = lastResponse?.progress?.total_required ?? coreQuestions.length;
  const isComplete = lastResponse?.onboarding_status.status === "complete";
  const requiredComplete = lastResponse?.progress?.required_complete ?? false;
  const isReviewing = reviewStage !== null;
  const reviewQuestions =
    reviewStage === "operations" ? operationsQuestions : reviewStage === "advanced" ? optionalQuestions : coreQuestions;
  const reviewTitle =
    reviewStage === "operations"
      ? "Operations setup complete"
      : reviewStage === "advanced"
      ? "Optional: Advanced setup complete"
      : "Core onboarding complete";
  const reviewDescription =
    reviewStage === "operations"
      ? "Review your operations answers below, then continue into Optional: Advanced."
      : reviewStage === "advanced"
      ? "Review your Optional: Advanced answers below, then activate your workspace."
      : "Review your required setup below, then continue to operations.";
  const composerExpanded = isComposerFocused || draftInput.trim().length > 0;

  return (
    <div className="onboarding-topo h-[100dvh] overflow-hidden px-3 py-3 text-white md:px-4 md:py-4">
      <div className="mx-auto h-full w-full max-w-[1240px] px-2 md:px-5 lg:px-10">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden border-white/10 bg-black/45 backdrop-blur-sm">
          <div className="border-b border-white/10 px-3 py-1 md:px-5 md:py-1.5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/55 md:text-xs md:tracking-[0.26em]">AI-guided onboarding</div>
            <div className="mt-0.5 flex flex-wrap items-center justify-between gap-1.5">
              <h1 className="text-lg font-semibold md:text-xl">Agency Profile Setup</h1>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/60 md:text-[11px]">Required {questionIndex}/{questionTotal}</div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] md:gap-1.5 md:text-[11px]">
              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-white/80 md:px-2.5">
                Core {sectionProgress.core.complete}/{sectionProgress.core.total}
              </span>
              <span className={`rounded-full border px-2 py-0.5 md:px-2.5 ${requiredComplete ? "border-white/15 bg-white/5 text-white/80" : "border-white/10 text-white/55"}`}>
                Ops {sectionProgress.operations.complete}/{sectionProgress.operations.total}
              </span>
              <span className={`rounded-full border px-2 py-0.5 md:px-2.5 ${requiredComplete ? "border-white/15 bg-white/5 text-white/80" : "border-white/10 text-white/55"}`}>
                Adv {sectionProgress.optional.complete}/{sectionProgress.optional.total}
              </span>
              <span className="ml-auto hidden text-white/55 sm:inline">
                {lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "Autosaves every 10s"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="outline" className="h-5 px-2 text-[10px] md:h-6 md:px-3 md:text-[11px]" onClick={handleCopyResume}>
                <Clipboard className="mr-1 h-3.5 w-3.5" />
                {copiedResume ? "Copied" : "Copy resume link"}
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-5 px-2 text-[10px] md:h-6 md:px-3 md:text-[11px]" onClick={handleEmailResume}>
                <Mail className="mr-1 h-3.5 w-3.5" />
                Email link
              </Button>
            </div>
          </div>

          {error && (
            <div className="px-6 pt-4">
              <Alert variant="destructive">
                <AlertTitle>Turn failed</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-2">
                  <span>{error}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void retryLast()}>
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex-1 min-h-0 px-3 py-2 md:px-4 md:py-2.5">
            {isReviewing ? (
              <ScrollArea className="h-full pr-2">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-2 text-emerald-200">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-semibold">{reviewTitle}</span>
                    </div>
                    <p className="mt-2 text-sm text-emerald-100/90">{reviewDescription}</p>
                  </div>

                  {editingQuestion ? (
                    <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-cyan-200">Editing {editingQuestion.field_path}</div>
                      <div className="mt-2 text-sm text-cyan-100">{editingQuestion.question_text}</div>
                      <div className="mt-3">
                        <AdaptiveInputField
                          inputId="review-edit-input"
                          value={editingValue}
                          onChange={setEditingValue}
                          expects={editingQuestion.input_type}
                          onSubmit={() => void submitReviewEdit()}
                          loading={savingEdit}
                          showMeta={false}
                          showSendButton={false}
                          fieldPath={editingQuestion.field_path}
                          validationRule={editingQuestion.validation_rule}
                          validationCode={editingQuestion.error_code}
                          validationHelp={editingQuestion.help_text}
                          validationExample={editingQuestion.examples?.[0]}
                          onValidationChange={setEditValidationError}
                        />
                      </div>
                      {editError ? <div className="mt-2 text-xs text-red-300">{editError}</div> : null}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingQuestion(null);
                            setEditingValue("");
                            setEditError(null);
                            setEditValidationError(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          disabled={savingEdit || !editingValue.trim() || Boolean(editValidationError)}
                          onClick={() => void submitReviewEdit()}
                        >
                          {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save update"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3">
                    {reviewQuestions.filter((question) => isQuestionApplicable(question, snapshot)).map((question) => {
                      const { module, path } = question.field_path.includes(".")
                        ? { module: question.field_path.split(".")[0], path: question.field_path.split(".").slice(1).join(".") }
                        : { module: "agency", path: question.field_path };
                      const value = resolveSnapshotValue(snapshot, module, path);
                      return (
                        <div key={question.field_path} className="group relative rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-white/50">{question.field_path}</div>
                          <div className="mt-1 text-sm text-white/90">{formatSnapshotValue(value)}</div>
                          <button
                            type="button"
                            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-black/40 text-white/80 opacity-0 transition-opacity hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={() => openEditorForQuestion(question)}
                            aria-label={`Edit ${question.field_path}`}
                            title={`Edit ${question.field_path}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <ScrollArea className="h-full pr-2">
                <div className="space-y-2">
                  {(messages.length === 0
                    ? [
                        {
                          id: "initial-assistant",
                          role: "assistant" as const,
                          text: lastResponse?.assistant_message ?? "Loading...",
                        },
                      ]
                    : messages.slice(-20)
                  ).map((message) => (
                    <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[92%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
                          message.role === "user"
                            ? "border border-primary/40 bg-primary/30 text-white"
                            : "border border-white/10 bg-white/5 text-white/90"
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">{message.role === "user" ? "You" : "AI Assistant"}</div>
                        <div className="mt-1 whitespace-pre-wrap">{message.text}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
              </ScrollArea>
            )}
          </div>

          {isReviewing ? (
            <div className="border-t border-white/10 px-6 py-4">
              <div className="flex flex-wrap justify-end gap-2">
                {reviewStage === "core" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDismissedCoreReview(true);
                      setReviewStage(null);
                    }}
                  >
                    Continue Operations
                  </Button>
                ) : null}
                {reviewStage === "operations" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDismissedOperationsReview(true);
                      setReviewStage(null);
                    }}
                  >
                    Continue Optional: Advanced
                  </Button>
                ) : null}
                {reviewStage === "advanced" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDismissedAdvancedReview(true);
                      setReviewStage(null);
                    }}
                  >
                    Back to chat
                  </Button>
                ) : null}
                <Button onClick={handleActivateWorkspace}>Activate Agency Workspace</Button>
              </div>
            </div>
          ) : (
            <div className="border-t border-white/10 px-2 py-1 md:px-4 md:py-1.5">
              {displayedSuggestions.length > 0 && !isComplete ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-0.5 md:p-1">
                  <div className="mb-0.5 text-[9px] uppercase tracking-[0.14em] text-white/50 md:text-[10px] md:tracking-[0.18em]">Tap to autofill</div>
                  <div className="flex gap-1 overflow-x-auto pb-0.5">
                    {displayedSuggestions.map((suggestion) => (
                      <div key={suggestion} className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/25 p-0.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-[22px] shrink-0 max-w-[320px] justify-start truncate px-2 text-xs text-white/85 hover:text-white"
                          disabled={loading}
                          onClick={() => {
                            track("onboarding_suggestion_used", {
                              field_path: lastResponse?.field_path ?? null,
                              mode: "autofill",
                            });
                            setDraftInput(suggestion);
                          }}
                        >
                          {suggestion}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-1 rounded-xl border border-white/10 bg-black/20 p-1">
                <Textarea
                  id="onboarding-input"
                  value={draftInput}
                  onChange={(event) => setDraftInput(event.target.value)}
                  placeholder="Type your answer..."
                  onFocus={() => setIsComposerFocused(true)}
                  onBlur={() => setIsComposerFocused(false)}
                  className={`resize-none border-0 bg-transparent px-2 py-1 text-white placeholder:text-white/40 focus-visible:ring-0 transition-all duration-200 ${
                    composerExpanded ? "min-h-[56px]" : "min-h-[30px]"
                  }`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (draftInput.trim().length > 0 && !loading) {
                        void sendTurn(draftInput, "input");
                      }
                    }
                  }}
                />
                <div className="mt-1 flex items-center justify-between">
                  <div className="hidden text-[11px] text-white/50 sm:block">Enter to send, Shift+Enter new line.</div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2.5 md:px-3"
                    disabled={loading || draftInput.trim().length === 0}
                    onClick={() => void sendTurn(draftInput, "input")}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                    Send
                  </Button>
                </div>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-white/50">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-white/70"
                    disabled={loading}
                    onClick={() => void sendTurn("", "undo")}
                  >
                    Undo last answer
                  </Button>
                  {lastResponse?.can_skip ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-white/70"
                      disabled={loading}
                      onClick={() => void sendTurn("", "skip")}
                    >
                      Skip optional
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-white/70"
                    disabled={loading}
                    onClick={() => void sendTurn("I do not know", "input")}
                  >
                    I do not know
                  </Button>
                </div>
              </div>

              {requiredComplete ? (
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-400/40 text-emerald-100"
                    onClick={handleActivateWorkspace}
                  >
                    Finish onboarding now
                  </Button>
                </div>
              ) : null}

              {requiredComplete && !isComplete ? (
                <div className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                  Core is complete. Continue with Operations first, then Optional: Advanced.
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-400/40 text-emerald-100"
                      disabled={loading}
                      onClick={() => void sendTurn("", "skip_all")}
                    >
                      Skip all remaining
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
