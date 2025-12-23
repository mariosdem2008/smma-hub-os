import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const MAX_FOLLOWUPS = 3;
const STORAGE_PREFIX = "ai_onboarding_v2";

const AGENCY_QUESTIONS = [
  { id: "identity", prompt: "What is your agency name and primary niches?", type: "textarea" },
  { id: "offers", prompt: "List your core offers and services.", type: "textarea" },
  { id: "geo", prompt: "Which geographies do you serve?", type: "textarea" },
  { id: "languages", prompt: "Which languages do you support?", type: "textarea" },
  { id: "icp", prompt: "Who is your ICP? Include industries and company sizes.", type: "textarea" },
  { id: "personas", prompt: "List 3-5 primary personas you serve.", type: "textarea" },
  { id: "pains", prompt: "List common pains your clients face.", type: "textarea" },
  { id: "objections", prompt: "List common objections you handle.", type: "textarea" },
  { id: "tone", prompt: "Choose 5 adjectives that describe your voice/tone.", type: "chips", options: ["Bold", "Clear", "Friendly", "Direct", "Premium", "Playful"] },
  { id: "banned", prompt: "List banned words or phrases.", type: "textarea" },
  { id: "vocab", prompt: "List preferred vocabulary or terms.", type: "textarea" },
  { id: "rules", prompt: "List writing rules to follow.", type: "textarea" },
  { id: "pillars", prompt: "List your strategy pillars.", type: "textarea" },
  { id: "hooks", prompt: "List preferred hook styles.", type: "textarea" },
  { id: "ctas", prompt: "List preferred CTA styles.", type: "textarea" },
  { id: "formats", prompt: "List per-platform formats you use.", type: "textarea" },
  { id: "safety", prompt: "Summarize allowed and avoided claims.", type: "textarea" },
  { id: "process", prompt: "Summarize revisions, approvals, and escalation rules.", type: "textarea" },
  { id: "faq", prompt: "Provide 10+ FAQ questions and answers.", type: "textarea" },
  { id: "examples", prompt: "Upload or paste 5+ exemplar strategies.", type: "textarea" },
];

const CLIENT_QUESTIONS = [
  { id: "brand", prompt: "What is the client brand name and website?", type: "textarea" },
  { id: "differentiators", prompt: "List the top differentiators for this brand.", type: "textarea" },
  { id: "socials", prompt: "List the client social profiles.", type: "textarea" },
  { id: "tone", prompt: "Describe the client tone and voice.", type: "textarea" },
  { id: "offers", prompt: "List products/services and USPs.", type: "textarea" },
  { id: "pricing", prompt: "Optional: summarize pricing or packages.", type: "textarea" },
  { id: "audience", prompt: "Describe the target audience demographics and intent.", type: "textarea" },
  { id: "problems", prompt: "List audience problems and objections.", type: "textarea" },
  { id: "competitors", prompt: "List 3-10 competitors with notes.", type: "textarea" },
  { id: "constraints", prompt: "List banned claims, legal constraints, taboo topics.", type: "textarea" },
  { id: "dos", prompt: "List do/don't rules for content.", type: "textarea" },
  { id: "pillars", prompt: "Define 3-7 content pillars with examples.", type: "textarea" },
  { id: "faq", prompt: "Provide 10+ FAQ questions and answers.", type: "textarea" },
  { id: "assets", prompt: "List key asset links and guidelines.", type: "textarea" },
  { id: "lead_magnet", prompt: "Optional: share lead magnet details.", type: "textarea" },
  { id: "cta", prompt: "What CTA styles work best for this client?", type: "textarea" },
  { id: "voice", prompt: "List words/phrases to emphasize or avoid.", type: "textarea" },
  { id: "platforms", prompt: "Which platforms are in scope?", type: "chips", options: ["IG", "FB", "LinkedIn", "TikTok", "YouTube"] },
  { id: "goals", prompt: "Define primary goals for the next 90 days.", type: "textarea" },
  { id: "metrics", prompt: "Which metrics matter most?", type: "textarea" },
  { id: "timeline", prompt: "Confirm campaign timeline and seasonality.", type: "textarea" },
  { id: "approvals", prompt: "Who approves content and on what cadence?", type: "textarea" },
  { id: "contacts", prompt: "List primary stakeholder contacts.", type: "textarea" },
  { id: "assets_upload", prompt: "List asset links or uploads to include.", type: "textarea" },
  { id: "final_notes", prompt: "Any final notes or constraints?", type: "textarea" },
];

type Question = {
  id: string;
  prompt: string;
  type: "textarea" | "chips" | "single_select" | "multi_select";
  options?: string[];
};

type Props = {
  onboardingType: "agency" | "client";
  clientId?: string | null;
};

type FollowupState = {
  questions: string[];
  answers: string[];
};

export function AiOnboardingV2Chat({ onboardingType, clientId }: Props) {
  const { user } = useAuth();
  const questions = useMemo<Question[]>(
    () => (onboardingType === "agency" ? AGENCY_QUESTIONS : CLIENT_QUESTIONS),
    [onboardingType]
  );

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [brainId, setBrainId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [followups, setFollowups] = useState<Record<string, FollowupState>>({});
  const [inputValue, setInputValue] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [followupIndex, setFollowupIndex] = useState(0);
  const [currentFollowups, setCurrentFollowups] = useState<string[]>([]);
  const [followupAnswer, setFollowupAnswer] = useState("");

  const storageKey = `${STORAGE_PREFIX}_${onboardingType}_${clientId ?? "agency"}`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          index: number;
          answers: Record<string, string | string[]>;
          followups: Record<string, FollowupState>;
          brainId: string | null;
        };
        setIndex(parsed.index ?? 0);
        setAnswers(parsed.answers ?? {});
        setFollowups(parsed.followups ?? {});
        setBrainId(parsed.brainId ?? null);
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    const resolveAgency = async () => {
      if (!user) return;

      if (onboardingType === "client" && clientId) {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("agency_id")
          .eq("id", clientId)
          .maybeSingle();
        setAgencyId(clientRow?.agency_id ?? null);
      } else {
        const { data: membership } = await supabase
          .from("agency_members")
          .select("agency_id")
          .eq("user_id", user.id)
          .maybeSingle();
        setAgencyId(membership?.agency_id ?? null);
      }
    };

    resolveAgency();
  }, [user, onboardingType, clientId]);

  useEffect(() => {
    const initBrain = async () => {
      if (!agencyId || !user) return;

      const table = onboardingType === "agency" ? "agency_brains" : "client_brains";
      let query = supabase.from(table).select("id, brain_json, status, version").eq("agency_id", agencyId);
      if (onboardingType === "client" && clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data: existing } = await query.order("version", { ascending: false }).limit(1).maybeSingle();
      if (existing?.id) {
        setBrainId(existing.id);
        const raw = (existing.brain_json as any)?.raw_responses ?? {};
        const rawFollowups = (existing.brain_json as any)?.followup_responses ?? {};
        setAnswers((prev) => ({ ...raw, ...prev }));
        setFollowups((prev) => ({ ...rawFollowups, ...prev }));
        return;
      }

      const body: Record<string, unknown> = {
        action: "create",
        agency_id: agencyId,
        brain_json: { raw_responses: {}, followup_responses: {} },
      };
      if (onboardingType === "client" && clientId) {
        body.client_id = clientId;
      }

      const endpoint = onboardingType === "agency" ? "ai-brains-agency" : "ai-brains-client";
      const { data, error } = await supabase.functions.invoke(endpoint, { body });
      if (!error && data?.brain?.id) {
        setBrainId(data.brain.id);
      }
    };

    initBrain();
  }, [agencyId, onboardingType, clientId, user]);

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ index, answers, followups, brainId })
    );
  }, [storageKey, index, answers, followups, brainId]);

  const completedCount = Object.keys(answers).length;
  const question = questions[index];

  const callQualityCheck = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("ai-answer-quality-check", { body: payload });
    if (error) {
      return { accepted: true, followup_questions: [], issues: [] };
    }
    return data;
  };

  const updateBrain = async (nextAnswers: Record<string, string | string[]>, nextFollowups: Record<string, FollowupState>) => {
    if (!brainId || !agencyId) return;

    const endpoint = onboardingType === "agency" ? "ai-brains-agency" : "ai-brains-client";
    const body: Record<string, unknown> = {
      action: "update",
      agency_id: agencyId,
      brain_id: brainId,
      brain_json: {
        raw_responses: nextAnswers,
        followup_responses: nextFollowups,
      },
    };
    if (onboardingType === "client" && clientId) {
      body.client_id = clientId;
    }
    await supabase.functions.invoke(endpoint, { body });
  };

  const handleSubmit = async () => {
    if (!question || !agencyId) return;
    setLoading(true);

    const value = question.type === "chips" ? selectedOptions : inputValue.trim();
    const quality = await callQualityCheck({
      agency_id: agencyId,
      client_id: clientId ?? null,
      question_id: question.id,
      question_text: question.prompt,
      input_type: question.type,
      answer: value,
    });

    if (quality.followup_questions?.length) {
      const limited = quality.followup_questions.slice(0, MAX_FOLLOWUPS);
      setCurrentFollowups(limited);
      setFollowupIndex(0);
      setFollowupAnswer("");
      setLoading(false);
      return;
    }

    const nextAnswers = { ...answers, [question.id]: value };
    const nextFollowups = { ...followups };
    setAnswers(nextAnswers);
    await updateBrain(nextAnswers, nextFollowups);

    setInputValue("");
    setSelectedOptions([]);
    setLoading(false);

    if (index + 1 >= questions.length) {
      setReviewMode(true);
    } else {
      setIndex(index + 1);
    }
  };

  const handleFollowupSubmit = async () => {
    if (!question || !agencyId) return;

    const followupQuestion = currentFollowups[followupIndex];
    if (!followupQuestion) return;

    setLoading(true);
    const quality = await callQualityCheck({
      agency_id: agencyId,
      client_id: clientId ?? null,
      question_id: `${question.id}_followup_${followupIndex}`,
      question_text: followupQuestion,
      input_type: "textarea",
      answer: followupAnswer.trim(),
    });

    if (!quality.accepted) {
      setLoading(false);
      return;
    }

    const updatedFollowups = followups[question.id] ?? { questions: [...currentFollowups], answers: [] };
    updatedFollowups.answers[followupIndex] = followupAnswer.trim();

    const nextFollowups = { ...followups, [question.id]: updatedFollowups };
    setFollowups(nextFollowups);

    if (followupIndex + 1 < currentFollowups.length) {
      setFollowupIndex(followupIndex + 1);
      setFollowupAnswer("");
      setLoading(false);
      return;
    }

    const nextAnswers = { ...answers, [question.id]: question.type === "chips" ? selectedOptions : inputValue.trim() };
    setAnswers(nextAnswers);
    await updateBrain(nextAnswers, nextFollowups);

    setInputValue("");
    setSelectedOptions([]);
    setCurrentFollowups([]);
    setFollowupIndex(0);
    setFollowupAnswer("");
    setLoading(false);

    if (index + 1 >= questions.length) {
      setReviewMode(true);
    } else {
      setIndex(index + 1);
    }
  };

  const handleLock = async () => {
    if (!brainId || !agencyId) return;
    const endpoint = onboardingType === "agency" ? "ai-brains-agency" : "ai-brains-client";
    const body: Record<string, unknown> = {
      action: "lock",
      agency_id: agencyId,
      brain_id: brainId,
    };
    if (onboardingType === "client" && clientId) {
      body.client_id = clientId;
    }
    await supabase.functions.invoke(endpoint, { body });
  };

  if (!agencyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complete Agency Setup First</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You need an agency membership before starting AI onboarding.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (reviewMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review & Confirm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Review captured responses before locking version v1.
          </div>
          <pre className="rounded-md bg-muted p-4 text-xs whitespace-pre-wrap">
            {JSON.stringify({ answers, followups }, null, 2)}
          </pre>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setReviewMode(false)}>
              Back
            </Button>
            <Button onClick={handleLock}>Lock v1</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{onboardingType === "agency" ? "AI Onboarding v2 (Agency)" : "AI Onboarding v2 (Client)"}</span>
          <span className="text-sm text-muted-foreground">
            {completedCount} / {questions.length} core questions completed
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-4 bg-muted/30">
          <div className="text-sm text-muted-foreground">AI</div>
          <div className="font-medium mt-1">{question?.prompt}</div>
        </div>

        {question?.type === "textarea" && (
          <Textarea
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Type your answer"
            rows={4}
          />
        )}

        {question?.type === "chips" && question.options && (
          <div className="flex flex-wrap gap-2">
            {question.options.map((option) => {
              const active = selectedOptions.includes(option);
              return (
                <Button
                  key={option}
                  type="button"
                  variant={active ? "default" : "outline"}
                  onClick={() => {
                    setSelectedOptions((prev) =>
                      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
                    );
                  }}
                >
                  {option}
                </Button>
              );
            })}
          </div>
        )}

        {currentFollowups.length > 0 && (
          <div className="rounded-md border p-4 bg-muted/30 space-y-2">
            <div className="text-sm text-muted-foreground">Follow-up</div>
            <div className="font-medium">{currentFollowups[followupIndex]}</div>
            <Textarea
              value={followupAnswer}
              onChange={(event) => setFollowupAnswer(event.target.value)}
              placeholder="Provide more detail"
              rows={3}
            />
            <Button onClick={handleFollowupSubmit} disabled={loading || followupAnswer.trim().length === 0}>
              Save Follow-up
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIndex(Math.max(index - 1, 0))} disabled={index === 0}>
            Back
          </Button>
          <Button variant="outline" onClick={() => setReviewMode(true)}>
            Review
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              currentFollowups.length > 0 ||
              (question?.type === "chips" ? selectedOptions.length === 0 : inputValue.trim().length === 0)
            }
          >
            {loading ? "Checking..." : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
