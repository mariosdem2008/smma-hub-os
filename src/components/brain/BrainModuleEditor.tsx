import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { BrainModule } from "@/lib/ai/brainModules";
import type { BrainDocument, BrainDocumentContent } from "@/lib/ai/brainDocuments";
import { DEFAULT_CONTENT, getDefaultContent } from "@/lib/ai/brainDocuments";
import { BRAIN_MODULE_LABELS } from "@/lib/ai/brainModules";
import {
  useCreateBrainDocumentDraft,
  useUpdateBrainDocument,
} from "@/hooks/useBrainDocuments";

interface BrainModuleEditorProps {
  module: BrainModule;
  document: BrainDocument | null;
  onClose: () => void;
}

export function BrainModuleEditor({ module, document, onClose }: BrainModuleEditorProps) {
  const [content, setContent] = useState<BrainDocumentContent>(
    document?.content_json ?? getDefaultContent(module)
  );
  const [changeSummary, setChangeSummary] = useState("");

  const createDraft = useCreateBrainDocumentDraft();
  const updateDocument = useUpdateBrainDocument();

  const isLoading = createDraft.isPending || updateDocument.isPending;

  // Reset content when document changes
  useEffect(() => {
    setContent(document?.content_json ?? getDefaultContent(module));
  }, [document, module]);

  const handleSave = async () => {
    try {
      if (document) {
        await updateDocument.mutateAsync({
          documentId: document.id,
          contentJson: content,
          changeSummary: changeSummary || undefined,
        });
      } else {
        await createDraft.mutateAsync({
          module,
          title: BRAIN_MODULE_LABELS[module],
          contentJson: content,
          source: "manual",
        });
      }
      onClose();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  // Helper to update nested content
  const updateField = (path: string, value: unknown) => {
    const keys = path.split(".");
    setContent((prev) => {
      const newContent = { ...prev };
      let current: Record<string, unknown> = newContent;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;
      return newContent;
    });
  };

  // Helper to get nested value
  const getField = (path: string): unknown => {
    const keys = path.split(".");
    let current: unknown = content;
    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return current;
  };

  // Render different editors based on module type
  const renderEditor = () => {
    switch (module) {
      case "rep_policy":
        return <RepPolicyEditor content={content} updateField={updateField} getField={getField} />;
      case "tone_voice":
        return <ToneVoiceEditor content={content} updateField={updateField} getField={getField} />;
      case "faq_objections":
        return <FaqEditor content={content} updateField={updateField} getField={getField} />;
      case "ai_permissions":
        return <PermissionsEditor content={content} updateField={updateField} getField={getField} />;
      case "sop_strategy":
      case "sop_scripting":
        return <SopEditor content={content} updateField={updateField} getField={getField} module={module} />;
      case "offer_stack":
        return <OfferStackEditor content={content} updateField={updateField} getField={getField} />;
      case "quality_bar":
        return <QualityBarEditor content={content} updateField={updateField} getField={getField} />;
      default:
        return <GenericEditor content={content} updateField={updateField} />;
    }
  };

  return (
    <div className="space-y-6">
      {renderEditor()}

      <Separator />

      {/* Change summary */}
      <div className="space-y-2">
        <Label htmlFor="changeSummary">Change Summary (optional)</Label>
        <Input
          id="changeSummary"
          placeholder="Briefly describe your changes..."
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="h-4 w-4 mr-1" />
          {isLoading ? "Saving..." : "Save Draft"}
        </Button>
      </div>
    </div>
  );
}

// Helper component for string array fields
function StringArrayField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const addItem = () => {
    if (inputValue.trim()) {
      onChange([...value, inputValue.trim()]);
      setInputValue("");
    }
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
        />
        <Button type="button" variant="outline" size="icon" onClick={addItem}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {value.map((item, index) => (
          <Badge key={index} variant="secondary" className="flex items-center gap-1">
            {item}
            <button onClick={() => removeItem(index)} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

// Editor types
interface EditorProps {
  content: BrainDocumentContent;
  updateField: (path: string, value: unknown) => void;
  getField: (path: string) => unknown;
}

// Rep Policy Editor
function RepPolicyEditor({ updateField, getField }: EditorProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>AI Assistant Name</Label>
          <Input
            value={(getField("ai_name") as string) ?? ""}
            onChange={(e) => updateField("ai_name", e.target.value)}
            placeholder="e.g., Agency Assistant"
          />
        </div>
        <div className="space-y-2">
          <Label>Response SLA</Label>
          <Input
            value={(getField("response_sla") as string) ?? ""}
            onChange={(e) => updateField("response_sla", e.target.value)}
            placeholder="e.g., Within 2 hours"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Persona Description</Label>
        <Textarea
          value={(getField("persona_description") as string) ?? ""}
          onChange={(e) => updateField("persona_description", e.target.value)}
          placeholder="Describe how the AI should present itself..."
          rows={3}
        />
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-6">
        <StringArrayField
          label="Can Do (Capabilities)"
          value={(getField("boundaries.can_do") as string[]) ?? []}
          onChange={(v) => updateField("boundaries.can_do", v)}
          placeholder="Add a capability..."
        />
        <StringArrayField
          label="Cannot Do (Boundaries)"
          value={(getField("boundaries.cannot_do") as string[]) ?? []}
          onChange={(v) => updateField("boundaries.cannot_do", v)}
          placeholder="Add a boundary..."
        />
      </div>

      <div className="space-y-2">
        <Label>Escalation Rule</Label>
        <Textarea
          value={(getField("boundaries.escalation_rule") as string) ?? ""}
          onChange={(e) => updateField("boundaries.escalation_rule", e.target.value)}
          placeholder="When should the AI escalate to a human?"
          rows={2}
        />
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-6">
        <StringArrayField
          label="Never Say (Phrases to Avoid)"
          value={(getField("never_say") as string[]) ?? []}
          onChange={(v) => updateField("never_say", v)}
          placeholder="Add a phrase to avoid..."
        />
        <StringArrayField
          label="Never Do (Forbidden Actions)"
          value={(getField("never_do") as string[]) ?? []}
          onChange={(v) => updateField("never_do", v)}
          placeholder="Add a forbidden action..."
        />
      </div>
    </div>
  );
}

// Tone & Voice Editor
function ToneVoiceEditor({ updateField, getField }: EditorProps) {
  return (
    <div className="space-y-6">
      <StringArrayField
        label="Voice Adjectives"
        value={(getField("adjectives") as string[]) ?? []}
        onChange={(v) => updateField("adjectives", v)}
        placeholder="e.g., Professional, Friendly, Confident"
      />

      <StringArrayField
        label="Preferred Vocabulary"
        value={(getField("preferred_vocab") as string[]) ?? []}
        onChange={(v) => updateField("preferred_vocab", v)}
        placeholder="Words to prefer..."
      />

      <StringArrayField
        label="Banned Words"
        value={(getField("banned_words") as string[]) ?? []}
        onChange={(v) => updateField("banned_words", v)}
        placeholder="Words to avoid..."
      />

      <StringArrayField
        label="Writing Rules"
        value={(getField("writing_rules") as string[]) ?? []}
        onChange={(v) => updateField("writing_rules", v)}
        placeholder="e.g., Use active voice, Keep sentences short"
      />
    </div>
  );
}

// FAQ Editor
function FaqEditor({ content, updateField, getField }: EditorProps) {
  const faqs = (getField("faqs") as Array<{ question: string; answer: string }>) ?? [];

  const addFaq = () => {
    updateField("faqs", [...faqs, { question: "", answer: "" }]);
  };

  const updateFaq = (index: number, field: "question" | "answer", value: string) => {
    const updated = faqs.map((faq, i) => (i === index ? { ...faq, [field]: value } : faq));
    updateField("faqs", updated);
  };

  const removeFaq = (index: number) => {
    updateField("faqs", faqs.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label>Frequently Asked Questions</Label>
        <Button type="button" variant="outline" size="sm" onClick={addFaq}>
          <Plus className="h-4 w-4 mr-1" />
          Add FAQ
        </Button>
      </div>

      {faqs.map((faq, index) => (
        <div key={index} className="border rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm font-medium">FAQ #{index + 1}</span>
            <Button variant="ghost" size="icon" onClick={() => removeFaq(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <Input
            placeholder="Question..."
            value={faq.question}
            onChange={(e) => updateFaq(index, "question", e.target.value)}
          />
          <Textarea
            placeholder="Answer..."
            value={faq.answer}
            onChange={(e) => updateFaq(index, "answer", e.target.value)}
            rows={2}
          />
        </div>
      ))}

      {faqs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No FAQs added yet. Click "Add FAQ" to create one.
        </p>
      )}
    </div>
  );
}

// Permissions Editor
function PermissionsEditor({ updateField, getField }: EditorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium mb-4">Read Permissions</h4>
        <div className="space-y-3">
          {[
            { key: "client_summary", label: "Client summaries and profiles" },
            { key: "pipeline", label: "Content pipeline status" },
            { key: "calendar", label: "Content calendar and schedules" },
            { key: "analytics", label: "Performance analytics" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={(getField(`read_scopes.${key}`) as boolean) ?? false}
                onCheckedChange={(checked) => updateField(`read_scopes.${key}`, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-4">Write Permissions</h4>
        <div className="space-y-3">
          {[
            { key: "create_drafts", label: "Create content drafts" },
            { key: "propose_brain_updates", label: "Propose brain updates" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={(getField(`write_scopes.${key}`) as boolean) ?? false}
                onCheckedChange={(checked) => updateField(`write_scopes.${key}`, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-4">Safety Rules</h4>
        <div className="space-y-3">
          {[
            { key: "require_external_confirmation", label: "Require confirmation for external actions" },
            { key: "no_guarantee_promises", label: "Never promise specific outcomes" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={(getField(`safety_scopes.${key}`) as boolean) ?? true}
                onCheckedChange={(checked) => updateField(`safety_scopes.${key}`, checked)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// SOP Editor
function SopEditor({ updateField, getField, module }: EditorProps & { module: BrainModule }) {
  const isStrategy = module === "sop_strategy";

  return (
    <div className="space-y-6">
      <StringArrayField
        label={isStrategy ? "Strategy Pillars" : "Hook Templates"}
        value={(getField(isStrategy ? "pillars" : "hook_templates") as string[]) ?? []}
        onChange={(v) => updateField(isStrategy ? "pillars" : "hook_templates", v)}
        placeholder={isStrategy ? "Add a content pillar..." : "Add a hook template..."}
      />

      <StringArrayField
        label={isStrategy ? "Strategy Process Steps" : "CTA Templates"}
        value={(getField(isStrategy ? "strategy_process" : "cta_templates") as string[]) ?? []}
        onChange={(v) => updateField(isStrategy ? "strategy_process" : "cta_templates", v)}
        placeholder={isStrategy ? "Add a process step..." : "Add a CTA template..."}
      />

      {isStrategy ? (
        <>
          <StringArrayField
            label="Platform Priorities"
            value={(getField("platform_priorities") as string[]) ?? []}
            onChange={(v) => updateField("platform_priorities", v)}
            placeholder="e.g., Instagram, LinkedIn, TikTok"
          />
          <div className="space-y-2">
            <Label>Planning Cadence</Label>
            <Input
              value={(getField("planning_cadence") as string) ?? ""}
              onChange={(e) => updateField("planning_cadence", e.target.value)}
              placeholder="e.g., Weekly strategy reviews"
            />
          </div>
        </>
      ) : (
        <>
          <StringArrayField
            label="Quality Checklist"
            value={(getField("quality_checklist") as string[]) ?? []}
            onChange={(v) => updateField("quality_checklist", v)}
            placeholder="Add a quality check..."
          />
          <div className="space-y-2">
            <Label>Revision Rules</Label>
            <Textarea
              value={(getField("revision_rules") as string) ?? ""}
              onChange={(e) => updateField("revision_rules", e.target.value)}
              placeholder="Describe revision policies..."
              rows={2}
            />
          </div>
        </>
      )}
    </div>
  );
}

// Offer Stack Editor
function OfferStackEditor({ content, updateField, getField }: EditorProps) {
  const tiers = (getField("tiers") as Array<{ name: string; price: string; description: string; features: string[] }>) ?? [];

  const addTier = () => {
    updateField("tiers", [...tiers, { name: "", price: "", description: "", features: [] }]);
  };

  const updateTier = (index: number, field: string, value: unknown) => {
    const updated = tiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier));
    updateField("tiers", updated);
  };

  const removeTier = (index: number) => {
    updateField("tiers", tiers.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Positioning Statement</Label>
        <Textarea
          value={(getField("positioning") as string) ?? ""}
          onChange={(e) => updateField("positioning", e.target.value)}
          placeholder="How do you position your agency?"
          rows={2}
        />
      </div>

      <StringArrayField
        label="Unique Selling Points"
        value={(getField("usps") as string[]) ?? []}
        onChange={(v) => updateField("usps", v)}
        placeholder="Add a USP..."
      />

      <Separator />

      <div className="flex justify-between items-center">
        <Label>Pricing Tiers</Label>
        <Button type="button" variant="outline" size="sm" onClick={addTier}>
          <Plus className="h-4 w-4 mr-1" />
          Add Tier
        </Button>
      </div>

      {tiers.map((tier, index) => (
        <div key={index} className="border rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Tier #{index + 1}</span>
            <Button variant="ghost" size="icon" onClick={() => removeTier(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Tier name..."
              value={tier.name}
              onChange={(e) => updateTier(index, "name", e.target.value)}
            />
            <Input
              placeholder="Price..."
              value={tier.price}
              onChange={(e) => updateTier(index, "price", e.target.value)}
            />
          </div>
          <Textarea
            placeholder="Description..."
            value={tier.description}
            onChange={(e) => updateTier(index, "description", e.target.value)}
            rows={2}
          />
        </div>
      ))}
    </div>
  );
}

// Quality Bar Editor
function QualityBarEditor({ updateField, getField }: EditorProps) {
  return (
    <div className="space-y-6">
      <StringArrayField
        label="Review Criteria"
        value={(getField("review_criteria") as string[]) ?? []}
        onChange={(v) => updateField("review_criteria", v)}
        placeholder="Add a review criterion..."
      />

      <div className="space-y-2">
        <Label>Acceptance Threshold</Label>
        <Input
          value={(getField("acceptance_threshold") as string) ?? ""}
          onChange={(e) => updateField("acceptance_threshold", e.target.value)}
          placeholder="e.g., 80% of criteria must pass"
        />
      </div>

      <div className="space-y-2">
        <Label>Revision Limit</Label>
        <Input
          type="number"
          value={(getField("revision_limits") as number) ?? 3}
          onChange={(e) => updateField("revision_limits", parseInt(e.target.value) || 3)}
        />
      </div>

      <StringArrayField
        label="Escalation Triggers"
        value={(getField("escalation_triggers") as string[]) ?? []}
        onChange={(v) => updateField("escalation_triggers", v)}
        placeholder="Add an escalation trigger..."
      />
    </div>
  );
}

// Generic Editor (fallback)
function GenericEditor({ content, updateField }: { content: BrainDocumentContent; updateField: (path: string, value: unknown) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Edit the raw JSON content for this module:
      </p>
      <Textarea
        value={JSON.stringify(content, null, 2)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            Object.keys(parsed).forEach((key) => updateField(key, parsed[key]));
          } catch {
            // Invalid JSON, ignore
          }
        }}
        rows={15}
        className="font-mono text-sm"
      />
    </div>
  );
}
