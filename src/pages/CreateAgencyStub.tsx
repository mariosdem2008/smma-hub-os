import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { setActiveAgencyId } from "@/lib/active-agency";
import { useToast } from "@/hooks/use-toast";
import { AGENCY_BRAIN_TEMPLATE, type AgencyBrain } from "@/lib/ai/brainContracts";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type StepId = "identity" | "services" | "icp" | "tone" | "escalation" | "forbidden";

const SERVICE_OPTIONS = ["Paid social", "Organic social", "UGC", "Video editing", "Content strategy", "Email", "SEO"];
const ICP_OPTIONS = ["E-commerce", "Real estate", "Local services", "B2B SaaS", "Healthcare", "Coaches/Creators"];
const ESCALATION_OPTIONS = [
  { id: "A", label: "A) Ask clarifying question before proceeding" },
  { id: "B", label: "B) Proceed with safe assumptions, flag uncertainty" },
  { id: "C", label: "C) Stop and escalate to a human immediately" },
  { id: "D", label: "D) Provide options + risks, ask for approval" },
  { id: "custom", label: "Custom" },
] as const;

function uniqStrings(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function buildAgencyBrain(answers: Record<string, unknown>): AgencyBrain {
  const brain: AgencyBrain = structuredClone(AGENCY_BRAIN_TEMPLATE);
  const identity = (answers.identity ?? {}) as any;

  brain.identity.name = (identity.name ?? "").toString();
  brain.identity.offers = uniqStrings([...(identity.services ?? [])]);

  const icp = (answers.icp ?? {}) as any;
  brain.icp.industries = uniqStrings([...(icp.industries ?? [])]);

  const tone = (answers.tone ?? {}) as any;
  const dos = tone.dos ? [tone.dos.toString()] : [];
  const donts = tone.donts ? [tone.donts.toString()] : [];
  brain.voice_tone.writing_rules = uniqStrings([...dos, ...donts]);

  const forbidden = (answers.forbidden ?? {}) as any;
  brain.safety_policy.avoid = uniqStrings([...(forbidden.topics ?? [])]);

  const escalation = (answers.escalation ?? {}) as any;
  brain.process_rules.escalation_rules = (escalation.policy_text ?? "").toString();

  brain.raw_responses = answers as any;
  brain.inference_metadata.source = "agency_onboarding_static_v1";
  brain.inference_metadata.generated_at = new Date().toISOString();

  return brain;
}

export default function CreateAgencyStub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [brainId, setBrainId] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>("identity");

  const [identityName, setIdentityName] = useState("");
  const [identityWebsite, setIdentityWebsite] = useState("");

  const [services, setServices] = useState<string[]>([]);
  const [customService, setCustomService] = useState("");

  const [icpIndustries, setIcpIndustries] = useState<string[]>([]);
  const [customIcp, setCustomIcp] = useState("");

  const [toneDos, setToneDos] = useState("");
  const [toneDonts, setToneDonts] = useState("");

  const [escalationPolicy, setEscalationPolicy] = useState<(typeof ESCALATION_OPTIONS)[number]["id"]>("A");
  const [customEscalation, setCustomEscalation] = useState("");

  const [forbiddenInput, setForbiddenInput] = useState("");
  const [forbiddenTopics, setForbiddenTopics] = useState<string[]>([]);

  const answers = useMemo(() => {
    const escalationText =
      escalationPolicy === "custom"
        ? customEscalation.trim()
        : ESCALATION_OPTIONS.find((o) => o.id === escalationPolicy)?.label ?? "";

    return {
      identity: { name: identityName.trim(), website: identityWebsite.trim() || null, services: uniqStrings(services) },
      services: { selected: uniqStrings(services) },
      icp: { industries: uniqStrings([...icpIndustries, customIcp]) },
      tone: { dos: toneDos.trim(), donts: toneDonts.trim() },
      escalation: { policy: escalationPolicy, policy_text: escalationText },
      forbidden: { topics: uniqStrings(forbiddenTopics) },
    } as Record<string, unknown>;
  }, [
    customEscalation,
    customIcp,
    escalationPolicy,
    forbiddenTopics,
    icpIndustries,
    identityName,
    identityWebsite,
    services,
    toneDos,
    toneDonts,
  ]);

  const persistSession = async (
    nextStep: StepId,
    completed = false,
    opts?: { agencyId?: string; brainId?: string | null },
  ) => {
    if (!user?.id) throw new Error("Not authenticated");
    const targetAgencyId = opts?.agencyId ?? agencyId;
    if (!targetAgencyId) throw new Error("Agency not created");

    setSaving(true);
    try {
      const payload: any = {
        agency_id: targetAgencyId,
        user_id: user.id,
        brain_id: opts?.brainId ?? brainId,
        step_id: nextStep,
        answers_json: answers,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      };

      const { error } = await supabase.from("agency_onboarding_sessions").upsert(payload, {
        onConflict: "agency_id",
      });
      if (error) throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAgency = async () => {
    if (!user?.id) {
      toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
      return;
    }
    if (!identityName.trim()) {
      toast({ title: "Agency name required", description: "Please enter your agency name." });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_agency_with_admin", {
        _name: identityName.trim(),
        _website: identityWebsite.trim() || null,
      });
      if (error) throw error;

      const newAgencyId = data as string;
      setAgencyId(newAgencyId);
      setActiveAgencyId(newAgencyId);

      const brain = structuredClone(AGENCY_BRAIN_TEMPLATE);
      brain.identity.name = identityName.trim();
      brain.identity.offers = uniqStrings(services);
      brain.inference_metadata.source = "agency_onboarding_static_v1";
      brain.inference_metadata.generated_at = new Date().toISOString();

      const { data: brainResp, error: brainErr } = await supabase.functions.invoke("ai-brains-agency", {
        body: { action: "create", agency_id: newAgencyId, brain_json: brain },
      });
      if (brainErr) throw brainErr;

      const createdBrainId = brainResp?.brain?.id as string | undefined;
      if (createdBrainId) setBrainId(createdBrainId);

      await persistSession("identity", false, { agencyId: newAgencyId, brainId: createdBrainId ?? null });
      setStep("services");
    } catch (err: any) {
      toast({
        title: "Failed to create agency",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleNext = async (next: StepId) => {
    try {
      await persistSession(next);
      setStep(next);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const handleFinish = async () => {
    if (!agencyId || !brainId) {
      toast({ title: "Error", description: "Missing agency setup context", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const brainJson = buildAgencyBrain(answers);

      const { data: updateResp, error: updateErr } = await supabase.functions.invoke("ai-brains-agency", {
        body: { action: "update", agency_id: agencyId, brain_id: brainId, brain_json: brainJson },
      });
      if (updateErr) throw updateErr;

      const finalBrainId = (updateResp?.brain?.id as string | undefined) ?? brainId;

      const { error: lockErr } = await supabase.functions.invoke("ai-brains-agency", {
        body: { action: "lock", agency_id: agencyId, brain_id: finalBrainId },
      });
      if (lockErr) throw lockErr;

      await supabase.functions.invoke("ai-brain-ingest", {
        body: {
          scope: "agency",
          agency_id: agencyId,
          client_id: null,
          brain_id: finalBrainId,
          source: "agency_onboarding_static_v1",
          raw_responses: answers,
          followup_responses: {},
        },
      });

      await persistSession("forbidden", true);

      sessionStorage.setItem("postCreateAgencyCta", "1");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast({
        title: "Failed to complete onboarding",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleService = (label: string) => {
    setServices((prev) => (prev.includes(label) ? prev.filter((v) => v !== label) : [...prev, label]));
  };

  const toggleIcp = (label: string) => {
    setIcpIndustries((prev) => (prev.includes(label) ? prev.filter((v) => v !== label) : [...prev, label]));
  };

  const addForbidden = () => {
    const value = forbiddenInput.trim();
    if (!value) return;
    setForbiddenTopics((prev) => uniqStrings([...prev, value]));
    setForbiddenInput("");
  };

  const progressLabel = useMemo(() => {
    const map: Record<StepId, string> = {
      identity: "Agency basics",
      services: "Services",
      icp: "ICP",
      tone: "Tone rules",
      escalation: "Escalation policy",
      forbidden: "Forbidden topics",
    };
    return map[step];
  }, [step]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Create your agency</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {progressLabel} · ~6–10 minutes
          </p>
        </div>

        {step === "identity" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agencyName">Agency name</Label>
              <Input
                id="agencyName"
                value={identityName}
                onChange={(e) => setIdentityName(e.target.value)}
                placeholder="Acme Social"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agencyWebsite">Website (optional)</Label>
              <Input
                id="agencyWebsite"
                value={identityWebsite}
                onChange={(e) => setIdentityWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleCreateAgency} disabled={creating}>
                {creating ? "Creating…" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === "services" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Select the services you offer (add custom if needed).</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SERVICE_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-3 rounded-md border p-3">
                  <Checkbox checked={services.includes(opt)} onCheckedChange={() => toggleService(opt)} />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={customService}
                onChange={(e) => setCustomService(e.target.value)}
                placeholder="Add a custom service"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const v = customService.trim();
                  if (!v) return;
                  setServices((prev) => uniqStrings([...prev, v]));
                  setCustomService("");
                }}
              >
                Add
              </Button>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("identity")}>
                Back
              </Button>
              <Button onClick={() => handleNext("icp")} disabled={saving}>
                {saving ? "Saving…" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === "icp" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Who do you work best with? Select industries and add custom.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ICP_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-3 rounded-md border p-3">
                  <Checkbox checked={icpIndustries.includes(opt)} onCheckedChange={() => toggleIcp(opt)} />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customIcp">Custom ICP (optional)</Label>
              <Input
                id="customIcp"
                value={customIcp}
                onChange={(e) => setCustomIcp(e.target.value)}
                placeholder="e.g., Dental clinics"
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("services")}>
                Back
              </Button>
              <Button onClick={() => handleNext("tone")} disabled={saving}>
                {saving ? "Saving…" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === "tone" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Define your “do / don’t” tone rules for outputs.</p>

            <div className="space-y-2">
              <Label htmlFor="toneDos">Do</Label>
              <Textarea
                id="toneDos"
                value={toneDos}
                onChange={(e) => setToneDos(e.target.value)}
                placeholder="e.g., punchy, direct, use short sentences, avoid jargon"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toneDonts">Don’t</Label>
              <Textarea
                id="toneDonts"
                value={toneDonts}
                onChange={(e) => setToneDonts(e.target.value)}
                placeholder="e.g., no hype, no guarantees, no medical/legal advice"
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("icp")}>
                Back
              </Button>
              <Button onClick={() => handleNext("escalation")} disabled={saving}>
                {saving ? "Saving…" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === "escalation" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">When should the system escalate uncertainty or risk?</p>

            <RadioGroup value={escalationPolicy} onValueChange={(v) => setEscalationPolicy(v as any)}>
              {ESCALATION_OPTIONS.map((opt) => (
                <div key={opt.id} className="flex items-start gap-3 rounded-md border p-3">
                  <RadioGroupItem value={opt.id} id={`esc-${opt.id}`} />
                  <Label htmlFor={`esc-${opt.id}`} className="leading-5">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {escalationPolicy === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="customEscalation">Custom escalation policy</Label>
                <Textarea
                  id="customEscalation"
                  value={customEscalation}
                  onChange={(e) => setCustomEscalation(e.target.value)}
                  placeholder="Write your escalation rules…"
                />
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("tone")}>
                Back
              </Button>
              <Button onClick={() => handleNext("forbidden")} disabled={saving}>
                {saving ? "Saving…" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === "forbidden" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Add forbidden claims/topics (press Add to create a chip).</p>

            <div className="flex gap-2">
              <Input
                value={forbiddenInput}
                onChange={(e) => setForbiddenInput(e.target.value)}
                placeholder="e.g., guaranteed results"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addForbidden();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addForbidden}>
                Add
              </Button>
            </div>

            {forbiddenTopics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {forbiddenTopics.map((topic) => (
                  <Badge
                    key={topic}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setForbiddenTopics((prev) => prev.filter((t) => t !== topic))}
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("escalation")}>
                Back
              </Button>
              <Button onClick={handleFinish} disabled={saving}>
                {saving ? "Finishing…" : "Finish & Go to Dashboard"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
