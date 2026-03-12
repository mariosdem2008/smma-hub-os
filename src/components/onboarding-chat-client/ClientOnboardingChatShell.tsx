import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AUDIENCE_TYPE_OPTIONS,
  BRAND_VOICE_OPTIONS,
  CADENCE_PRESET_OPTIONS,
  CONVERSION_PATH_OPTIONS,
  CONTENT_STYLE_OPTIONS,
  FORMAT_OPTIONS,
  INDUSTRY_NICHE_OPTIONS,
  MAIN_OBJECTION_OPTIONS,
  MARKET_SCOPE_OPTIONS,
  OFFER_PROMISE_OPTIONS,
  OFFER_SLOT_OPTIONS,
  ONBOARDING_PRIMARY_GOAL_OPTIONS,
  ON_CAMERA_OPTIONS,
  PLATFORM_OPTIONS,
  PROOF_TYPE_OPTIONS,
  RESPONSE_HANDLING_OPTIONS,
  ASSET_OPTIONS,
  SMMA_PAIN_POINT_OPTIONS,
} from "@/types/onboarding";
import type { OnboardingOffer, OnboardingProfile } from "@/types/onboarding";

type ChatCardId =
  | "business_essentials_card"
  | "market_scope_card"
  | "goal_conversion_card"
  | "offers_card"
  | "audience_card"
  | "brand_card"
  | "proof_card"
  | "channels_card"
  | "review_card";

type ChatCard = {
  id: ChatCardId;
  title: string;
  description: string;
  submitLabel: string;
  fields: string[];
  prefill?: Partial<OnboardingProfile>;
};

type ChatResponse = {
  ok: boolean;
  done: boolean;
  assistant_text: string;
  ui_card?: ChatCard;
  progress?: { required_complete: boolean; current_index: number; total_required: number; percent_complete: number };
  errors?: string[];
  next_path?: string;
};

type Message = { id: string; role: "assistant" | "user"; text: string };

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item : "")).filter(Boolean);
}

function toggleArrayValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function buildInitialFormData(card: ChatCard | null): Record<string, unknown> {
  if (!card) return {};
  const p = asRecord(card.prefill ?? {});
  if (card.id === "offers_card") {
    const offers = Array.isArray(p.offers) ? p.offers : [{ type: "best_seller", name: "", price_min: null, price_max: null, promise: "results_focused" }];
    return { offers };
  }
  if (card.id === "business_essentials_card") {
    const links = asTextArray(p.q2_social_links);
    return {
      q1_business_name: p.q1_business_name ?? "",
      industry_niche: p.industry_niche ?? "",
      q2_website: p.q2_website ?? "",
      q2_social_links: links.length > 0 ? links : [""],
    };
  }
  if (card.id === "market_scope_card") {
    return {
      q3_market_scope: p.q3_market_scope ?? "",
      q3_country: p.q3_country ?? "",
      q3_city: p.q3_city ?? "",
      q4_languages: asTextArray(p.q4_languages),
    };
  }
  if (card.id === "goal_conversion_card") {
    return {
      primary_goal: p.primary_goal ?? "",
      conversion_path: p.conversion_path ?? "",
      conversion_link: p.conversion_link ?? "",
      dm_keyword: p.dm_keyword ?? "",
    };
  }
  if (card.id === "audience_card") {
    return {
      audience_type: p.audience_type ?? "",
      primary_customer: p.primary_customer ?? "",
      main_objection: p.main_objection ?? "",
      q9_pain_points: asTextArray(p.q9_pain_points),
    };
  }
  if (card.id === "brand_card") {
    return {
      brand_voice: asTextArray(p.brand_voice),
      content_style: asTextArray(p.content_style),
      on_camera_availability: p.on_camera_availability ?? "",
      available_assets: asTextArray(p.available_assets),
    };
  }
  if (card.id === "proof_card") {
    return {
      proof_types: asTextArray(p.proof_types),
      competitor_link: p.competitor_link ?? "",
      q13_differentiators: asTextArray(p.q13_differentiators),
    };
  }
  if (card.id === "channels_card") {
    return {
      platforms: asTextArray(p.platforms),
      formats: asTextArray(p.formats),
      cadence_preset: p.cadence_preset ?? "",
      cadence_per_platform: asRecord(p.cadence_per_platform),
      response_handling: p.response_handling ?? "",
    };
  }
  return {};
}

function buildCardPayload(card: ChatCard | null, form: Record<string, unknown>): Record<string, unknown> {
  if (!card) return {};
  if (card.id === "business_essentials_card") {
    return {
      q1_business_name: form.q1_business_name,
      industry_niche: form.industry_niche,
      q2_website: form.q2_website,
      q2_social_links: asTextArray(form.q2_social_links),
    };
  }
  if (card.id === "market_scope_card") {
    return {
      q3_market_scope: form.q3_market_scope,
      q3_country: form.q3_country,
      q3_city: form.q3_city,
      q4_languages: asTextArray(form.q4_languages),
    };
  }
  if (card.id === "goal_conversion_card") {
    return {
      primary_goal: form.primary_goal,
      conversion_path: form.conversion_path,
      conversion_link: form.conversion_link,
      dm_keyword: form.dm_keyword,
    };
  }
  if (card.id === "offers_card") return { offers: Array.isArray(form.offers) ? form.offers : [] };
  if (card.id === "audience_card") {
    return {
      audience_type: form.audience_type,
      primary_customer: form.primary_customer,
      main_objection: form.main_objection,
      q9_pain_points: asTextArray(form.q9_pain_points),
    };
  }
  if (card.id === "brand_card") {
    return {
      brand_voice: asTextArray(form.brand_voice),
      content_style: asTextArray(form.content_style),
      on_camera_availability: form.on_camera_availability,
      available_assets: asTextArray(form.available_assets),
    };
  }
  if (card.id === "proof_card") {
    return {
      proof_types: asTextArray(form.proof_types),
      competitor_link: form.competitor_link,
      q13_differentiators: asTextArray(form.q13_differentiators),
    };
  }
  if (card.id === "channels_card") {
    return {
      platforms: asTextArray(form.platforms),
      formats: asTextArray(form.formats),
      cadence_preset: form.cadence_preset,
      cadence_per_platform: asRecord(form.cadence_per_platform),
      response_handling: form.response_handling,
    };
  }
  return {};
}

export function ClientOnboardingChatShell({ agencyId, clientId }: { agencyId: string; clientId: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeCard, setActiveCard] = useState<ChatCard | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [progressText, setProgressText] = useState("0%");
  const [error, setError] = useState<string | null>(null);
  const [freeform, setFreeform] = useState("");

  const addAssistantMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text }]);
  };

  const addUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
  };

  const callChat = async (payload: Record<string, unknown>) => {
    const { data, error: invokeError } = await supabase.functions.invoke("ai-onboarding-client-chat", { body: payload });
    if (invokeError) throw new Error(invokeError.message || "Onboarding request failed");
    return data as ChatResponse;
  };

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      try {
        const data = await callChat({ agency_id: agencyId, client_id: clientId, mode: "resume", turn_id: crypto.randomUUID() });
        if (!mounted) return;
        setMessages([{ id: crypto.randomUUID(), role: "assistant", text: data.assistant_text }]);
        setActiveCard(data.ui_card ?? null);
        setFormData(buildInitialFormData(data.ui_card ?? null));
        if (data.progress) setProgressText(`${data.progress.percent_complete}% complete`);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to start onboarding");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void start();
    return () => {
      mounted = false;
    };
  }, [agencyId, clientId]);

  const handleCardSubmit = async () => {
    if (!activeCard) return;
    setSubmitting(true);
    setError(null);
    try {
      addUserMessage(`Submitted: ${activeCard.title}`);
      const data = await callChat({
        agency_id: agencyId,
        client_id: clientId,
        mode: "card_submit",
        card_id: activeCard.id,
        card_payload: buildCardPayload(activeCard, formData),
        turn_id: crypto.randomUUID(),
      });
      if (!data.ok && data.errors?.length) {
        setError(data.errors.join(" "));
      }
      addAssistantMessage(data.assistant_text);
      if (data.done) {
        navigate(data.next_path || `/clients/${clientId}`);
        return;
      }
      setActiveCard(data.ui_card ?? null);
      setFormData(buildInitialFormData(data.ui_card ?? null));
      if (data.progress) setProgressText(`${data.progress.percent_complete}% complete`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit card");
    } finally {
      setSubmitting(false);
    }
  };

  const submitFreeform = async () => {
    if (!freeform.trim()) return;
    const text = freeform.trim();
    setFreeform("");
    addUserMessage(text);
    try {
      const data = await callChat({
        agency_id: agencyId,
        client_id: clientId,
        mode: "freeform",
        message: text,
        turn_id: crypto.randomUUID(),
      });
      addAssistantMessage(data.assistant_text);
      if (data.progress) setProgressText(`${data.progress.percent_complete}% complete`);
      if (data.ui_card) {
        setActiveCard(data.ui_card);
        setFormData((current) => (Object.keys(current).length ? current : buildInitialFormData(data.ui_card!)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  const offerRows = useMemo(() => {
    if (!Array.isArray(formData.offers)) return [{ type: "best_seller", name: "", price_min: "", price_max: "", promise: "results_focused" }];
    const rows = formData.offers as OnboardingOffer[];
    return rows.length > 0 ? rows : [{ type: "best_seller", name: "", price_min: null, price_max: null, promise: "results_focused" }];
  }, [formData.offers]);

  const setOfferRow = (index: number, patch: Partial<OnboardingOffer>) => {
    const next = [...offerRows];
    next[index] = { ...next[index], ...patch };
    setFormData((prev) => ({ ...prev, offers: next }));
  };

  const socialLinks = asTextArray(formData.q2_social_links);

  const setSocialLinkAt = (index: number, value: string) => {
    const next = [...socialLinks];
    while (next.length <= index) next.push("");
    next[index] = value;
    setFormData((prev) => ({ ...prev, q2_social_links: next }));
  };

  const addSocialLink = () => {
    setFormData((prev) => ({ ...prev, q2_social_links: [...asTextArray(prev.q2_social_links), ""] }));
  };

  const removeSocialLink = (index: number) => {
    const next = socialLinks.filter((_, idx) => idx !== index);
    setFormData((prev) => ({ ...prev, q2_social_links: next }));
  };

  if (loading) {
    return <div className="min-h-screen p-6 text-sm text-muted-foreground">Loading onboarding chat...</div>;
  }

  return (
    <div className="h-[calc(100vh-1rem)] overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[1.05fr_1fr]">
        <Card className="min-h-[70vh]">
          <CardHeader>
            <CardTitle>Client onboarding chat</CardTitle>
            <CardDescription>{progressText}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-[56vh] space-y-3 overflow-y-auto rounded-md border p-3">
              {messages.map((message) => (
                <div key={message.id} className={message.role === "assistant" ? "text-left" : "text-right"}>
                  <div className={message.role === "assistant" ? "inline-block rounded-lg bg-muted px-3 py-2 text-sm" : "inline-block rounded-lg bg-primary/15 px-3 py-2 text-sm"}>
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={freeform}
                onChange={(event) => setFreeform(event.target.value)}
                placeholder="Ask for help at any time..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitFreeform();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => void submitFreeform()}>
                Ask AI
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{activeCard?.title ?? "No active card"}</CardTitle>
            <CardDescription>{activeCard?.description ?? "Waiting for next step..."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">{error}</div> : null}

            {activeCard?.id === "business_essentials_card" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Business name</Label>
                  <Input value={(formData.q1_business_name as string) ?? ""} onChange={(e) => setFormData((p) => ({ ...p, q1_business_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Industry / niche</Label>
                  <Select value={(formData.industry_niche as string) ?? ""} onValueChange={(value) => setFormData((p) => ({ ...p, industry_niche: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_NICHE_OPTIONS.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Website URL (optional)</Label>
                  <Input value={(formData.q2_website as string) ?? ""} onChange={(e) => setFormData((p) => ({ ...p, q2_website: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Main social profile (required if no website)</Label>
                  <Input value={socialLinks[0] ?? ""} onChange={(e) => setSocialLinkAt(0, e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Additional social profiles (optional)</Label>
                  {socialLinks.slice(1).map((value, index) => (
                    <div key={`social-link-${index + 1}`} className="flex gap-2">
                      <Input value={value} onChange={(e) => setSocialLinkAt(index + 1, e.target.value)} />
                      <Button type="button" variant="outline" onClick={() => removeSocialLink(index + 1)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addSocialLink}>
                    Add social profile
                  </Button>
                </div>
              </div>
            )}

            {activeCard?.id === "market_scope_card" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Scope</Label>
                  <Select value={(formData.q3_market_scope as string) ?? ""} onValueChange={(value) => setFormData((p) => ({ ...p, q3_market_scope: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select scope" /></SelectTrigger>
                    <SelectContent>
                      {MARKET_SCOPE_OPTIONS.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1"><Label>Country</Label><Input value={(formData.q3_country as string) ?? ""} onChange={(e) => setFormData((p) => ({ ...p, q3_country: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>City</Label><Input value={(formData.q3_city as string) ?? ""} onChange={(e) => setFormData((p) => ({ ...p, q3_city: e.target.value }))} /></div>
                </div>
                <div className="space-y-1">
                  <Label>Languages</Label>
                  <div className="flex flex-wrap gap-2">
                    {["english", "greek", "both", "other"].map((lang) => (
                      <Button key={lang} type="button" size="sm" variant={asTextArray(formData.q4_languages).includes(lang) ? "default" : "outline"} onClick={() => setFormData((p) => ({ ...p, q4_languages: toggleArrayValue(asTextArray(p.q4_languages), lang) }))}>
                        {lang}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeCard?.id === "goal_conversion_card" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Primary goal</Label>
                  <Select value={(formData.primary_goal as string) ?? ""} onValueChange={(value) => setFormData((p) => ({ ...p, primary_goal: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
                    <SelectContent>{ONBOARDING_PRIMARY_GOAL_OPTIONS.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Conversion path</Label>
                  <Select value={(formData.conversion_path as string) ?? ""} onValueChange={(value) => setFormData((p) => ({ ...p, conversion_path: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select conversion path" /></SelectTrigger>
                    <SelectContent>{CONVERSION_PATH_OPTIONS.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Conversion link</Label><Input value={(formData.conversion_link as string) ?? ""} onChange={(e) => setFormData((p) => ({ ...p, conversion_link: e.target.value }))} /></div>
                <div className="space-y-1"><Label>DM keyword</Label><Input value={(formData.dm_keyword as string) ?? ""} onChange={(e) => setFormData((p) => ({ ...p, dm_keyword: e.target.value }))} /></div>
              </div>
            )}

            {activeCard?.id === "offers_card" && (
              <div className="space-y-3">
                {offerRows.map((offer, index) => (
                  <div key={index} className="rounded border p-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Select value={offer.type} onValueChange={(value) => setOfferRow(index, { type: value as OnboardingOffer["type"] })}>
                        <SelectTrigger><SelectValue placeholder="Offer type" /></SelectTrigger>
                        <SelectContent>{OFFER_SLOT_OPTIONS.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={(offer.promise as string) ?? ""} onValueChange={(value) => setOfferRow(index, { promise: value })}>
                        <SelectTrigger><SelectValue placeholder="Promise" /></SelectTrigger>
                        <SelectContent>{OFFER_PROMISE_OPTIONS.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input placeholder="Offer name" value={offer.name ?? ""} onChange={(e) => setOfferRow(index, { name: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Price min" type="number" value={(offer.price_min as number | null) ?? ""} onChange={(e) => setOfferRow(index, { price_min: e.target.value ? Number(e.target.value) : null })} />
                        <Input placeholder="Price max" type="number" value={(offer.price_max as number | null) ?? ""} onChange={(e) => setOfferRow(index, { price_max: e.target.value ? Number(e.target.value) : null })} />
                      </div>
                    </div>
                  </div>
                ))}
                {offerRows.length < 3 && <Button type="button" variant="outline" onClick={() => setFormData((p) => ({ ...p, offers: [...offerRows, { type: "starter_offer", name: "", price_min: null, price_max: null, promise: "results_focused" }] }))}>Add offer</Button>}
              </div>
            )}

            {activeCard?.id === "audience_card" && (
              <div className="space-y-3">
                <Select value={(formData.audience_type as string) ?? ""} onValueChange={(value) => setFormData((p) => ({ ...p, audience_type: value }))}>
                  <SelectTrigger><SelectValue placeholder="Audience type" /></SelectTrigger>
                  <SelectContent>{AUDIENCE_TYPE_OPTIONS.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Primary customer" value={(formData.primary_customer as string) ?? ""} onChange={(e) => setFormData((p) => ({ ...p, primary_customer: e.target.value }))} />
                <Select value={(formData.main_objection as string) ?? ""} onValueChange={(value) => setFormData((p) => ({ ...p, main_objection: value }))}>
                  <SelectTrigger><SelectValue placeholder="Main objection" /></SelectTrigger>
                  <SelectContent>{MAIN_OBJECTION_OPTIONS.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
                <div>
                  <Label>Pain points (pick 3)</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SMMA_PAIN_POINT_OPTIONS.map((opt) => (
                      <Button key={opt.id} type="button" size="sm" variant={asTextArray(formData.q9_pain_points).includes(opt.label) ? "default" : "outline"} onClick={() => setFormData((p) => ({ ...p, q9_pain_points: toggleArrayValue(asTextArray(p.q9_pain_points), opt.label).slice(0, 3) }))}>
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeCard?.id === "brand_card" && (
              <div className="space-y-3">
                <div>
                  <Label>Brand voice</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {BRAND_VOICE_OPTIONS.map((opt) => <Button key={opt.id} type="button" size="sm" variant={asTextArray(formData.brand_voice).includes(opt.id) ? "default" : "outline"} onClick={() => setFormData((p) => ({ ...p, brand_voice: toggleArrayValue(asTextArray(p.brand_voice), opt.id) }))}>{opt.label}</Button>)}
                  </div>
                </div>
                <div>
                  <Label>Content style</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CONTENT_STYLE_OPTIONS.map((opt) => <Button key={opt.id} type="button" size="sm" variant={asTextArray(formData.content_style).includes(opt.id) ? "default" : "outline"} onClick={() => setFormData((p) => ({ ...p, content_style: toggleArrayValue(asTextArray(p.content_style), opt.id) }))}>{opt.label}</Button>)}
                  </div>
                </div>
                <Select value={(formData.on_camera_availability as string) ?? ""} onValueChange={(value) => setFormData((p) => ({ ...p, on_camera_availability: value }))}>
                  <SelectTrigger><SelectValue placeholder="On-camera availability" /></SelectTrigger>
                  <SelectContent>{ON_CAMERA_OPTIONS.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
                <div>
                  <Label>Available assets</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ASSET_OPTIONS.map((opt) => <Button key={opt.id} type="button" size="sm" variant={asTextArray(formData.available_assets).includes(opt.id) ? "default" : "outline"} onClick={() => setFormData((p) => ({ ...p, available_assets: toggleArrayValue(asTextArray(p.available_assets), opt.id) }))}>{opt.label}</Button>)}
                  </div>
                </div>
              </div>
            )}

            {activeCard?.id === "proof_card" && (
              <div className="space-y-3">
                <div>
                  <Label>Proof types</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PROOF_TYPE_OPTIONS.map((opt) => <Button key={opt.id} type="button" size="sm" variant={asTextArray(formData.proof_types).includes(opt.id) ? "default" : "outline"} onClick={() => setFormData((p) => ({ ...p, proof_types: toggleArrayValue(asTextArray(p.proof_types), opt.id) }))}>{opt.label}</Button>)}
                  </div>
                </div>
                <Input placeholder="Competitor link" value={(formData.competitor_link as string) ?? ""} onChange={(e) => setFormData((p) => ({ ...p, competitor_link: e.target.value }))} />
                <div>
                  <Label>Differentiators (optional, one per line)</Label>
                  <Textarea value={asTextArray(formData.q13_differentiators).join("\n")} onChange={(e) => setFormData((p) => ({ ...p, q13_differentiators: e.target.value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean) }))} />
                </div>
              </div>
            )}

            {activeCard?.id === "channels_card" && (
              <div className="space-y-3">
                <div>
                  <Label>Platforms</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PLATFORM_OPTIONS.map((opt) => <Button key={opt.id} type="button" size="sm" variant={asTextArray(formData.platforms).includes(opt.id) ? "default" : "outline"} onClick={() => setFormData((p) => ({ ...p, platforms: toggleArrayValue(asTextArray(p.platforms), opt.id) }))}>{opt.label}</Button>)}
                  </div>
                </div>
                <div>
                  <Label>Formats</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {FORMAT_OPTIONS.map((opt) => <Button key={opt.id} type="button" size="sm" variant={asTextArray(formData.formats).includes(opt.id) ? "default" : "outline"} onClick={() => setFormData((p) => ({ ...p, formats: toggleArrayValue(asTextArray(p.formats), opt.id) }))}>{opt.label}</Button>)}
                  </div>
                </div>
                <Select value={(formData.cadence_preset as string) ?? ""} onValueChange={(value) => setFormData((p) => ({ ...p, cadence_preset: value }))}>
                  <SelectTrigger><SelectValue placeholder="Cadence preset" /></SelectTrigger>
                  <SelectContent>{CADENCE_PRESET_OPTIONS.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
                {(formData.cadence_preset as string) === "custom" && (
                  <div className="space-y-2 rounded border p-2">
                    {asTextArray(formData.platforms).map((platform) => (
                      <div key={platform} className="grid grid-cols-[1fr_100px] items-center gap-2">
                        <span className="text-sm capitalize">{platform.replace("_", " ")}</span>
                        <Input
                          type="number"
                          value={(asRecord(formData.cadence_per_platform)[platform] as number | undefined) ?? ""}
                          onChange={(e) => {
                            const next = asRecord(formData.cadence_per_platform);
                            next[platform] = e.target.value ? Number(e.target.value) : 0;
                            setFormData((p) => ({ ...p, cadence_per_platform: next }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <Select value={(formData.response_handling as string) ?? ""} onValueChange={(value) => setFormData((p) => ({ ...p, response_handling: value }))}>
                  <SelectTrigger><SelectValue placeholder="Response handling (optional)" /></SelectTrigger>
                  <SelectContent>{RESPONSE_HANDLING_OPTIONS.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {activeCard?.id === "review_card" && (
              <div className="rounded border bg-muted/20 p-3 text-sm">
                Review all captured onboarding data, then generate strategy.
              </div>
            )}

            <Button type="button" onClick={() => void handleCardSubmit()} disabled={!activeCard || submitting} className="w-full">
              {submitting ? "Saving..." : activeCard?.submitLabel ?? "Continue"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
