import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FieldGroup, ArrayField, TableField } from "./shared";
import type { BrainDocument } from "@/lib/ai/brainDocuments";

const qualityBarSchema = z.object({
  review_criteria: z.array(z.object({
    criterion: z.string(),
    weight: z.string(),
    description: z.string(),
  })),
  minimum_score: z.string(),
  critical_criteria: z.array(z.string()),
  non_negotiables: z.array(z.string()),
  revision_policy: z.object({
    max_rounds: z.string(),
    turnaround: z.string(),
  }),
  escalation_triggers: z.array(z.object({
    trigger: z.string(),
    escalate_to: z.string(),
    action: z.string(),
  })),
  qa_steps: z.array(z.string()),
});

type QualityBarFormData = z.infer<typeof qualityBarSchema>;

interface QualityBarEditorProps {
  document: BrainDocument | null;
  onSave: (data: QualityBarFormData) => Promise<void>;
  onClose: () => void;
  isSaving?: boolean;
}

export function QualityBarEditor({
  document,
  onSave,
  onClose,
  isSaving,
}: QualityBarEditorProps) {
  const form = useForm<QualityBarFormData>({
    resolver: zodResolver(qualityBarSchema),
    defaultValues: {
      review_criteria: [],
      minimum_score: "80",
      critical_criteria: [],
      non_negotiables: [],
      revision_policy: { max_rounds: "3", turnaround: "24 hours" },
      escalation_triggers: [],
      qa_steps: [],
    },
  });

  useEffect(() => {
    if (document?.content_json) {
      const content = document.content_json as Partial<QualityBarFormData>;
      Object.entries(content).forEach(([key, value]) => {
        if (value !== undefined) {
          form.setValue(key as keyof QualityBarFormData, value);
        }
      });
    }
  }, [document, form]);

  const handleSubmit = async (data: QualityBarFormData) => {
    await onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FieldGroup title="Review Criteria" description="What gets evaluated">
          <FormField
            control={form.control}
            name="review_criteria"
            render={({ field }) => (
              <TableField
                label="Quality Checklist"
                description="Criteria for evaluating content quality"
                columns={[
                  { key: "criterion", label: "Criterion", width: "30%" },
                  { key: "weight", label: "Weight %", width: "15%" },
                  { key: "description", label: "Description", width: "50%" },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="Acceptance Threshold" description="Minimum standards">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="minimum_score"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Overall Score (%)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min="0" max="100" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="critical_criteria"
            render={({ field }) => (
              <ArrayField
                label="Critical Criteria"
                description="Criteria that must always pass"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add critical criterion..."
              />
            )}
          />

          <FormField
            control={form.control}
            name="non_negotiables"
            render={({ field }) => (
              <ArrayField
                label="Non-Negotiables"
                description="Elements that must always be present"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add non-negotiable..."
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="Revision Policy" description="How revisions are handled">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="revision_policy.max_rounds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum Revision Rounds</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min="1" max="10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="revision_policy.turnaround"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Turnaround Time</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., 24 hours" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FieldGroup>

        <FieldGroup title="Escalation Triggers" description="When to escalate issues">
          <FormField
            control={form.control}
            name="escalation_triggers"
            render={({ field }) => (
              <TableField
                label="Escalation Matrix"
                description="Situations requiring escalation"
                columns={[
                  { key: "trigger", label: "Trigger", width: "35%" },
                  { key: "escalate_to", label: "Escalate To", width: "25%" },
                  { key: "action", label: "Action", width: "35%" },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="QA Process" description="Quality assurance steps">
          <FormField
            control={form.control}
            name="qa_steps"
            render={({ field }) => (
              <ArrayField
                label="QA Steps"
                description="Steps in your quality assurance process"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add QA step..."
              />
            )}
          />
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
    </Form>
  );
}
