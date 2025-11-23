import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const urlSchema = z.string().optional().refine(
  (val) => !val || val === "" || /^https?:\/\/.+/.test(val),
  { message: "Must be a valid URL starting with http:// or https://" }
);

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, {
  message: "Must be a valid hex color code (e.g., #000000)",
});

const formSchema = z.object({
  brandName: z.string().min(1, "Brand name is required"),
  website: urlSchema,
  niche: z.string().optional(),
  toneOfVoice: z.string().optional(),
  brandColor: hexColorSchema,
  instagram: urlSchema,
  facebook: urlSchema,
  tiktok: urlSchema,
  linkedin: urlSchema,
  youtube: urlSchema,
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      brandName: "",
      website: "",
      niche: "",
      toneOfVoice: "",
      brandColor: "#000000",
      instagram: "",
      facebook: "",
      tiktok: "",
      linkedin: "",
      youtube: "",
      notes: "",
    },
  });

  useEffect(() => {
    const checkExistingClients = async () => {
      if (!user) return;

      // Get agency
      const { data: agencies } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agencies) return;

      // Check if agency has clients
      const { data: clients, error } = await supabase
        .from("clients")
        .select("id")
        .eq("agency_id", agencies.id)
        .limit(1);

      if (!error && clients && clients.length > 0) {
        navigate("/dashboard");
      }
    };

    checkExistingClients();
  }, [user, navigate]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    setLoading(true);

    try {
      // Get agency
      const { data: agencies } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agencies) {
        throw new Error("Agency not found");
      }

      // Upload logo if provided
      let logoUrl = null;
      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("client-logos")
          .upload(fileName, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("client-logos")
          .getPublicUrl(fileName);

        logoUrl = publicUrl;
      }

      // Create client
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .insert({
          agency_id: agencies.id,
          name: values.brandName,
          logo_url: logoUrl,
          brand_colors: [values.brandColor],
          website: values.website || null,
          niche: values.niche || null,
          tone_of_voice: values.toneOfVoice || null,
          notes: values.notes || null,
          status: "active",
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // Insert social profiles
      const socialProfiles = [
        { platform: "Instagram", url: values.instagram },
        { platform: "Facebook", url: values.facebook },
        { platform: "TikTok", url: values.tiktok },
        { platform: "LinkedIn", url: values.linkedin },
        { platform: "YouTube", url: values.youtube },
      ].filter(profile => profile.url && profile.url.trim() !== "");

      if (socialProfiles.length > 0) {
        const { error: profilesError } = await supabase
          .from("social_profiles")
          .insert(
            socialProfiles.map(profile => ({
              client_id: client.id,
              platform: profile.platform,
              url: profile.url,
            }))
          );

        if (profilesError) throw profilesError;
      }

      toast({
        title: "Client created!",
        description: "Your first client has been set up successfully.",
      });

      navigate(`/clients/${client.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome — Let's set up your first client</CardTitle>
          <CardDescription>
            Add your client's brand information to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Brand Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Brand Information</h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="brandName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter brand name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="logo">Logo</Label>
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("logo")?.click()}
                      className="w-full"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {logoFile ? logoFile.name : "Upload Logo"}
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name="brandColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand Color</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input type="color" {...field} className="h-10 w-20" />
                            <Input 
                              type="text" 
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="#000000"
                              className="flex-1"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website URL</FormLabel>
                        <FormControl>
                          <Input type="url" placeholder="https://example.com" {...field} />
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
                        <FormLabel>Niche</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Fashion, Tech, Food" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="toneOfVoice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tone of Voice</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Professional, Casual, Fun" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Social Profiles Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Social Profiles</h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="instagram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram</FormLabel>
                        <FormControl>
                          <Input placeholder="https://instagram.com/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="facebook"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facebook</FormLabel>
                        <FormControl>
                          <Input placeholder="https://facebook.com/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tiktok"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TikTok</FormLabel>
                        <FormControl>
                          <Input placeholder="https://tiktok.com/@..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="linkedin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn</FormLabel>
                        <FormControl>
                          <Input placeholder="https://linkedin.com/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="youtube"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>YouTube</FormLabel>
                        <FormControl>
                          <Input placeholder="https://youtube.com/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Additional Notes Section */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional notes about this client..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Creating..." : "Continue"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
