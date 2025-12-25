import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, AlertCircle, ChevronLeft } from "lucide-react";

type InputType =
  | "single_select"
  | "multi_select"
  | "chips"
  | "short_text"
  | "url"
  | "contact_card"
  | "textarea";

interface Option {
  id: string;
  label: string;
  hint?: string;
}

interface StepSpec {
  step_id: string;
  assistant_message: string;
  input_type: InputType;
  options?: Option[];
  constraints?: {
    required: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  validation_errors?: string[];
  recap_so_far?: string;
  progress_percent: number;
  can_lock: boolean;
}

interface Answers {
  [key: string]: unknown;
  brand?: string;
  website?: string;
  niche?: string;
  offers?: string[];
  audience?: string[];
  differentiators?: string[];
  tone?: string[];
  tone_example?: string;
  platforms?: string[];
  primary_platform?: string;
  goals?: string[];
  kpis?: string[];
  constraints?: string[];
  approval_cadence?: string;
  approver_contact?: string;
  pillars?: string[];
  banned_claims?: string[];
  taboo_topics?: string[];
  competitors?: string[];
  cta_styles?: string[];
  assets?: string[];
  pricing?: string;
  timeline?: string;
  brief?: {
    confidence: number;
    summary: Record<string, unknown>;
    followup?: {
      pending: boolean;
      for_step_id: string;
      question: string;
      answer?: string;
    };
    updated_at: string;
  };
}

type AnswersJson = Json;

interface Props {
  agencyId: string;
  clientId: string;
  onboardingType: "client";
}

const APPROVAL_IDS = ["every_post", "weekly_batch", "monthly_batch", "autonomous"] as const;
const KPI_IDS = ["followers", "engagement_rate", "reach", "leads_count", "conversion_rate", "revenue"] as const;

const REQUIRED_STEPS = [
  "brand_basics",
  "niche",
  "offers",
  "audience",
  "differentiators",
  "tone_voice",
  "platforms",
  "goals_kpis",
  "constraints_approvals",
  "pillars",
  "safety_topics",
] as const;

const OPTIONAL_STEPS = [
  "competitors",
  "cta_styles",
  "assets",
  "pricing",
  "timeline"
] as const;

const SKIPPABLE_STEPS = ["pillars", "safety_topics"] as const;

function splitToList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => item.toString()).map((item) => item.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function computeBrief(nextAnswers: Answers, currentStepId: string): NonNullable<Answers["brief"]> {
  const summary = {
    brand: nextAnswers.brand ?? "",
    website: nextAnswers.website ?? "",
    niche: nextAnswers.niche ?? "",
    offers: nextAnswers.offers ?? [],
    audience: nextAnswers.audience ?? [],
    differentiators: nextAnswers.differentiators ?? [],
    tone: nextAnswers.tone ?? [],
    platforms: nextAnswers.platforms ?? [],
    primary_platform: nextAnswers.primary_platform ?? "",
    goals: nextAnswers.goals ?? [],
    kpis: nextAnswers.kpis ?? [],
    pillars: nextAnswers.pillars ?? [],
    banned_claims: nextAnswers.banned_claims ?? [],
    taboo_topics: nextAnswers.taboo_topics ?? [],
  };

  const requiredIndex = REQUIRED_STEPS.indexOf(currentStepId as any);
  const stepCount = requiredIndex >= 0 ? requiredIndex + 1 : REQUIRED_STEPS.length;
  const progressRatio = stepCount / REQUIRED_STEPS.length;

  let confidence = 1;
  if (currentStepId === "niche" && nextAnswers.niche === "other") confidence -= 0.35;
  if (currentStepId === "offers" && (nextAnswers.offers?.length ?? 0) === 1) confidence -= 0.25;
  if (currentStepId === "audience" && (nextAnswers.audience?.length ?? 0) === 1) confidence -= 0.2;
  if (currentStepId === "differentiators" && (nextAnswers.differentiators?.length ?? 0) === 2) confidence -= 0.2;
  if (currentStepId === "goals_kpis" && (nextAnswers.goals?.length ?? 0) === 1) confidence -= 0.2;
  if (currentStepId === "pillars" && (nextAnswers.pillars?.length ?? 0) > 0 && (nextAnswers.pillars?.length ?? 0) < 3) confidence -= 0.35;
  confidence = Math.max(0, Math.min(1, confidence * (0.6 + 0.4 * progressRatio)));

  const previousFollowup = nextAnswers.brief?.followup;
  let followup = previousFollowup;

  if (confidence < 0.7 && !previousFollowup?.pending) {
    let question = "";
    if (currentStepId === "niche") question = "What specific niche/industry best describes the client? (1 sentence)";
    else if (currentStepId === "offers") question = "What other key products/services should we include? (2-3 bullets)";
    else if (currentStepId === "audience") question = "Who else is a key audience segment we should target? (1-2 bullets)";
    else if (currentStepId === "differentiators") question = "What is one more differentiator that matters to buyers? (1 bullet)";
    else if (currentStepId === "goals_kpis") question = "What is one additional 90-day goal we should optimize for? (1 bullet)";
    else if (currentStepId === "pillars") question = "List 3-6 content pillars to anchor the strategy (comma/newline separated).";
    else if (currentStepId === "constraints_approvals") question = "Any banned claims or taboo topics we must avoid? (comma/newline separated)";

    if (question) {
      followup = {
        pending: true,
        for_step_id: currentStepId,
        question,
      };
    }
  }

  return {
    confidence,
    summary,
    followup,
    updated_at: new Date().toISOString(),
  };
}

function answerKeyForStep(stepId: string): keyof Answers | null {
  switch (stepId) {
    case "niche":
      return "niche";
    case "offers":
      return "offers";
    case "audience":
      return "audience";
    case "differentiators":
      return "differentiators";
    case "competitors":
      return "competitors";
    case "pillars":
      return "pillars";
    case "cta_styles":
      return "cta_styles";
    case "assets":
      return "assets";
    case "pricing":
      return "pricing";
    case "timeline":
      return "timeline";
    default:
      return null;
  }
}

export function AiOnboardingV3Guided({ agencyId, clientId }: Props) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [brainId, setBrainId] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState<StepSpec | null>(null);
  const [answers, setAnswers] = useState<Answers>({});

  // localInput is:
  // - object for complex steps (brand_basics, platforms, tone_voice, constraints_approvals)
  // - string for short_text/url/textarea steps
  const [localInput, setLocalInput] = useState<any>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [stepHistory, setStepHistory] = useState<string[]>([]);

  // skip tracking + "re-ask at end"
  const [skippedSteps, setSkippedSteps] = useState<string[]>([]);
  const [reaskedSteps, setReaskedSteps] = useState<string[]>([]);
  const [isReaskingSkipped, setIsReaskingSkipped] = useState(false);
  const resumeAfterReaskRef = useRef<string | null>(null);

  // typing UX
  const [displayedMessage, setDisplayedMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    initOnboarding();
  }, [agencyId, clientId]);

  // Typewriter effect for AI messages
  useEffect(() => {
    if (!currentStep?.assistant_message) return;

    const fullMessage = currentStep.assistant_message;
    const isTestEnvironment =
      import.meta.env.MODE === "test" || process.env.NODE_ENV === "test";

    if (isTestEnvironment) {
      setDisplayedMessage(fullMessage);
      setIsTyping(false);
      setShowOptions(true);
      return;
    }

    setDisplayedMessage("");
    setIsTyping(true);
    setShowOptions(false);

    let currentIndex = 0;
    const typingSpeed = 25;

    const typeNextChar = () => {
      if (currentIndex < fullMessage.length) {
        setDisplayedMessage(fullMessage.slice(0, currentIndex + 1));
        currentIndex++;
        setTimeout(typeNextChar, typingSpeed);
      } else {
        setIsTyping(false);
        setTimeout(() => setShowOptions(true), 150);
      }
    };

    typeNextChar();

    return () => {
      currentIndex = fullMessage.length;
    };
  }, [currentStep?.assistant_message]);

  function remainingSkippedToReask(nextSkippedSteps: string[] = skippedSteps, nextReasked: string[] = reaskedSteps) {
    return nextSkippedSteps.filter((id) => !nextReasked.includes(id));
  }

  function primeInputsForStep(spec: StepSpec, answersParam: Answers) {
    const stepId = spec.step_id;

    // reset defaults
    setSelectedOptions([]);
    setLocalInput(null);

    if (stepId === "brand_basics") {
      setLocalInput({
        brand: answersParam.brand ?? "",
        website: answersParam.website ?? "",
      });
      return;
    }

    if (stepId === "tone_voice") {
      setSelectedOptions(answersParam.tone ?? []);
      setLocalInput({ tone_example: answersParam.tone_example ?? "" });
      return;
    }

    if (stepId === "platforms") {
      setSelectedOptions(answersParam.platforms ?? []);
      setLocalInput({ primary_platform: answersParam.primary_platform ?? undefined });
      return;
    }

    if (stepId === "goals_kpis") {
      setSelectedOptions([...(answersParam.goals ?? []), ...(answersParam.kpis ?? [])]);
      return;
    }

    if (stepId === "constraints_approvals") {
      const approval = answersParam.approval_cadence ? [answersParam.approval_cadence] : [];
      setSelectedOptions([...(answersParam.constraints ?? []), ...approval]);
      setLocalInput({ approver_contact: answersParam.approver_contact ?? "" });
      return;
    }

    if (stepId === "pillars") {
      setLocalInput((answersParam.pillars ?? []).join("\n"));
      return;
    }

    if (stepId === "safety_topics") {
      setLocalInput({
        banned_claims_text: (answersParam.banned_claims ?? []).join("\n"),
        taboo_topics_text: (answersParam.taboo_topics ?? []).join("\n"),
      });
      return;
    }

    if (stepId === "brief_followup") {
      setLocalInput(answersParam.brief?.followup?.answer ?? "");
      return;
    }

    // Generic priming from answers
    const key = answerKeyForStep(stepId);
    const existing = key ? (answersParam[key] as any) : undefined;

    if ((spec.input_type === "multi_select" || spec.input_type === "chips") && Array.isArray(existing)) {
      setSelectedOptions(existing);
      return;
    }
    if (spec.input_type === "single_select" && typeof existing === "string" && existing) {
      setSelectedOptions([existing]);
      return;
    }
    if ((spec.input_type === "short_text" || spec.input_type === "url" || spec.input_type === "textarea") && typeof existing === "string") {
      setLocalInput(existing);
      return;
    }
  }

  async function persistSessionStep(nextStepId: string, sessionIdParam?: string | null) {
    const sid = sessionIdParam ?? sessionId;
    if (!sid) return;

    const { error } = await supabase
      .from("client_onboarding_sessions")
      .update({ step_id: nextStepId })
      .eq("id", sid);

    if (error) {
      console.error("[Session] step_id update failed:", error);
    }
  }

  async function initOnboarding() {
    try {
      setLoading(true);

      // 1) Ensure brain exists
      const { data: brainData, error: brainError } = await supabase.functions.invoke(
        "ai-brains-client",
        {
          body: {
            action: "create",
            agency_id: agencyId,
            client_id: clientId,
            brain_json: { raw_responses: {}, followup_responses: {} },
          },
        }
      );

      if (brainError) throw new Error(brainError.message);
      if (!brainData?.brain?.id) throw new Error("Failed to create brain");

      const activeBrainId = brainData.brain.id;
      setBrainId(activeBrainId);

      // 2) Load or create session
      const { data: sessionData, error: sessionError } = await supabase
        .from("client_onboarding_sessions")
        .select("id, step_id, answers_json, brain_id")
        .eq("client_id", clientId)
        .maybeSingle();

      if (sessionError && sessionError.code !== "PGRST116") throw sessionError;

      let activeAnswers: Answers = {};
      let activeSessionId: string | null = null;
      let activeStepId: string | null = null;

      if (sessionData) {
        activeSessionId = sessionData.id;
        activeAnswers = (sessionData.answers_json || {}) as Answers;
        activeStepId = sessionData.step_id || null;
        setSessionId(activeSessionId);
        setAnswers(activeAnswers);
      } else {
        const user = (await supabase.auth.getUser()).data.user;
        const { data: newSession, error: createError } = await supabase
          .from("client_onboarding_sessions")
          .insert({
            agency_id: agencyId,
            client_id: clientId,
            user_id: user?.id,
            brain_id: activeBrainId,
            step_id: "brand_basics",
            answers_json: {} as AnswersJson,
            completed_required: false,
          })
          .select()
          .single();

        if (createError) throw createError;
        activeSessionId = newSession.id;
        activeStepId = "brand_basics";
        setSessionId(activeSessionId);
      }

      // 3) Load step
      await loadStep(activeBrainId, activeStepId, activeAnswers, undefined, undefined, activeSessionId);
    } catch (error: any) {
      console.error("[Init] error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to initialize onboarding",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadStep(
    brainIdParam: string,
    stepId: string | null,
    answersParam: Answers,
    userInput?: any,
    skippedStepsParam?: string[],
    sessionIdOverride?: string | null
  ): Promise<StepSpec | null> {
    try {
      const { data: stepData, error: stepError } = await supabase.functions.invoke(
        "ai-onboarding-guide",
        {
          body: {
            agency_id: agencyId,
            client_id: clientId,
            brain_id: brainIdParam,
            step_id: stepId,
            answers: answersParam,
            user_input: userInput, // if undefined, it will be omitted
            skipped_steps: skippedStepsParam ?? skippedSteps,
          },
        }
      );

      if (stepError) {
        if (stepError.message?.includes("AI service unavailable")) {
          toast({
            title: "AI Service Unavailable",
            description:
              "The AI onboarding service is temporarily unavailable. Please try again later or contact support.",
            variant: "destructive",
          });
          return null;
        }
        throw stepError;
      }

      const spec: StepSpec = stepData;

      setCurrentStep(spec);
      primeInputsForStep(spec, answersParam);

      await persistSessionStep(spec.step_id, sessionIdOverride);

      if (spec.validation_errors?.length) {
        toast({
          title: "Validation Error",
          description: spec.validation_errors.join(". "),
          variant: "destructive",
        });
      }

      return spec;
    } catch (error: any) {
      console.error("Load step error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load step",
        variant: "destructive",
      });
      return null;
    }
  }

  async function handleBack() {
    if (!brainId || stepHistory.length === 0) return;

    const previousStepId = stepHistory[stepHistory.length - 1];
    setStepHistory((prev) => prev.slice(0, -1));

    await loadStep(brainId, previousStepId, answers);
  }

  async function handleSkip() {
    if (!currentStep || !brainId) return;

    try {
      setSubmitting(true);

      const nextSkipped = skippedSteps.includes(currentStep.step_id)
        ? skippedSteps
        : [...skippedSteps, currentStep.step_id];

      setSkippedSteps(nextSkipped);

      // during "reask skipped" pass: go to next skipped (unreasked) or return to review step
      if (isReaskingSkipped) {
        const nextReasked = reaskedSteps.includes(currentStep.step_id)
          ? reaskedSteps
          : [...reaskedSteps, currentStep.step_id];

        setReaskedSteps(nextReasked);

        const remaining = remainingSkippedToReask(nextSkipped, nextReasked);
        const nextId = remaining[0];

        if (nextId) {
          await loadStep(brainId, nextId, answers, undefined, nextSkipped);
          return;
        }

        // done reasking
        setIsReaskingSkipped(false);
        const resumeId = resumeAfterReaskRef.current ?? "review_required";
        await loadStep(brainId, resumeId, answers, undefined, nextSkipped);
        return;
      }

      // normal skip: ask guide for the next step from current
      // and record history for back navigation
      setStepHistory((prev) => [...prev, currentStep.step_id]);

      const spec = await loadStep(brainId, currentStep.step_id, answers, null, nextSkipped);
      if (!spec) return;
    } catch (error: any) {
      console.error("Skip error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to skip step",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNext() {
    if (!currentStep || !brainId || !sessionId) return;

    try {
      setSubmitting(true);

      const stepId = currentStep.step_id;

      // If this is the final lock step AND there are skipped questions not yet re-asked,
      // force the "re-ask skipped at the end" pass BEFORE allowing lock.
      if (currentStep.can_lock && !isReaskingSkipped) {
        const remaining = remainingSkippedToReask();
        if (remaining.length > 0) {
          setIsReaskingSkipped(true);
          resumeAfterReaskRef.current = stepId;

          toast({
            title: "Almost done",
            description: `Finish ${remaining.length} skipped question${remaining.length === 1 ? "" : "s"} (fast).`,
          });

          await loadStep(brainId, remaining[0], answers, undefined, skippedSteps);
          return;
        }
      }

      // Add to history for back navigation
      setStepHistory((prev) => [...prev, stepId]);

      // If this step was previously skipped and is now being answered, remove it from skipped list
      const updatedSkipped = skippedSteps.filter((id) => id !== stepId);
      if (updatedSkipped.length !== skippedSteps.length) setSkippedSteps(updatedSkipped);

      // Build userInput
      let userInput: any = null;

      if (stepId === "brand_basics") {
        const brand = localInput?.brand ?? answers.brand ?? "";
        const website = localInput?.website ?? answers.website ?? "";
        userInput = { brand, website };
      } else if (stepId === "pillars") {
        userInput = splitToList(typeof localInput === "string" ? localInput : "");
      } else if (stepId === "safety_topics") {
        const banned_claims = splitToList(localInput?.banned_claims_text);
        const taboo_topics = splitToList(localInput?.taboo_topics_text);
        userInput = { banned_claims, taboo_topics };
      } else if (stepId === "brief_followup") {
        userInput = typeof localInput === "string" ? localInput : "";
      } else if (stepId === "tone_voice") {
        userInput = {
          tone: selectedOptions.slice(0, 3),
          tone_example: (localInput?.tone_example ?? answers.tone_example ?? "").trim() || null,
        };
      } else if (stepId === "platforms") {
        const primary = localInput?.primary_platform ?? answers.primary_platform ?? null;
        userInput = { platforms: selectedOptions, primary_platform: primary };
      } else if (stepId === "goals_kpis") {
        const goals = selectedOptions.filter((s) => !KPI_IDS.includes(s as any));
        const kpis = selectedOptions.filter((s) => KPI_IDS.includes(s as any));
        userInput = { goals, kpis };
      } else if (stepId === "constraints_approvals") {
        const approval = selectedOptions.find((s) => APPROVAL_IDS.includes(s as any)) ?? null;
        const constraints = selectedOptions.filter((s) => !APPROVAL_IDS.includes(s as any));
        const approver = (localInput?.approver_contact ?? answers.approver_contact ?? "").trim() || null;
        userInput = { constraints, approval_cadence: approval, approver_contact: approver };
      } else if (currentStep.input_type === "multi_select" || currentStep.input_type === "chips") {
        userInput = selectedOptions;
      } else if (currentStep.input_type === "single_select") {
        userInput = selectedOptions[0] || null;
      } else {
        userInput = localInput;
      }

      // Update answers
      const updatedAnswers: Answers = { ...answers };

      if (stepId === "brand_basics") {
        updatedAnswers.brand = userInput?.brand;
        updatedAnswers.website = userInput?.website;
      } else if (stepId === "pillars") {
        updatedAnswers.pillars = Array.isArray(userInput) ? userInput : [];
      } else if (stepId === "safety_topics") {
        updatedAnswers.banned_claims = userInput?.banned_claims ?? [];
        updatedAnswers.taboo_topics = userInput?.taboo_topics ?? [];
      } else if (stepId === "brief_followup") {
        const priorBrief = updatedAnswers.brief ?? computeBrief(updatedAnswers, stepId);
        const question = priorBrief.followup?.question ?? "";
        const forStep = priorBrief.followup?.for_step_id ?? "unknown";
        updatedAnswers.brief = {
          ...priorBrief,
          followup: {
            pending: false,
            for_step_id: forStep,
            question,
            answer: typeof userInput === "string" ? userInput : "",
          },
          updated_at: new Date().toISOString(),
        };
      } else if (stepId === "tone_voice") {
        updatedAnswers.tone = userInput?.tone ?? [];
        updatedAnswers.tone_example = userInput?.tone_example ?? undefined;
      } else if (stepId === "platforms") {
        updatedAnswers.platforms = userInput?.platforms ?? [];
        updatedAnswers.primary_platform = userInput?.primary_platform ?? undefined;
      } else if (stepId === "goals_kpis") {
        updatedAnswers.goals = userInput?.goals ?? [];
        updatedAnswers.kpis = userInput?.kpis ?? [];
      } else if (stepId === "constraints_approvals") {
        updatedAnswers.constraints = userInput?.constraints ?? [];
        updatedAnswers.approval_cadence = userInput?.approval_cadence ?? undefined;
        updatedAnswers.approver_contact = userInput?.approver_contact ?? undefined;
      } else {
        // generic answer write (only for known keys)
        const key = answerKeyForStep(stepId);
        if (key) {
          // arrays for multi/chips, strings for short_text/url/textarea/single_select
          (updatedAnswers as any)[key] = userInput;
        }
      }

      if (stepId !== "brief_followup") {
        updatedAnswers.brief = computeBrief(updatedAnswers, stepId);
      }

      // Persist answers_json
      const { error: updateError } = await supabase
        .from("client_onboarding_sessions")
        .update({ answers_json: updatedAnswers as unknown as AnswersJson })
        .eq("id", sessionId);

      if (updateError) throw updateError;

      // Update brain raw_responses
      const { error: brainUpdateError } = await supabase.functions.invoke("ai-brains-client", {
        body: {
          action: "update",
          agency_id: agencyId,
          client_id: clientId,
          brain_id: brainId,
          brain_json: { raw_responses: updatedAnswers },
        },
      });

      if (brainUpdateError) throw brainUpdateError;

      setAnswers(updatedAnswers);

      // If we're in "reask skipped" pass, go to the next skipped step (unreasked),
      // otherwise return to final review step.
      if (isReaskingSkipped) {
        const nextReasked = reaskedSteps.includes(stepId) ? reaskedSteps : [...reaskedSteps, stepId];
        setReaskedSteps(nextReasked);

        const remaining = remainingSkippedToReask(updatedSkipped, nextReasked);
        const nextId = remaining[0];

        if (nextId) {
          await loadStep(brainId, nextId, updatedAnswers, undefined, updatedSkipped);
          return;
        }

        setIsReaskingSkipped(false);
        const resumeId = resumeAfterReaskRef.current ?? "review_required";
        await loadStep(brainId, resumeId, updatedAnswers, undefined, updatedSkipped);
        return;
      }

       // Normal flow: if user chose to lock at review_required/final_review
       if ((stepId === "review_required" || stepId === "final_review") && userInput === "lock") {
         await handleLock(updatedAnswers);
         return;
       }

      // Load next step from guide
      await loadStep(brainId, stepId, updatedAnswers, userInput, updatedSkipped);
    } catch (error: any) {
      console.error("Next error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to proceed",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLock(finalAnswers: Answers) {
    if (!brainId || !sessionId) return;

    try {
      setSubmitting(true);

      const { error: lockError } = await supabase.functions.invoke("ai-brains-client", {
        body: { action: "lock", agency_id: agencyId, client_id: clientId, brain_id: brainId },
      });
      if (lockError) throw lockError;

      const { error: ingestError } = await supabase.functions.invoke("ai-brain-ingest", {
        body: { scope: "client", agency_id: agencyId, client_id: clientId, raw_responses: finalAnswers },
      });
      if (ingestError) console.error("Ingest error:", ingestError);

      const { error: sessionError } = await supabase
        .from("client_onboarding_sessions")
        .update({ completed_required: true })
        .eq("id", sessionId);

      if (sessionError) console.error("Session update error:", sessionError);

      toast({
        title: "Success!",
        description: "Client onboarding completed. Redirecting to client detail...",
      });

      const returnTo = searchParams.get("returnTo");
      navigate(returnTo ? returnTo : `/clients/${clientId}`);
    } catch (error: any) {
      console.error("Lock error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function renderInput() {
    if (!currentStep) return null;

    const { input_type, options = [], constraints } = currentStep;

    // brand basics is a special 2-field block
    if (currentStep.step_id === "brand_basics") {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="brand">Brand Name *</Label>
            <Input
              id="brand"
              value={localInput?.brand ?? ""}
              onChange={(e) => setLocalInput((prev: any) => ({ ...(prev ?? {}), brand: e.target.value }))}
              placeholder="e.g., Acme Corp"
            />
          </div>
          <div>
            <Label htmlFor="website">Website URL *</Label>
            <Input
              id="website"
              type="url"
              value={localInput?.website ?? ""}
              onChange={(e) => setLocalInput((prev: any) => ({ ...(prev ?? {}), website: e.target.value }))}
              placeholder="https://example.com"
            />
          </div>
        </div>
      );
    }

    if (input_type === "short_text" || input_type === "url") {
      const label = input_type === "url" ? "URL" : "Answer";
      return (
        <div className="space-y-2">
          <Label>{label}{currentStep.constraints?.required ? " *" : ""}</Label>
          <Input
            type={input_type === "url" ? "url" : "text"}
            value={typeof localInput === "string" ? localInput : ""}
            onChange={(e) => setLocalInput(e.target.value)}
            placeholder="Type here..."
          />
        </div>
      );
    }

    if (input_type === "textarea") {
      if (currentStep.step_id === "safety_topics") {
        return (
          <div className="space-y-4">
            <div>
              <Label>Banned claims (optional)</Label>
              <textarea
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={localInput?.banned_claims_text ?? ""}
                onChange={(e) =>
                  setLocalInput((prev: any) => ({ ...(prev ?? {}), banned_claims_text: e.target.value }))
                }
                placeholder="e.g., 'Guaranteed results', 'Lose 10lbs in 7 days'..."
              />
            </div>
            <div>
              <Label>Taboo topics (optional)</Label>
              <textarea
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={localInput?.taboo_topics_text ?? ""}
                onChange={(e) =>
                  setLocalInput((prev: any) => ({ ...(prev ?? {}), taboo_topics_text: e.target.value }))
                }
                placeholder="e.g., politics, religion, competitor mentions..."
              />
            </div>
          </div>
        );
      }

      if (currentStep.step_id === "pillars") {
        return (
          <div className="space-y-2">
            <Label>Content Pillars (3–6, optional)</Label>
            <textarea
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={typeof localInput === "string" ? localInput : ""}
              onChange={(e) => setLocalInput(e.target.value)}
              placeholder="One per line, e.g.\nCustomer stories\nBehind-the-scenes\nProduct education"
            />
          </div>
        );
      }

      return (
        <div className="space-y-2">
          <Label>Answer{currentStep.constraints?.required ? " *" : ""}</Label>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={typeof localInput === "string" ? localInput : ""}
            onChange={(e) => setLocalInput(e.target.value)}
            placeholder="Type here..."
          />
        </div>
      );
    }

    if (input_type === "single_select") {
      return (
        <div className="grid gap-2">
          {options.map((opt) => (
            <Button
              key={opt.id}
              variant={selectedOptions.includes(opt.id) ? "default" : "outline"}
              className="justify-start h-auto py-3"
              onClick={() => setSelectedOptions([opt.id])}
            >
              {selectedOptions.includes(opt.id) && <Check className="mr-2 h-4 w-4" />}
              <span className="text-left flex-1">{opt.label}</span>
            </Button>
          ))}
        </div>
      );
    }

    if (input_type === "multi_select") {
      return (
        <div className="space-y-4">
          <div className="grid gap-2">
            {options.map((opt) => (
              <Button
                key={opt.id}
                variant={selectedOptions.includes(opt.id) ? "default" : "outline"}
                className="justify-start h-auto py-3"
                onClick={() => {
                  if (selectedOptions.includes(opt.id)) {
                    setSelectedOptions(selectedOptions.filter((id) => id !== opt.id));
                  } else {
                    const max = constraints?.max || 999;
                    if (selectedOptions.length < max) setSelectedOptions([...selectedOptions, opt.id]);
                  }
                }}
              >
                {selectedOptions.includes(opt.id) && <Check className="mr-2 h-4 w-4" />}
                <span className="text-left flex-1">{opt.label}</span>
                {opt.hint && <span className="text-xs text-muted-foreground ml-2">{opt.hint}</span>}
              </Button>
            ))}
          </div>

          {/* Extra field for constraints_approvals */}
          {currentStep.step_id === "constraints_approvals" && (
            <div className="pt-2 border-t">
              <Label htmlFor="approver">Approver Name (optional)</Label>
              <Input
                id="approver"
                value={localInput?.approver_contact ?? ""}
                onChange={(e) =>
                  setLocalInput((prev: any) => ({ ...(prev ?? {}), approver_contact: e.target.value }))
                }
                placeholder="John Doe"
              />
            </div>
          )}
        </div>
      );
    }

    if (input_type === "chips") {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
              if (opt.id === "divider" || opt.label.startsWith("---")) {
                return (
                  <div key={`${opt.id}-${opt.label}`} className="w-full text-sm font-medium text-muted-foreground py-2">
                    {opt.label}
                  </div>
                );
              }

              const isSelected = selectedOptions.includes(opt.id);

              return (
                <Badge
                  key={opt.id}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2 text-sm"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedOptions(selectedOptions.filter((id) => id !== opt.id));
                      if (currentStep.step_id === "platforms") {
                        const primary = localInput?.primary_platform ?? undefined;
                        if (primary === opt.id) setLocalInput((prev: any) => ({ ...(prev ?? {}), primary_platform: undefined }));
                      }
                    } else {
                      const max = constraints?.max || 999;
                      if (selectedOptions.length < max) setSelectedOptions([...selectedOptions, opt.id]);
                    }
                  }}
                >
                  {opt.label}
                </Badge>
              );
            })}
          </div>

          {/* platforms: choose primary */}
          {currentStep.step_id === "platforms" && selectedOptions.length > 0 && (
            <div className="pt-2 border-t animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Label className="text-sm mb-2 block">Which platform is your primary focus? *</Label>
              <div className="grid gap-2">
                {selectedOptions.map((platformId) => {
                  const platform = options.find((opt) => opt.id === platformId);
                  if (!platform) return null;
                  const primary = localInput?.primary_platform ?? undefined;

                  return (
                    <Button
                      key={platformId}
                      variant={primary === platformId ? "default" : "outline"}
                      className="justify-start h-auto py-2 text-sm"
                      onClick={() => setLocalInput((prev: any) => ({ ...(prev ?? {}), primary_platform: platformId }))}
                    >
                      {primary === platformId && <Check className="mr-2 h-4 w-4" />}
                      <span className="text-left flex-1">{platform.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* tone_voice: example input */}
          {currentStep.step_id === "tone_voice" && (
            <div className="pt-2 border-t animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Label className="text-sm mb-2 block">Optional: paste a tone example</Label>
              <textarea
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={localInput?.tone_example ?? ""}
                onChange={(e) =>
                  setLocalInput((prev: any) => ({ ...(prev ?? {}), tone_example: e.target.value }))
                }
                placeholder="A short paragraph that sounds like your brand..."
              />
            </div>
          )}
        </div>
      );
    }

    if (input_type === "contact_card") {
      return (
        <div className="space-y-3">
          <div>
            <Label htmlFor="approver">Approver Name</Label>
            <Input
              id="approver"
              value={localInput?.approver_contact ?? ""}
              onChange={(e) => setLocalInput((prev: any) => ({ ...(prev ?? {}), approver_contact: e.target.value }))}
              placeholder="John Doe"
            />
          </div>
        </div>
      );
    }

    return null;
  }

  function canProceed(): boolean {
    if (!currentStep) return false;

    const { step_id, constraints, input_type } = currentStep;

    if (step_id === "brand_basics") {
      const brand = (localInput?.brand ?? "").trim();
      const website = (localInput?.website ?? "").trim();
      return Boolean(brand && website);
    }

    if (step_id === "platforms") {
      const hasPlatforms = selectedOptions.length >= 1;
      const hasPrimary = Boolean(localInput?.primary_platform);
      return hasPlatforms && hasPrimary;
    }

    if (step_id === "goals_kpis") {
      const goals = selectedOptions.filter((s) => !KPI_IDS.includes(s as any));
      const kpis = selectedOptions.filter((s) => KPI_IDS.includes(s as any));
      return goals.length >= 1 && kpis.length >= 1 && kpis.length <= 3;
    }

    if (step_id === "constraints_approvals") {
      const hasApproval = selectedOptions.some((s) => APPROVAL_IDS.includes(s as any));
      return hasApproval;
    }

    if (step_id === "pillars") {
      const list = splitToList(typeof localInput === "string" ? localInput : "");
      if (list.length === 0) return true;
      return list.length >= 3 && list.length <= 6;
    }

    if (input_type === "single_select") return selectedOptions.length > 0;

    if (input_type === "multi_select" || input_type === "chips") {
      const min = constraints?.min || 1;
      const max = constraints?.max || 999;
      return selectedOptions.length >= min && selectedOptions.length <= max;
    }

    if (input_type === "short_text" || input_type === "url" || input_type === "textarea") {
      if (constraints?.required) return Boolean((typeof localInput === "string" ? localInput : "").trim());
      return true;
    }

    return true;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">Failed to load onboarding step</p>
        </div>
      </div>
    );
  }

  const unreaskedCount = remainingSkippedToReask().length;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Step Progress{isReaskingSkipped ? " (finishing skipped)" : ""}
          </span>
          <span className="font-medium">{currentStep.progress_percent}%</span>
        </div>
        <Progress value={currentStep.progress_percent} />
        {isReaskingSkipped && (
          <div className="text-xs text-muted-foreground">
            {unreaskedCount} skipped question{unreaskedCount === 1 ? "" : "s"} remaining
          </div>
        )}
      </div>

      {/* Assistant Message */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
              AI
            </div>
            <div className="flex-1">
              <p className="text-base leading-relaxed">
                {displayedMessage}
                {isTyping && <span className="inline-block w-1 h-5 ml-1 bg-primary animate-pulse" />}
              </p>
              {currentStep.recap_so_far && !isTyping && (
                <p className="text-sm text-muted-foreground mt-2 italic">{currentStep.recap_so_far}</p>
              )}
            </div>
          </div>

          {/* Input Area */}
          {showOptions && (
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {renderInput()}
            </div>
          )}

          {/* Constraints hint */}
          {showOptions && currentStep.constraints && (
            <div className="text-xs text-muted-foreground animate-in fade-in duration-300 delay-150">
              {currentStep.constraints.min && currentStep.constraints.max && (
                <span>
                  Select {currentStep.constraints.min}-{currentStep.constraints.max} option
                  {currentStep.constraints.max > 1 ? "s" : ""}
                </span>
              )}
              {currentStep.constraints.required && <span className="ml-2">* Required</span>}
            </div>
          )}

          {/* Validation Errors */}
          {showOptions && currentStep.validation_errors?.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
              {currentStep.validation_errors.map((err, idx) => (
                <p key={idx} className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {err}
                </p>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          {showOptions && (
            <div className="flex items-center justify-between mt-6 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
              <div className="flex items-center gap-2">
                {stepHistory.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleBack} disabled={submitting}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  {selectedOptions.length > 0 && `${selectedOptions.length} selected`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!currentStep.can_lock &&
                  (OPTIONAL_STEPS.includes(currentStep.step_id as any) || SKIPPABLE_STEPS.includes(currentStep.step_id as any)) && (
                  <Button variant="outline" onClick={handleSkip} disabled={submitting} size="lg">
                    Skip for Later
                  </Button>
                )}
                <Button onClick={handleNext} disabled={!canProceed() || submitting} size="lg">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {currentStep.can_lock ? "Lock & Finish" : "Next"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
