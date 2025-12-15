import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, ChevronRight, ChevronLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const NICHES = ["Real Estate", "E-commerce", "Beauty", "Medical", "Local Business", "General", "Other"];

type Step = 1 | 2 | 3;

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [isOwner, setIsOwner] = useState<"yes" | "no">("yes");
  const [userRole, setUserRole] = useState<"owner" | "manager">("owner");

  // Step 2
  const [agencyName, setAgencyName] = useState("");
  const [agencyWebsite, setAgencyWebsite] = useState("");
  const [agencyNiche, setAgencyNiche] = useState("");
  const [agencyBrandColor, setAgencyBrandColor] = useState("#000000"); // UI-only unless you have a column for it
  const [createdAgencyId, setCreatedAgencyId] = useState<string | null>(null);

  // Step 3
  const [wantsClient, setWantsClient] = useState<boolean | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientWebsite, setClientWebsite] = useState("");
  const [clientBrandColor, setClientBrandColor] = useState("#000000");
  const [clientNotes, setClientNotes] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const userId = user?.id ?? null;

  // Prefill name from auth metadata and/or profiles table
  useEffect(() => {
    if (!userId) return;

    const metaName = (user?.user_metadata as any)?.full_name as string | undefined;
    if (metaName && !fullName) setFullName(metaName);

    (async () => {
      const { data, error } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
      if (!error && data?.full_name && !fullName) setFullName(data.full_name);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const canCreateAgency = useMemo(() => isOwner === "yes" && userRole === "owner", [isOwner, userRole]);

  const handleStep1Continue = async () => {
    if (!userId) {
      toast({ title: "Error", description: "No authenticated user found", variant: "destructive" });
      return;
    }
    if (!fullName.trim()) {
      toast({ title: "Error", description: "Please enter your full name", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", userId);

      if (error) {
        console.log("[ONBOARDING step1] profiles.update error:", error);
        throw error;
      }

      // If they are not owner/owner-role, we still let them continue, but Step 2 will guide them.
      setStep(2);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to save profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Attempt agencies insert; if DB requires explicit id, retry with uuid
  const createAgencyRow = async (payload: any) => {
    // 1) normal attempt
    const attempt1 = await supabase.from("agencies").insert(payload as any).select().single();
    if (!attempt1.error) return attempt1;

    const msg = attempt1.error.message || "";
    const details = (attempt1.error as any).details || "";
    const combined = `${msg} ${details}`;

    // 2) if "id" has no default, retry with explicit id
    const looksLikeMissingId =
      combined.toLowerCase().includes("null value in column") && combined.toLowerCase().includes("id");
    if (!looksLikeMissingId) return attempt1;

    const attempt2 = await supabase
      .from("agencies")
      .insert({ ...payload, id: crypto.randomUUID() } as any)
      .select()
      .single();

    return attempt2;
  };

  const handleStep2Continue = async () => {
    if (!userId) {
      toast({ title: "Error", description: "No authenticated user found", variant: "destructive" });
      return;
    }

    // If they are NOT owner, do not create agency. Guide them.
    if (!canCreateAgency) {
      toast({
        title: "Action required",
        description: "Ask your agency owner to invite you. You can proceed to the dashboard after you accept an invite.",
      });
      navigate("/dashboard");
      return;
    }

    if (!agencyName.trim()) {
      toast({ title: "Error", description: "Please enter your agency name", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Create agency (use minimal fields you already used; do NOT guess extra columns)
      const agencyPayload = {
        user_id: userId,
        name: agencyName.trim(),
        website: agencyWebsite.trim() || null,
        niche: agencyNiche || null,
      };

      // If you have UNIQUE(user_id) you can switch to upsert(onConflict:"user_id")
      // For now: insert with safe retry if id is required.
      const { data: agency, error: agencyError } = await createAgencyRow(agencyPayload);

      console.log("[ONBOARDING step2] agency payload:", agencyPayload);
      console.log("[ONBOARDING step2] agency data:", agency);
      console.log("[ONBOARDING step2] agency error:", agencyError);

      if (agencyError) throw agencyError;
      if (!agency?.id) throw new Error("Agency was created but no ID was returned");

      // Create membership (use upsert to avoid double insert issues)
      const { error: memberError } = await supabase
        .from("agency_members")
        .upsert({ agency_id: agency.id, user_id: userId, role: "owner" } as any, {
          onConflict: "agency_id,user_id",
        });

      console.log("[ONBOARDING step2] member upsert error:", memberError);
      if (memberError) throw memberError;

      setCreatedAgencyId(agency.id);

      toast({ title: "Success", description: "Agency created successfully!" });
      setStep(3);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to create agency", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Skip = () => navigate("/dashboard");

  const handleStep3CreateClient = async () => {
    if (!userId) {
      toast({ title: "Error", description: "No authenticated user found", variant: "destructive" });
      return;
    }
    if (!createdAgencyId) {
      toast({
        title: "Error",
        description: "No agency found. Please complete Step 2 first.",
        variant: "destructive",
      });
      return;
    }
    if (!clientName.trim()) {
      toast({ title: "Error", description: "Please enter client brand name", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let logoUrl: string | null = null;

      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop() || "png";
        const fileName = `${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from("client-logos").upload(fileName, logoFile, {
          upsert: false,
        });

        console.log("[ONBOARDING step3] uploadError:", uploadError);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("client-logos").getPublicUrl(fileName);
        logoUrl = data.publicUrl;
      }

      const clientPayload = {
        agency_id: createdAgencyId,
        name: clientName.trim(),
        logo_url: logoUrl,
        brand_colors: [clientBrandColor], // keep only if your column exists (you already used it)
        website: clientWebsite.trim() || null,
        notes: clientNotes.trim() || null,
        status: "active",
      };

      const { data: client, error: clientError } = await supabase
        .from("clients")
        .insert(clientPayload as any)
        .select()
        .single();

      console.log("[ONBOARDING step3] client payload:", clientPayload);
      console.log("[ONBOARDING step3] client data:", client);
      console.log("[ONBOARDING step3] client error:", clientError);

      if (clientError) throw clientError;

      toast({ title: "Success", description: "First client created successfully!" });
      navigate(`/clients/${client.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to create client", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Not signed in</CardTitle>
            <CardDescription>Please sign in to continue onboarding.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Go to Auth
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-center gap-2 mb-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-2 w-12 rounded-full transition-colors ${
                  i === step ? "bg-primary" : i < step ? "bg-primary/50" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <CardTitle className="text-2xl">
            {step === 1 && "Welcome to SMMAHUB"}
            {step === 2 && "Set Up Your Agency"}
            {step === 3 && "Create Your First Client"}
          </CardTitle>

          <CardDescription>
            {step === 1 && "Let's get to know you"}
            {step === 2 && (canCreateAgency ? "Tell us about your agency" : "You’ll need an invite from your agency owner")}
            {step === 3 && "Optional: Add your first client now"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <Label>Are you the owner of this agency? *</Label>
                <RadioGroup value={isOwner} onValueChange={(v) => setIsOwner(v as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="yes" />
                    <Label htmlFor="yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="no" />
                    <Label htmlFor="no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">What is your role? *</Label>
                <Select value={userRole} onValueChange={(v) => setUserRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleStep1Continue} disabled={loading} className="w-full" size="lg">
                {loading ? "Saving..." : "Continue"}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6">
              {!canCreateAgency ? (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <p className="font-medium">You’re not creating an agency right now.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ask your agency owner to invite you. Once you accept the invite, you’ll automatically see the agency.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button onClick={() => navigate("/dashboard")} className="flex-1" size="lg">
                      Go to Dashboard
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="agencyName">Agency Name *</Label>
                    <Input
                      id="agencyName"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      placeholder="Enter your agency name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agencyWebsite">Website</Label>
                    <Input
                      id="agencyWebsite"
                      type="url"
                      value={agencyWebsite}
                      onChange={(e) => setAgencyWebsite(e.target.value)}
                      placeholder="https://yoursite.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agencyNiche">Agency Niche</Label>
                    <Select value={agencyNiche} onValueChange={setAgencyNiche}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a niche" />
                      </SelectTrigger>
                      <SelectContent>
                        {NICHES.map((niche) => (
                          <SelectItem key={niche} value={niche}>
                            {niche}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agencyBrandColor">Agency Brand Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={agencyBrandColor}
                        onChange={(e) => setAgencyBrandColor(e.target.value)}
                        className="h-10 w-20"
                      />
                      <Input
                        type="text"
                        value={agencyBrandColor}
                        onChange={(e) => setAgencyBrandColor(e.target.value)}
                        placeholder="#000000"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button onClick={handleStep2Continue} disabled={loading} className="flex-1" size="lg">
                      {loading ? "Creating Agency..." : "Continue"}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-6">
              {!createdAgencyId ? (
                <>
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <p className="font-medium">No agency ID available.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      This means Step 2 didn’t complete. Go back and create the agency first.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setStep(2)} variant="outline" className="flex-1">
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button onClick={() => navigate("/dashboard")} className="flex-1" size="lg">
                      Go to Dashboard
                    </Button>
                  </div>
                </>
              ) : wantsClient === null ? (
                <>
                  <p className="text-center text-muted-foreground">Do you want to create your first client now?</p>
                  <div className="flex gap-2">
                    <Button onClick={handleStep3Skip} variant="outline" className="flex-1" size="lg">
                      Skip for now
                    </Button>
                    <Button onClick={() => setWantsClient(true)} className="flex-1" size="lg">
                      Yes, create client
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Brand Name *</Label>
                    <Input
                      id="clientName"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Enter client brand name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientWebsite">Website</Label>
                    <Input
                      id="clientWebsite"
                      type="url"
                      value={clientWebsite}
                      onChange={(e) => setClientWebsite(e.target.value)}
                      placeholder="https://clientsite.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientBrandColor">Main Brand Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={clientBrandColor}
                        onChange={(e) => setClientBrandColor(e.target.value)}
                        className="h-10 w-20"
                      />
                      <Input
                        type="text"
                        value={clientBrandColor}
                        onChange={(e) => setClientBrandColor(e.target.value)}
                        placeholder="#000000"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logo">Logo Upload</Label>
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <Button type="button" variant="outline" onClick={() => document.getElementById("logo")?.click()} className="w-full">
                      <Upload className="mr-2 h-4 w-4" />
                      {logoFile ? logoFile.name : "Upload Logo"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientNotes">Notes</Label>
                    <Textarea
                      id="clientNotes"
                      value={clientNotes}
                      onChange={(e) => setClientNotes(e.target.value)}
                      placeholder="Any additional notes..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleStep3Skip} variant="outline" className="flex-1">
                      Skip
                    </Button>
                    <Button onClick={handleStep3CreateClient} disabled={loading} className="flex-1" size="lg">
                      {loading ? "Creating..." : "Create Client"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

