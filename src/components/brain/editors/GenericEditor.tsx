import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldGroup, ArrayField } from "./shared";
import type { BrainDocument } from "@/lib/ai/brainDocuments";
import type { BrainModule } from "@/lib/ai/brainModules";

interface GenericEditorProps {
  module: BrainModule;
  document: BrainDocument | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  isSaving?: boolean;
}

// Field configurations for each module
const MODULE_FIELDS: Record<BrainModule, { key: string; label: string; type: "text" | "textarea" | "array" }[]> = {
  bootstrap: [
    { key: "agency_name", label: "Agency Name", type: "text" },
    { key: "niche", label: "Niche", type: "text" },
    { key: "website", label: "Website", type: "text" },
    { key: "positioning", label: "Positioning Statement", type: "textarea" },
    { key: "services", label: "Services", type: "array" },
  ],
  rep_policy: [
    { key: "ai_name", label: "AI Name", type: "text" },
    { key: "persona", label: "Persona Description", type: "textarea" },
    { key: "can_do", label: "AI Can Do", type: "array" },
    { key: "cannot_do", label: "AI Cannot Do", type: "array" },
    { key: "escalation_triggers", label: "Escalation Triggers", type: "array" },
  ],
  sop_strategy: [
    { key: "content_pillars", label: "Content Pillars", type: "array" },
    { key: "process_phases", label: "Process Phases", type: "array" },
    { key: "platform_priorities", label: "Platform Priorities", type: "array" },
    { key: "planning_cadence", label: "Planning Cadence", type: "textarea" },
  ],
  sop_scripting: [
    { key: "hook_templates", label: "Hook Templates", type: "array" },
    { key: "cta_templates", label: "CTA Templates", type: "array" },
    { key: "format_guidelines", label: "Format Guidelines", type: "textarea" },
    { key: "quality_checklist", label: "Quality Checklist", type: "array" },
  ],
  tone_voice: [
    { key: "voice_adjectives", label: "Voice Adjectives", type: "array" },
    { key: "banned_words", label: "Banned Words", type: "array" },
    { key: "writing_rules", label: "Writing Rules", type: "array" },
    { key: "communication_style", label: "Communication Style", type: "textarea" },
  ],
  faq_objections: [
    { key: "faqs", label: "Frequently Asked Questions", type: "array" },
    { key: "objections", label: "Common Objections", type: "array" },
    { key: "response_framework", label: "Response Framework", type: "textarea" },
  ],
  ai_permissions: [
    { key: "read_permissions", label: "Read Permissions", type: "array" },
    { key: "write_permissions", label: "Write Permissions", type: "array" },
    { key: "safety_rules", label: "Safety Rules", type: "array" },
    { key: "data_boundaries", label: "Data Boundaries", type: "array" },
  ],
  offer_stack: [
    { key: "positioning_statement", label: "Positioning Statement", type: "textarea" },
    { key: "one_liner", label: "One-Liner", type: "text" },
    { key: "unique_selling_points", label: "Unique Selling Points", type: "array" },
    { key: "guarantee", label: "Guarantee", type: "textarea" },
  ],
  quality_bar: [
    { key: "minimum_score", label: "Minimum Score %", type: "text" },
    { key: "critical_criteria", label: "Critical Criteria", type: "array" },
    { key: "non_negotiables", label: "Non-Negotiables", type: "array" },
    { key: "qa_steps", label: "QA Steps", type: "array" },
  ],
};

export function GenericEditor({
  module,
  document,
  onSave,
  onClose,
  isSaving,
}: GenericEditorProps) {
  const fields = MODULE_FIELDS[module] || [];
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (document?.content_json) {
      setFormData(document.content_json as Record<string, unknown>);
    } else {
      // Initialize with empty values
      const initial: Record<string, unknown> = {};
      fields.forEach((field) => {
        initial[field.key] = field.type === "array" ? [] : "";
      });
      setFormData(initial);
    }
  }, [document, fields]);

  const handleFieldChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FieldGroup title="Configuration" description="Configure this brain module">
        <div className="space-y-4">
          {fields.map((field) => {
            const value = formData[field.key];

            if (field.type === "array") {
              return (
                <ArrayField
                  key={field.key}
                  label={field.label}
                  value={Array.isArray(value) ? value : []}
                  onChange={(v) => handleFieldChange(field.key, v)}
                  placeholder={`Add ${field.label.toLowerCase()}...`}
                />
              );
            }

            if (field.type === "textarea") {
              return (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Textarea
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                    className="min-h-[80px]"
                  />
                </div>
              );
            }

            return (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <input
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                />
              </div>
            );
          })}
        </div>
      </FieldGroup>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
