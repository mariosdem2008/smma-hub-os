import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getActiveAgencyId } from "@/lib/active-agency";
import { MultiSelect, type MultiSelectOption } from "@/components/ai/MultiSelect";
import { TagSelector, type TagOption } from "@/components/ai/TagSelector";
import { validateValue, validateTextLength, type ValidationRule } from "@/lib/validation";

type ThreadRow = { id: string; title: string; created_at: string; kind?: string | null };
type Suggestion = { id: string; label: string; user_message: string };
type MessageRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  suggestions?: Suggestion[];
  questionKey?: string;
};
type AiJobRow = {
  id: string;
  client_id: string;
  job_type: string;
  status: string;
  attempts: number;
  run_after: string;
  last_error: string | null;
  created_at: string;
};

type SetupQuestionMetadata = {
  key: string;
  inputType?: "text" | "multiselect" | "dropdown" | "tags";
  options?: Array<{ id: string; label: string; value: string; description?: string }>;
  validation?: ValidationRule;
  skipAiExtraction?: boolean;
};

type SetupMeta = {
  stepId: string;
  progressPercent: number;
  done?: boolean;
  choices?: Array<{ id: string; label: string }>;
  questionMeta?: SetupQuestionMetadata;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function isStreamingEnabled() {
  return !(globalThis as any).__SMMAHUB_STREAMING_DISABLED__;
}

// Question metadata for structured inputs (Phase 1 improvements)
const SETUP_QUESTION_METADATA: Record<string, SetupQuestionMetadata> = {
  "agency.primary_services": {
    key: "agency.primary_services",
    inputType: "multiselect",
    skipAiExtraction: true,
    validation: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      errorMessages: {
        minItems: "Please select at least 3 services to help me understand your core offerings.",
        maxItems: "Please select no more than 6 services to keep your positioning focused.",
        required: "I need to know your primary services to set up your agency profile.",
      },
    },
    options: [
      { id: "smm", label: "Social Media Management", value: "Social media management", description: "Monthly social media management retainer" },
      { id: "content", label: "Content Creation", value: "Content creation", description: "Reels, Posts, Stories, Videos" },
      { id: "ads", label: "Paid Ads", value: "Paid ads management", description: "Meta Ads, Google Ads, TikTok Ads" },
      { id: "lead_gen", label: "Lead Generation", value: "Lead generation", description: "DM outreach, booking systems" },
      { id: "ugc", label: "UGC Sourcing", value: "UGC sourcing + editing", description: "User-generated content curation" },
      { id: "strategy", label: "Strategy Consulting", value: "Strategy consulting", description: "Social media strategy and planning" },
      { id: "design", label: "Graphic Design", value: "Graphic design", description: "Brand design, graphics, visuals" },
      { id: "video", label: "Video Production", value: "Video production", description: "Professional video creation" },
    ],
  },
  "agency.niche_industries": {
    key: "agency.niche_industries",
    inputType: "multiselect",
    skipAiExtraction: true,
    validation: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      errorMessages: {
        minItems: "Please select at least 1 niche to help me understand your target market.",
        maxItems: "Please select no more than 3 niches to maintain your positioning clarity.",
        required: "I need to know your target niches to tailor your agency brain.",
      },
    },
    options: [
      { id: "realestate", label: "Real Estate", value: "Real estate", description: "Agents, brokers, property management" },
      { id: "ecommerce", label: "E-commerce", value: "Ecommerce", description: "Online stores, product brands" },
      { id: "local_services", label: "Local Services", value: "Local services", description: "Restaurants, salons, home services" },
      { id: "coaches", label: "Coaches & Consultants", value: "Coaches/consultants", description: "Business coaches, life coaches, consultants" },
      { id: "saas", label: "SaaS", value: "SaaS", description: "Software companies, tech startups" },
      { id: "fitness", label: "Fitness & Wellness", value: "Fitness", description: "Gyms, trainers, wellness brands" },
      { id: "healthcare", label: "Healthcare", value: "Healthcare", description: "Medical practices, clinics, dentists" },
      { id: "finance", label: "Finance & Insurance", value: "Finance", description: "Financial advisors, insurance agencies" },
      { id: "hospitality", label: "Hospitality", value: "Hospitality", description: "Hotels, restaurants, tourism" },
      { id: "other", label: "Other", value: "Other", description: "Describe your niche" },
    ],
  },
  "brand.voice_adjectives": {
    key: "brand.voice_adjectives",
    inputType: "tags",
    skipAiExtraction: true,
    validation: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      errorMessages: {
        minItems: "Please select exactly 3 adjectives to define your brand voice.",
        maxItems: "Please select exactly 3 adjectives to keep your voice consistent.",
        required: "I need to know your brand voice to communicate like you.",
      },
    },
    options: [
      { id: "bold", label: "Bold", value: "Bold", description: "Confident, assertive, direct" },
      { id: "friendly", label: "Friendly", value: "Friendly", description: "Warm, approachable, helpful" },
      { id: "professional", label: "Professional", value: "Professional", description: "Polished, formal, expert" },
      { id: "premium", label: "Premium", value: "Premium", description: "High-end, sophisticated, exclusive" },
      { id: "creative", label: "Creative", value: "Creative", description: "Innovative, artistic, imaginative" },
      { id: "data_driven", label: "Data-Driven", value: "Data-driven", description: "Analytical, metrics-focused" },
      { id: "conversational", label: "Conversational", value: "Conversational", description: "Casual, relatable, down-to-earth" },
      { id: "authoritative", label: "Authoritative", value: "Authoritative", description: "Expert, credible, knowledgeable" },
      { id: "playful", label: "Playful", value: "Playful", description: "Fun, lighthearted, energetic" },
      { id: "empathetic", label: "Empathetic", value: "Empathetic", description: "Understanding, supportive, caring" },
    ],
  },
};

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
  const [aiJobs, setAiJobs] = useState<AiJobRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const streamingAbortRef = useRef<AbortController | null>(null);

  // Structured input state (Phase 1)
  const [structuredValue, setStructuredValue] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [closingStructuredQuestion, setClosingStructuredQuestion] = useState<string | null>(null);

  // Edit functionality state (Phase 2)
  const [editingQuestionKey, setEditingQuestionKey] = useState<string | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Map<string, { answer: string; displayText: string }>>(
    new Map(),
  );

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

  const loadJobs = useCallback(async (nextAgencyId: string) => {
    setLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from("ai_jobs")
        .select("id,client_id,job_type,status,attempts,run_after,last_error,created_at")
        .eq("agency_id", nextAgencyId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      setAiJobs((data ?? []) as AiJobRow[]);
    } catch (err: any) {
      toast({
        title: "Failed to load AI jobs",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingJobs(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!agencyId) return;
    loadJobs(agencyId);
  }, [agencyId, loadJobs]);

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
            const stepId = (data?.step_id as string | undefined) ?? "guided_setup";

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: assistant,
                      suggestions: Array.isArray(data?.suggestions) ? (data.suggestions as Suggestion[]) : [],
                      questionKey: stepId, // Store question key for edit functionality
                    }
                  : msg,
              ),
            );

            setPrimedSetupThreadId(threadId);
            if (typeof data?.progress_percent === "number" || typeof data?.done === "boolean" || data?.step_id) {
              const questionMeta = SETUP_QUESTION_METADATA[stepId] ?? undefined;

              setSetupMeta({
                stepId,
                progressPercent: Number(data.progress_percent ?? 0),
                choices: (data.choices as SetupMeta["choices"]) ?? [],
                done: Boolean(data.done),
                questionMeta,
              });

              // Reset structured input state for new question
              setStructuredValue([]);
              setValidationError(null);
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
    async (nextText?: string, structuredData?: { value: string[] }) => {
      // Determine if this is a structured input or text input
      const isStructuredInput = Boolean(structuredData);
      const text = isStructuredInput ? "" : (nextText ?? input).trim();

      if (!isStructuredInput && !text) return;
      if (sending) return;

      // Validate structured inputs before sending
      if (isStructuredInput && setupMeta?.questionMeta) {
        const { questionMeta } = setupMeta;
        const validation = validateValue(structuredData?.value ?? [], questionMeta.validation);

        if (!validation.valid) {
          setValidationError(validation.error ?? "Validation failed");
          return;
        }
      }

      if (isStructuredInput) {
        const closingKey = editingQuestionKey ?? setupMeta?.stepId ?? null;
        if (closingKey) setClosingStructuredQuestion(closingKey);
      }

      setSending(true);
      setInput("");
      setValidationError(null);

      // Prepare the message to send
      const messageToSend = isStructuredInput
        ? JSON.stringify({ value: structuredData?.value ?? [] })
        : text;

      // Display message for user (show selected labels for structured inputs)
      const displayContent = isStructuredInput
        ? structuredData?.value.join(", ") ?? ""
        : text;

      const optimisticUserMsg: MessageRow = {
        id: `tmp-user-${Date.now()}`,
        role: "user",
        content: displayContent,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);

      // Track answered question (Phase 2 Edit Functionality)
      if (isSetupActive && setupMeta?.stepId && !editingQuestionKey) {
        setAnsweredQuestions((prev) => {
          const updated = new Map(prev);
          updated.set(setupMeta.stepId, {
            answer: messageToSend,
            displayText: displayContent,
          });
          return updated;
        });
      } else if (editingQuestionKey) {
        // Update existing answer if editing
        setAnsweredQuestions((prev) => {
          const updated = new Map(prev);
          updated.set(editingQuestionKey, {
            answer: messageToSend,
            displayText: displayContent,
          });
          return updated;
        });
        setEditingQuestionKey(null);
      }

      try {
        const next = await streamAgencyAdminChat({
          payload: { thread_id: activeThreadId ?? undefined, message: messageToSend },
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
            const stepId = (data?.step_id as string | undefined) ?? "guided_setup";

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
                      questionKey: stepId, // Store question key for edit functionality
                    }
                  : msg,
              ),
            );

            const resolvedThreadId = nextThreadId ?? activeThreadId;
            if (setupThread?.id && resolvedThreadId === setupThread.id) {
              const questionMeta = SETUP_QUESTION_METADATA[stepId] ?? undefined;

              setSetupMeta({
                stepId,
                progressPercent: Number(data.progress_percent ?? 0),
                choices: (data.choices as SetupMeta["choices"]) ?? [],
                done: Boolean(data.done),
                questionMeta,
              });

              // Reset structured input state for new question (unless in edit mode)
              if (!editingQuestionKey) {
                setStructuredValue([]);
                setValidationError(null);
              }
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
    [activeThreadId, agencyId, editingQuestionKey, input, loadThreads, sending, setupMeta, setupThread?.id, toast],
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

  // Handle edit button click (Phase 2 Edit Functionality)
  const handleEditQuestion = useCallback(
    (questionKey: string) => {
      const previousAnswer = answeredQuestions.get(questionKey);
      if (!previousAnswer) return;

      setEditingQuestionKey(questionKey);

      // Pre-fill input based on answer type
      try {
        const parsed = JSON.parse(previousAnswer.answer);
        if (parsed.value && Array.isArray(parsed.value)) {
          // Structured input (array)
          setStructuredValue(parsed.value);
          setInput("");
        } else {
          // Text input
          setStructuredValue([]);
          setInput(previousAnswer.answer);
        }
      } catch {
        // Plain text answer
        setStructuredValue([]);
        setInput(previousAnswer.answer);
      }
    },
    [answeredQuestions],
  );

  // Cancel edit mode (Phase 2 Edit Functionality)
  const handleCancelEdit = useCallback(() => {
    setEditingQuestionKey(null);
    setInput("");
    setStructuredValue([]);
    setValidationError(null);
  }, []);

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

  const activeQuestionMeta = editingQuestionKey
    ? SETUP_QUESTION_METADATA[editingQuestionKey]
    : setupMeta?.questionMeta;
  const activeQuestionKey = editingQuestionKey ?? setupMeta?.stepId ?? activeQuestionMeta?.key ?? null;
  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.role === "assistant") return msg;
    }
    return null;
  }, [messages]);
  const activeQuestionTitle = useMemo(() => {
    if (editingQuestionKey) {
      const match = messages.find((msg) => msg.role === "assistant" && msg.questionKey === editingQuestionKey);
      return match?.content ?? "";
    }
    return latestAssistantMessage?.content ?? "";
  }, [editingQuestionKey, latestAssistantMessage, messages]);
  const isStructuredInputActive =
    isSetupActive &&
    activeQuestionMeta &&
    (activeQuestionMeta.inputType === "multiselect" || activeQuestionMeta.inputType === "tags");
  const isStructuredClosing = Boolean(activeQuestionKey && closingStructuredQuestion === activeQuestionKey);

  useEffect(() => {
    if (!activeQuestionKey) return;
    setClosingStructuredQuestion(null);
  }, [activeQuestionKey]);

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
          <div className="mb-3 rounded-2xl border bg-background/70 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">AI Job Queue</div>
                <div className="text-xs text-muted-foreground">
                  Latest job status and errors for background automation.
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => agencyId && loadJobs(agencyId)}
                disabled={loadingJobs || !agencyId}
              >
                {loadingJobs ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
            <div className="mt-3 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-2 pr-3 font-medium">Job</th>
                    <th className="py-2 pr-3 font-medium">Client</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Attempts</th>
                    <th className="py-2 pr-3 font-medium">Run after</th>
                    <th className="py-2 font-medium">Last error</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingJobs ? (
                    <tr>
                      <td className="py-2 text-muted-foreground" colSpan={6}>
                        Loading jobs...
                      </td>
                    </tr>
                  ) : aiJobs.length === 0 ? (
                    <tr>
                      <td className="py-2 text-muted-foreground" colSpan={6}>
                        No jobs yet.
                      </td>
                    </tr>
                  ) : (
                    aiJobs.map((job) => (
                      <tr key={job.id} className="border-t border-border/40">
                        <td className="py-2 pr-3 font-medium">{job.job_type}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{job.client_id}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
                              job.status === "succeeded" && "bg-emerald-500/10 text-emerald-400",
                              job.status === "failed" && "bg-red-500/10 text-red-400",
                              job.status === "running" && "bg-blue-500/10 text-blue-400",
                              job.status === "pending" && "bg-amber-500/10 text-amber-400",
                            )}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{job.attempts}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {job.run_after ? new Date(job.run_after).toLocaleString() : "—"}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {job.last_error ? job.last_error : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Setup progress indicator */}
          {isSetupActive && setupMeta && !setupMeta.done ? (
            <div className="mb-3 rounded-2xl border bg-background/70 p-3 backdrop-blur">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Setup Progress</span>
                <span className="text-muted-foreground">{setupMeta.progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-[#4E5DFF] to-[#6A73FF] transition-all duration-500"
                  style={{ width: `${setupMeta.progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="flex-1 overflow-auto rounded-2xl border bg-background p-6 shadow-sm">
            {loadingMessages ? (
              <div className="text-sm text-muted-foreground">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Start a new chat or select one from the left.
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m, idx) => {
                  // Check if this question has been answered (Phase 2 Edit Functionality)
                  const hasBeenAnswered =
                    isSetupActive &&
                    m.role === "assistant" &&
                    m.questionKey &&
                    answeredQuestions.has(m.questionKey) &&
                    // Only show Edit button if it's not the current question
                    idx < messages.length - 1;

                  return (
                    <div key={m.id} className="space-y-2">
                      <div className="flex items-start gap-2">
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
                        {/* Edit button for answered questions (Phase 2) */}
                        {hasBeenAnswered && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditQuestion(m.questionKey!)}
                            disabled={sending || editingQuestionKey !== null}
                            className="mt-1 h-8 shrink-0 text-xs"
                            title="Edit your answer"
                          >
                            Edit
                          </Button>
                        )}
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
                  );
                })}
                {isStructuredInputActive && activeQuestionMeta ? (
                  <div
                    className={cn(
                      "mr-auto w-full max-w-[80%] origin-top overflow-hidden transition-all duration-300 ease-out",
                      isStructuredClosing
                        ? "max-h-0 -translate-y-2 scale-95 opacity-0 pointer-events-none"
                        : "max-h-[1200px] translate-y-0 scale-100 opacity-100",
                    )}
                  >
                    <div className="rounded-2xl border bg-muted/70 p-4 shadow-sm">
                      {activeQuestionMeta.inputType === "multiselect" ? (
                        <MultiSelect
                          title={activeQuestionTitle || "Select your options"}
                          options={(activeQuestionMeta.options as MultiSelectOption[]) ?? []}
                          value={structuredValue}
                          onChange={setStructuredValue}
                          validation={activeQuestionMeta.validation}
                          error={validationError}
                          disabled={sending}
                        />
                      ) : (
                        <div className="space-y-3">
                          {activeQuestionTitle ? (
                            <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-slate-100">
                              {activeQuestionTitle}
                            </div>
                          ) : null}
                          <TagSelector
                            options={(activeQuestionMeta.options as TagOption[]) ?? []}
                            value={structuredValue}
                            onChange={setStructuredValue}
                            validation={activeQuestionMeta.validation}
                            error={validationError}
                            disabled={sending}
                          />
                        </div>
                      )}
                      <Button
                        onClick={() => sendUserMessage(undefined, { value: structuredValue })}
                        disabled={sending || structuredValue.length === 0}
                        className="mt-4 w-full"
                      >
                        {editingQuestionKey ? "Update Answer" : "Submit"}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {sending ? (
                  <div className="mr-auto w-fit max-w-[80%] rounded-2xl bg-muted px-4 py-3 text-base text-foreground">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Edit mode indicator (Phase 2 Edit Functionality) */}
          {editingQuestionKey ? (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-amber-400">✏️</span>
                <span className="font-medium text-amber-300">Editing your previous answer</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-7 text-xs">
                Cancel Edit
              </Button>
            </div>
          ) : null}

          {isSetupActive && setupMeta?.choices && setupMeta.choices.length > 0 && !editingQuestionKey ? (
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

          {!isStructuredInputActive ? (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <textarea
                  className="min-h-[60px] w-full rounded-2xl border border-input bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message the agency AI"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendUserMessage();
                    }
                  }}
                />
                <Button onClick={() => sendUserMessage()} disabled={sending || input.trim().length === 0} className="px-6">
                  {editingQuestionKey ? "Update Answer" : "Send"}
                </Button>
              </div>

              {/* Real-time validation hint for text inputs with validation rules */}
              {(() => {
                const activeQuestionMeta = editingQuestionKey
                  ? SETUP_QUESTION_METADATA[editingQuestionKey]
                  : setupMeta?.questionMeta;

                if (!isSetupActive || !activeQuestionMeta?.validation || activeQuestionMeta.validation.type !== "string") {
                  return null;
                }

                const { minLength, maxLength } = activeQuestionMeta.validation;
                const currentLength = input.trim().length;
                const { error, remaining } = validateTextLength(input, minLength, maxLength);

                // Determine if validation passes
                const isValid = !error && currentLength >= (minLength ?? 0);
                const hasContent = currentLength > 0;

                return (
                  <div
                    className={cn(
                      "text-xs font-medium transition-colors",
                      isValid && hasContent ? "text-emerald-500" : "text-muted-foreground",
                    )}
                  >
                    {maxLength !== undefined && (
                      <span>
                        {error ? (
                          <span className="text-red-400">{error}</span>
                        ) : (
                          <>
                            <span className="font-semibold">{currentLength}</span> / {maxLength} characters
                            {remaining !== undefined && remaining <= 20 && remaining > 0 && (
                              <span className="ml-2 text-amber-400">({remaining} remaining)</span>
                            )}
                          </>
                        )}
                      </span>
                    )}
                    {minLength !== undefined && !maxLength && (
                      <span>
                        {currentLength < minLength ? (
                          <span className="text-amber-400">
                            At least {minLength} characters required (<span className="font-semibold">{currentLength}</span>/{minLength})
                          </span>
                        ) : (
                          <span className="font-semibold">{currentLength} characters</span>
                        )}
                      </span>
                    )}
                    {isValid && hasContent && <span className="ml-2">✓</span>}
                  </div>
                );
              })()}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
