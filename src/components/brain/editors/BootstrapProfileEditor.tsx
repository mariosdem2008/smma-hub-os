import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FieldGroup, ArrayField } from "./shared";
import { useAgencyData } from "@/hooks/useAgencyData";
import type { BrainDocument } from "@/lib/ai/brainDocuments";

const bootstrapSchema = z.object({
  agency_name: z.string().min(1, "Agency name is required"),
  niche: z.string().min(1, "Niche is required"),
  website: z.string().url("Must be a valid URL").or(z.string().length(0)),
  positioning: z.string(),
  services: z.array(z.string()),
  ideal_client_profile: z.string(),
  pain_points: z.array(z.string()),
  unique_value_proposition: z.string(),
  target_industries: z.array(z.string()),
});

type BootstrapFormData = z.infer<typeof bootstrapSchema>;

interface BootstrapProfileEditorProps {
  document: BrainDocument | null;
  onSave: (data: BootstrapFormData) => Promise<void>;
  onClose: () => void;
  isSaving?: boolean;
}

export function BootstrapProfileEditor({
  document,
  onSave,
  onClose,
  isSaving,
}: BootstrapProfileEditorProps) {
  const { bootstrapDefaults, isLoading: isLoadingAgency } = useAgencyData();

  const form = useForm<BootstrapFormData>({
    resolver: zodResolver(bootstrapSchema),
    defaultValues: {
      agency_name: "",
      niche: "",
      website: "",
      positioning: "",
      services: [],
      ideal_client_profile: "",
      pain_points: [],
      unique_value_proposition: "",
      target_industries: [],
    },
  });

  // Auto-fill from agency data when available
  useEffect(() => {
    if (bootstrapDefaults && !document) {
      form.setValue("agency_name", bootstrapDefaults.agency_name || "");
      form.setValue("niche", bootstrapDefaults.niche || "");
      form.setValue("website", bootstrapDefaults.website || "");
    }
  }, [bootstrapDefaults, document, form]);

  // Load existing document data
  useEffect(() => {
    if (document?.content_json) {
      const content = document.content_json as Partial<BootstrapFormData>;
      Object.entries(content).forEach(([key, value]) => {
        if (value !== undefined) {
          form.setValue(key as keyof BootstrapFormData, value);
        }
      });
    }
  }, [document, form]);

  const handleSubmit = async (data: BootstrapFormData) => {
    await onSave(data);
  };

  const hasAutoFilled = bootstrapDefaults && !document;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {hasAutoFilled && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-primary/10 p-3 rounded-lg">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Some fields have been auto-filled from your onboarding data</span>
          </div>
        )}

        <FieldGroup title="Agency Identity" description="Core information about your agency">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="agency_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Agency Name
                    {hasAutoFilled && bootstrapDefaults?.agency_name && (
                      <Badge variant="outline" className="ml-2 text-xs">Auto-filled</Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Your agency name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="niche"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Niche
                    {hasAutoFilled && bootstrapDefaults?.niche && (
                      <Badge variant="outline" className="ml-2 text-xs">Auto-filled</Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., B2B SaaS, E-commerce" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Website
                  {hasAutoFilled && bootstrapDefaults?.website && (
                    <Badge variant="outline" className="ml-2 text-xs">Auto-filled</Badge>
                  )}
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://yourwebsite.com" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FieldGroup>

        <FieldGroup title="Positioning & Value" description="How you position your agency in the market">
          <FormField
            control={form.control}
            name="positioning"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Positioning Statement</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="We help [target audience] achieve [outcome] through [method]..."
                    className="min-h-[80px]"
                  />
                </FormControl>
                <FormDescription>
                  A clear statement of who you help and how
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="unique_value_proposition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unique Value Proposition</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="What makes your agency uniquely valuable to clients?"
                    className="min-h-[80px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FieldGroup>

        <FieldGroup title="Services & Offerings" description="What you provide to clients">
          <FormField
            control={form.control}
            name="services"
            render={({ field }) => (
              <ArrayField
                label="Services"
                description="List the main services your agency offers"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add a service..."
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title="Target Market" description="Who you serve best">
          <FormField
            control={form.control}
            name="ideal_client_profile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ideal Client Profile (ICP)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Describe your ideal client - company size, stage, characteristics..."
                    className="min-h-[80px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="target_industries"
            render={({ field }) => (
              <ArrayField
                label="Target Industries"
                description="Industries you specialize in"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add an industry..."
              />
            )}
          />

          <FormField
            control={form.control}
            name="pain_points"
            render={({ field }) => (
              <ArrayField
                label="Client Pain Points"
                description="Common problems your clients face that you solve"
                value={field.value}
                onChange={field.onChange}
                placeholder="Add a pain point..."
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
