import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { FieldGroup, ArrayField, TableField } from "./shared";
import type { BrainDocument } from "@/lib/ai/brainDocuments";

const toneVoiceSchema = z.object({
  voice_adjectives: z.array(z.string()),
  vocabulary_swaps: z.array(z.object({
    instead_of: z.string(),
    use: z.string(),
  })),
  banned_words: z.array(z.string()),
  writing_rules: z.array(z.string()),
  example_good: z.string(),
  example_bad: z.string(),
  personality_traits: z.array(z.string()),
  communication_style: z.string(),
});

type ToneVoiceFormData = z.infer<typeof toneVoiceSchema>;

interface ToneVoiceEditorProps {
  document: BrainDocument | null;
  onSave: (data: ToneVoiceFormData) => Promise<void>;
  onClose: () => void;
  isSaving?: boolean;
}

export function ToneVoiceEditor({
  document,
  onSave,
  onClose,
  isSaving,
}: ToneVoiceEditorProps) {
  const form = useForm<ToneVoiceFormData>({
    resolver: zodResolver(toneVoiceSchema),
    defaultValues: {
      voice_adjectives: [],
      vocabulary_swaps: [],
      banned_words: [],
      writing_rules: [],
      example_good: "",
      example_bad: "",
      personality_traits: [],
      communication_style: "",
    },
  });

  // Load existing document data
  useEffect(() => {
    if (document?.content_json) {
      const content = document.content_json as Partial<ToneVoiceFormData>;
      Object.entries(content).forEach(([key, value]) => {
        if (value !== undefined) {
          form.setValue(key as keyof ToneVoiceFormData, value);
        }
      });
    }
  }, [document, form]);

  const handleSubmit = async (data: ToneVoiceFormData) => {
    await onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FieldGroup title="Voice Character" description="How your brand sounds">
          <FormField
            control={form.control}
            name="voice_adjectives"
            render={({ field }) => (
              <ArrayField
                label="Voice Adjectives"
                description="Words that describe your brand's voice (e.g., friendly, professional, bold)"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add adjective..."
                maxItems={6}
              />
            )}
          />

          <FormField
            control={form.control}
            name="personality_traits"
            render={({ field }) => (
              <ArrayField
                label="Personality Traits"
                description="Character traits your brand embodies"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add trait..."
              />
            )}
          />

          <FormField
            control={form.control}
            name="communication_style"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Communication Style</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Describe your overall communication approach..."
                    className="min-h-[80px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FieldGroup>

        <FieldGroup title="Vocabulary Guidelines" description="Words to use and avoid">
          <FormField
            control={form.control}
            name="vocabulary_swaps"
            render={({ field }) => (
              <TableField
                label="Vocabulary Swaps"
                description="Replace generic words with on-brand alternatives"
                columns={[
                  { key: "instead_of", label: "Instead of", width: "45%" },
                  { key: "use", label: "Use", width: "45%" },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />

          <FormField
            control={form.control}
            name="banned_words"
            render={({ field }) => (
              <ArrayField
                label="Banned Words"
                description="Words or phrases to never use"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add banned word..."
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="Writing Rules" description="Guidelines for content creation">
          <FormField
            control={form.control}
            name="writing_rules"
            render={({ field }) => (
              <ArrayField
                label="Writing Rules"
                description="Specific rules for how content should be written"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add rule..."
                multiline
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="Examples" description="Show what good and bad looks like">
          <FormField
            control={form.control}
            name="example_good"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Good Example</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="An example of content that matches your voice perfectly..."
                    className="min-h-[100px]"
                  />
                </FormControl>
                <FormDescription>
                  Content that exemplifies your ideal voice
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="example_bad"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bad Example</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="An example of content that doesn't match your voice..."
                    className="min-h-[100px]"
                  />
                </FormControl>
                <FormDescription>
                  Content that violates your voice guidelines
                </FormDescription>
                <FormMessage />
              </FormItem>
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
