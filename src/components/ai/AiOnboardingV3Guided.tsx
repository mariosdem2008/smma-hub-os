import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, AlertCircle } from "lucide-react";

type InputType = "single_select" | "multi_select" | "chips" | "short_text" | "url" | "contact_card" | "textarea";

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
  competitors?: string[];
  pillars?: string[];
  cta_styles?: string[];
  assets?: string[];
  pricing?: string;
  timeline?: string;
}

interface Props {
  agencyId: string;
  clientId: string;
  onboardingType: "client";
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
  const [localInput, setLocalInput] = useState<any>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  useEffect(() => {
    initOnboarding();
  }, [agencyId, clientId]);

  async function initOnboarding() {
    try {
      setLoading(true);
      console.log('[Init] Starting onboarding init for client:', clientId);

      // 1. Ensure brain exists via edge function
      const { data: brainData, error: brainError } = await supabase.functions.invoke("ai-brains-client", {
        body: {
          action: "create",
          agency_id: agencyId,
          client_id: clientId,
          brain_json: { raw_responses: {}, followup_responses: {} }
        }
      });

      if (brainError) throw new Error(brainError.message);
      if (!brainData?.brain?.id) throw new Error("Failed to create brain");

      const activeBrainId = brainData.brain.id;
      setBrainId(activeBrainId);
      console.log('[Init] Brain created/loaded:', activeBrainId);

      // 2. Load or create session
      console.log('[Init] Checking for existing session...');
      const { data: sessionData, error: sessionError } = await supabase
        .from("client_onboarding_sessions")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();

      if (sessionError && sessionError.code !== "PGRST116") {
        console.error('[Init] Session query error:', sessionError);
        throw sessionError;
      }
      console.log('[Init] Session query result:', sessionData ? 'found' : 'not found');

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
        // Create new session
        const { data: newSession, error: createError } = await supabase
          .from("client_onboarding_sessions")
          .insert({
            agency_id: agencyId,
            client_id: clientId,
            user_id: (await supabase.auth.getUser()).data.user?.id,
            brain_id: activeBrainId,
            step_id: "brand_basics",
            answers_json: {},
            completed_required: false
          })
          .select()
          .single();

        if (createError) throw createError;
        activeSessionId = newSession.id;
        setSessionId(activeSessionId);
      }

      // 3. Load first/current step from guide
      console.log('[Init] Loading step:', activeStepId || 'brand_basics');
      await loadStep(activeBrainId, activeStepId, activeAnswers);
      console.log('[Init] ✅ Initialization complete');

    } catch (error: any) {
      console.error("[Init] ❌ Init error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to initialize onboarding",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadStep(brainIdParam: string, stepId: string | null, answersParam: Answers, userInput?: any) {
    try {
      const { data: stepData, error: stepError } = await supabase.functions.invoke("ai-onboarding-guide", {
        body: {
          agency_id: agencyId,
          client_id: clientId,
          brain_id: brainIdParam,
          step_id: stepId,
          answers: answersParam,
          user_input: userInput
        }
      });

      if (stepError) {
        // If error is 503 (missing API key), show clear message
        if (stepError.message?.includes("AI service unavailable")) {
          toast({
            title: "AI Service Unavailable",
            description: "The AI onboarding service is temporarily unavailable. Please try again later or contact support.",
            variant: "destructive"
          });
          return;
        }
        throw stepError;
      }

      const spec: StepSpec = stepData;
      setCurrentStep(spec);
      setSelectedOptions([]);
      setLocalInput(null);

      // If there are validation errors, show them
      if (spec.validation_errors && spec.validation_errors.length > 0) {
        toast({
          title: "Validation Error",
          description: spec.validation_errors.join(". "),
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error("Load step error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load step",
        variant: "destructive"
      });
    }
  }

  async function handleNext() {
    if (!currentStep || !brainId || !sessionId) return;

    try {
      setSubmitting(true);

      // Prepare user input based on step type
      let userInput: any;
      const stepId = currentStep.step_id;

      if (stepId === "brand_basics") {
        userInput = localInput; // { brand, website }
      } else if (stepId === "tone_voice") {
        userInput = {
          tone: selectedOptions.slice(0, 3),
          tone_example: selectedOptions[3] || null
        };
      } else if (stepId === "platforms") {
        userInput = {
          platforms: selectedOptions.filter(p => p !== localInput?.primary_platform),
          primary_platform: localInput?.primary_platform
        };
      } else if (stepId === "goals_kpis") {
        userInput = {
          goals: selectedOptions.filter(s => !["followers", "engagement_rate", "reach", "leads_count", "conversion_rate", "revenue"].includes(s)),
          kpis: selectedOptions.filter(s => ["followers", "engagement_rate", "reach", "leads_count", "conversion_rate", "revenue"].includes(s))
        };
      } else if (currentStep.input_type === "multi_select" || currentStep.input_type === "chips") {
        userInput = selectedOptions;
      } else if (currentStep.input_type === "single_select") {
        userInput = selectedOptions[0] || null;
      } else {
        userInput = localInput;
      }

      // Update answers
      const updatedAnswers = { ...answers };
      if (stepId === "brand_basics" && userInput) {
        updatedAnswers.brand = userInput.brand;
        updatedAnswers.website = userInput.website;
      } else if (stepId === "niche") {
        updatedAnswers.niche = userInput;
      } else if (stepId === "offers") {
        updatedAnswers.offers = userInput;
      } else if (stepId === "audience") {
        updatedAnswers.audience = userInput;
      } else if (stepId === "differentiators") {
        updatedAnswers.differentiators = userInput;
      } else if (stepId === "tone_voice" && userInput) {
        updatedAnswers.tone = userInput.tone;
        updatedAnswers.tone_example = userInput.tone_example;
      } else if (stepId === "platforms" && userInput) {
        updatedAnswers.platforms = userInput.platforms;
        updatedAnswers.primary_platform = userInput.primary_platform;
      } else if (stepId === "goals_kpis" && userInput) {
        updatedAnswers.goals = userInput.goals;
        updatedAnswers.kpis = userInput.kpis;
      } else if (stepId === "constraints_approvals") {
        updatedAnswers.constraints = selectedOptions;
        updatedAnswers.approval_cadence = localInput?.approval_cadence;
        updatedAnswers.approver_contact = localInput?.approver_contact;
      }

      // Update session in database
      const { error: updateError } = await supabase
        .from("client_onboarding_sessions")
        .update({
          answers_json: updatedAnswers,
          step_id: stepId
        })
        .eq("id", sessionId);

      if (updateError) throw updateError;

      // Update brain via edge function
      const { error: brainUpdateError } = await supabase.functions.invoke("ai-brains-client", {
        body: {
          action: "update",
          agency_id: agencyId,
          client_id: clientId,
          brain_id: brainId,
          brain_json: { raw_responses: updatedAnswers }
        }
      });

      if (brainUpdateError) throw brainUpdateError;

      setAnswers(updatedAnswers);

      // Check if user chose to lock at review_required
      if (stepId === "review_required" && userInput === "lock") {
        await handleLock();
        return;
      }

      // Load next step
      await loadStep(brainId, stepId, updatedAnswers, userInput);

    } catch (error: any) {
      console.error("Next error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to proceed",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLock() {
    if (!brainId || !sessionId) return;

    try {
      setSubmitting(true);

      // Lock brain via edge function
      const { error: lockError } = await supabase.functions.invoke("ai-brains-client", {
        body: {
          action: "lock",
          agency_id: agencyId,
          client_id: clientId,
          brain_id: brainId
        }
      });

      if (lockError) throw lockError;

      // Trigger ingestion to compute usable flag
      const { error: ingestError } = await supabase.functions.invoke("ai-brain-ingest", {
        body: {
          scope: "client",
          agency_id: agencyId,
          client_id: clientId,
          raw_responses: answers
        }
      });

      if (ingestError) {
        console.error("Ingest error:", ingestError);
        // Don't fail the whole flow, just log
      }

      // Mark session as completed
      const { error: sessionError } = await supabase
        .from("client_onboarding_sessions")
        .update({ completed_required: true })
        .eq("id", sessionId);

      if (sessionError) console.error("Session update error:", sessionError);

      toast({
        title: "Success!",
        description: "Client onboarding completed. Redirecting to client detail...",
      });

      // Navigate back to client detail
      const returnTo = searchParams.get("returnTo");
      if (returnTo) {
        navigate(returnTo);
      } else {
        navigate(`/clients/${clientId}`);
      }

    } catch (error: any) {
      console.error("Lock error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  }

  function renderInput() {
    if (!currentStep) return null;

    const { input_type, options = [], constraints } = currentStep;

    if (input_type === "short_text" || input_type === "url") {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="brand">Brand Name *</Label>
            <Input
              id="brand"
              value={localInput?.brand || answers.brand || ""}
              onChange={(e) => {
                const newValue = e.target.value;
                console.log('[Input onChange] brand:', newValue, 'current localInput:', localInput);
                setLocalInput({ ...localInput, brand: newValue });
              }}
              placeholder="e.g., Acme Corp"
            />
          </div>
          <div>
            <Label htmlFor="website">Website URL *</Label>
            <Input
              id="website"
              type="url"
              value={localInput?.website || answers.website || ""}
              onChange={(e) => {
                const newValue = e.target.value;
                console.log('[Input onChange] website:', newValue, 'current localInput:', localInput);
                setLocalInput({ ...localInput, website: newValue });
              }}
              placeholder="https://example.com"
            />
          </div>
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
        <div className="grid gap-2">
          {options.map((opt) => (
            <Button
              key={opt.id}
              variant={selectedOptions.includes(opt.id) ? "default" : "outline"}
              className="justify-start h-auto py-3"
              onClick={() => {
                if (selectedOptions.includes(opt.id)) {
                  setSelectedOptions(selectedOptions.filter(id => id !== opt.id));
                } else {
                  const max = constraints?.max || 999;
                  if (selectedOptions.length < max) {
                    setSelectedOptions([...selectedOptions, opt.id]);
                  }
                }
              }}
            >
              {selectedOptions.includes(opt.id) && <Check className="mr-2 h-4 w-4" />}
              <span className="text-left flex-1">{opt.label}</span>
              {opt.hint && <span className="text-xs text-muted-foreground ml-2">{opt.hint}</span>}
            </Button>
          ))}
        </div>
      );
    }

    if (input_type === "chips") {
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <Badge
              key={opt.id}
              variant={selectedOptions.includes(opt.id) ? "default" : "outline"}
              className="cursor-pointer px-4 py-2 text-sm"
              onClick={() => {
                if (selectedOptions.includes(opt.id)) {
                  setSelectedOptions(selectedOptions.filter(id => id !== opt.id));
                } else {
                  const max = constraints?.max || 999;
                  if (selectedOptions.length < max) {
                    setSelectedOptions([...selectedOptions, opt.id]);
                  }
                }
              }}
            >
              {opt.label}
            </Badge>
          ))}
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
              value={localInput?.approver_contact || ""}
              onChange={(e) => setLocalInput({ ...localInput, approver_contact: e.target.value })}
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
      // Check both localInput (current edits) and answers (saved/resumed values)
      const brand = localInput?.brand || answers.brand;
      const website = localInput?.website || answers.website;
      const result = !!(brand && website);
      console.log('[canProceed] brand_basics check:', {
        localInput,
        answers,
        brand,
        website,
        result
      });
      return result;
    }

    if (input_type === "single_select") {
      return selectedOptions.length > 0;
    }

    if (input_type === "multi_select" || input_type === "chips") {
      const min = constraints?.min || 1;
      const max = constraints?.max || 999;
      return selectedOptions.length >= min && selectedOptions.length <= max;
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

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Step Progress</span>
          <span className="font-medium">{currentStep.progress_percent}%</span>
        </div>
        <Progress value={currentStep.progress_percent} />
      </div>

      {/* Assistant Message */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
              AI
            </div>
            <div className="flex-1">
              <p className="text-base leading-relaxed">{currentStep.assistant_message}</p>
              {currentStep.recap_so_far && (
                <p className="text-sm text-muted-foreground mt-2 italic">{currentStep.recap_so_far}</p>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="mt-6">
            {renderInput()}
          </div>

          {/* Constraints hint */}
          {currentStep.constraints && (
            <div className="text-xs text-muted-foreground">
              {currentStep.constraints.min && currentStep.constraints.max && (
                <span>Select {currentStep.constraints.min}-{currentStep.constraints.max} option{currentStep.constraints.max > 1 ? "s" : ""}</span>
              )}
              {currentStep.constraints.required && (
                <span className="ml-2">* Required</span>
              )}
            </div>
          )}

          {/* Validation Errors */}
          {currentStep.validation_errors && currentStep.validation_errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-1">
              {currentStep.validation_errors.map((err, idx) => (
                <p key={idx} className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {err}
                </p>
              ))}
            </div>
          )}

          {/* Action Button */}
          <div className="flex items-center justify-between mt-6">
            <span className="text-xs text-muted-foreground">
              {selectedOptions.length > 0 && `${selectedOptions.length} selected`}
            </span>
            <Button
              onClick={handleNext}
              disabled={!canProceed() || submitting}
              size="lg"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {currentStep.can_lock ? "Lock & Finish" : "Next"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
