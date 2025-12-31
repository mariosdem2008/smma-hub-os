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
import { FieldGroup, ArrayField, TableField } from "./shared";
import type { BrainDocument } from "@/lib/ai/brainDocuments";

const offerStackSchema = z.object({
  positioning_statement: z.string(),
  one_liner: z.string(),
  elevator_pitch: z.string(),
  unique_selling_points: z.array(z.object({
    usp: z.string(),
    meaning: z.string(),
    importance: z.string(),
  })),
  pricing_tiers: z.array(z.object({
    name: z.string(),
    price: z.string(),
    features: z.string(),
  })),
  add_ons: z.array(z.object({
    name: z.string(),
    price: z.string(),
    description: z.string(),
  })),
  guarantee: z.string(),
  target_outcomes: z.array(z.string()),
});

type OfferStackFormData = z.infer<typeof offerStackSchema>;

interface OfferStackEditorProps {
  document: BrainDocument | null;
  onSave: (data: OfferStackFormData) => Promise<void>;
  onClose: () => void;
  isSaving?: boolean;
}

export function OfferStackEditor({
  document,
  onSave,
  onClose,
  isSaving,
}: OfferStackEditorProps) {
  const form = useForm<OfferStackFormData>({
    resolver: zodResolver(offerStackSchema),
    defaultValues: {
      positioning_statement: "",
      one_liner: "",
      elevator_pitch: "",
      unique_selling_points: [],
      pricing_tiers: [],
      add_ons: [],
      guarantee: "",
      target_outcomes: [],
    },
  });

  useEffect(() => {
    if (document?.content_json) {
      const content = document.content_json as Partial<OfferStackFormData>;
      Object.entries(content).forEach(([key, value]) => {
        if (value !== undefined) {
          form.setValue(key as keyof OfferStackFormData, value);
        }
      });
    }
  }, [document, form]);

  const handleSubmit = async (data: OfferStackFormData) => {
    await onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FieldGroup title="Positioning" description="How you position your offering">
          <FormField
            control={form.control}
            name="positioning_statement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Positioning Statement</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="We help [audience] achieve [outcome] through [method]..."
                    className="min-h-[80px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="one_liner"
            render={({ field }) => (
              <FormItem>
                <FormLabel>One-Liner</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Your memorable tagline or one-liner" />
                </FormControl>
                <FormDescription>A concise, memorable summary</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="elevator_pitch"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Elevator Pitch</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Your 30-second pitch..."
                    className="min-h-[100px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FieldGroup>

        <FieldGroup title="Unique Selling Points" description="What makes you different">
          <FormField
            control={form.control}
            name="unique_selling_points"
            render={({ field }) => (
              <TableField
                label="USPs"
                description="Your unique selling points and why they matter"
                columns={[
                  { key: "usp", label: "USP", width: "30%" },
                  { key: "meaning", label: "What It Means", width: "35%" },
                  { key: "importance", label: "Why It Matters", width: "30%" },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="Pricing Tiers" description="Your service packages">
          <FormField
            control={form.control}
            name="pricing_tiers"
            render={({ field }) => (
              <TableField
                label="Service Tiers"
                description="Your main pricing tiers"
                columns={[
                  { key: "name", label: "Tier Name", width: "25%" },
                  { key: "price", label: "Price", width: "20%" },
                  { key: "features", label: "Key Features", width: "50%" },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="Add-Ons" description="Additional services">
          <FormField
            control={form.control}
            name="add_ons"
            render={({ field }) => (
              <TableField
                label="Available Add-Ons"
                description="Optional services clients can add"
                columns={[
                  { key: "name", label: "Add-On", width: "25%" },
                  { key: "price", label: "Price", width: "20%" },
                  { key: "description", label: "Description", width: "50%" },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="Guarantee & Outcomes" description="What clients can expect">
          <FormField
            control={form.control}
            name="guarantee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Guarantee</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Your guarantee or promise to clients..."
                    className="min-h-[80px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="target_outcomes"
            render={({ field }) => (
              <ArrayField
                label="Target Outcomes"
                description="Results clients can expect"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add expected outcome..."
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
