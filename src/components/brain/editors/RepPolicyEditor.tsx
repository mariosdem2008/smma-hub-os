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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldGroup, ArrayField } from "./shared";
import type { BrainDocument } from "@/lib/ai/brainDocuments";

const repPolicySchema = z.object({
  ai_name: z.string().min(1, "AI name is required"),
  persona: z.string(),
  response_sla: z.string(),
  can_do: z.array(z.string()),
  cannot_do: z.array(z.string()),
  escalation_triggers: z.array(z.string()),
  never_say: z.array(z.string()),
  response_templates: z.array(z.string()),
  tone_guidelines: z.string(),
});

type RepPolicyFormData = z.infer<typeof repPolicySchema>;

interface RepPolicyEditorProps {
  document: BrainDocument | null;
  onSave: (data: RepPolicyFormData) => Promise<void>;
  onClose: () => void;
  isSaving?: boolean;
}

export function RepPolicyEditor({
  document,
  onSave,
  onClose,
  isSaving,
}: RepPolicyEditorProps) {
  const form = useForm<RepPolicyFormData>({
    resolver: zodResolver(repPolicySchema),
    defaultValues: {
      ai_name: "",
      persona: "",
      response_sla: "within_1_hour",
      can_do: [],
      cannot_do: [],
      escalation_triggers: [],
      never_say: [],
      response_templates: [],
      tone_guidelines: "",
    },
  });

  // Load existing document data
  useEffect(() => {
    if (document?.content_json) {
      const content = document.content_json as Partial<RepPolicyFormData>;
      Object.entries(content).forEach(([key, value]) => {
        if (value !== undefined) {
          form.setValue(key as keyof RepPolicyFormData, value);
        }
      });
    }
  }, [document, form]);

  const handleSubmit = async (data: RepPolicyFormData) => {
    await onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FieldGroup title="AI Identity" description="Who the AI represents itself as">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="ai_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI Representative Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Alex, Sam, Jordan" />
                  </FormControl>
                  <FormDescription>
                    The name the AI will use when interacting
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="response_sla"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Response SLA</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select response time" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate (AI only)</SelectItem>
                      <SelectItem value="within_1_hour">Within 1 hour</SelectItem>
                      <SelectItem value="within_4_hours">Within 4 hours</SelectItem>
                      <SelectItem value="within_24_hours">Within 24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="persona"
            render={({ field }) => (
              <FormItem>
                <FormLabel>AI Persona Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Describe how the AI should present itself - professional, friendly, expert..."
                    className="min-h-[80px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tone_guidelines"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tone Guidelines</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="How should the AI sound? Formal, casual, encouraging..."
                    className="min-h-[60px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FieldGroup>

        <FieldGroup title="Capabilities & Boundaries" description="What the AI can and cannot do">
          <FormField
            control={form.control}
            name="can_do"
            render={({ field }) => (
              <ArrayField
                label="AI Can Do"
                description="Actions and responses the AI is allowed to perform"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add capability..."
              />
            )}
          />

          <FormField
            control={form.control}
            name="cannot_do"
            render={({ field }) => (
              <ArrayField
                label="AI Cannot Do"
                description="Strictly prohibited actions"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add restriction..."
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="Escalation Rules" description="When to involve humans">
          <FormField
            control={form.control}
            name="escalation_triggers"
            render={({ field }) => (
              <ArrayField
                label="Escalation Triggers"
                description="Situations that require human intervention"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add trigger..."
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="Response Guidelines" description="How to respond in various situations">
          <FormField
            control={form.control}
            name="never_say"
            render={({ field }) => (
              <ArrayField
                label="Never Say"
                description="Phrases or statements the AI should never use"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add forbidden phrase..."
              />
            )}
          />

          <FormField
            control={form.control}
            name="response_templates"
            render={({ field }) => (
              <ArrayField
                label="Response Templates"
                description="Template responses for common situations"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add template..."
                multiline
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
