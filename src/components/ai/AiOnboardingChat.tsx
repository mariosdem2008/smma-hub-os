import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

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
  { id: "examples", prompt: "Upload or paste 5+ exemplar strategies.", type: "file" },
];

const CLIENT_QUESTIONS = [
  { id: "brand", prompt: "What is the client brand name and website?", type: "textarea" },
  { id: "socials", prompt: "List the client social profiles.", type: "textarea" },
  { id: "tone", prompt: "Describe the client tone and differentiators.", type: "textarea" },
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
  { id: "assets_upload", prompt: "Upload brand guidelines or assets.", type: "file" },
  { id: "final_notes", prompt: "Any final notes or constraints?", type: "textarea" },
];

const STORAGE_KEY_PREFIX = "ai_onboarding_v1_";

type Question = typeof AGENCY_QUESTIONS[number] & { options?: string[] };

type Props = {
  onboardingType: "agency" | "client";
};

export function AiOnboardingChat({ onboardingType }: Props) {
  const questions = useMemo<Question[]>(
    () => (onboardingType === "agency" ? AGENCY_QUESTIONS : CLIENT_QUESTIONS),
    [onboardingType]
  );

  const storageKey = `${STORAGE_KEY_PREFIX}${onboardingType}`;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [inputValue, setInputValue] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { index: number; answers: Record<string, string | string[]> };
        setIndex(parsed.index ?? 0);
        setAnswers(parsed.answers ?? {});
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  const question = questions[index];
  const completedCount = Object.keys(answers).length;

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify({ index, answers }));
  };

  const handleNext = (value: string | string[]) => {
    if (!question) return;
    setAnalyzing(true);
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    setInputValue("");
    setSelectedOptions([]);

    setTimeout(() => {
      setAnalyzing(false);
      if (index + 1 >= questions.length) {
        setReviewMode(true);
      } else {
        setIndex((prev) => prev + 1);
      }
    }, 400);
  };

  const handleSkip = () => {
    if (!question) return;
    setAnswers((prev) => ({ ...prev, [question.id]: "" }));
    if (index + 1 >= questions.length) {
      setReviewMode(true);
    } else {
      setIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (index > 0) {
      setIndex((prev) => prev - 1);
      setReviewMode(false);
    }
  };

  if (reviewMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review & Confirm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Review extracted fields below before locking version v1.
          </div>
          <pre className="rounded-md bg-muted p-4 text-xs whitespace-pre-wrap">
            {JSON.stringify(answers, null, 2)}
          </pre>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setReviewMode(false)}>
              Back
            </Button>
            <Button onClick={handleSave}>Save Draft</Button>
            <Button variant="secondary">Lock v1</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{onboardingType === "agency" ? "Agency Brain Onboarding" : "Client Brain Onboarding"}</span>
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

        {question?.type === "file" && (
          <Input type="file" />
        )}

        {analyzing && <div className="text-sm text-muted-foreground">Analyzing...</div>}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleBack} disabled={index === 0}>
            Back
          </Button>
          <Button variant="outline" onClick={handleSkip}>
            Skip
          </Button>
          <Button onClick={handleSave} variant="outline">
            Save
          </Button>
          <Button
            onClick={() =>
              handleNext(
                question?.type === "chips" ? selectedOptions : inputValue.trim()
              )
            }
            disabled={question?.type === "chips" ? selectedOptions.length === 0 : inputValue.trim().length === 0}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
