import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const NICHES = [
  "Real Estate",
  "E-commerce",
  "Beauty",
  "Medical",
  "Local Business",
  "General",
  "Other",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: User Identity
  const [fullName, setFullName] = useState("");
  const [isOwner, setIsOwner] = useState("yes");
  const [userRole, setUserRole] = useState("owner");

  // Step 2: Agency Setup
  const [agencyName, setAgencyName] = useState("");
  const [agencyWebsite, setAgencyWebsite] = useState("");
  const [agencyNiche, setAgencyNiche] = useState("");
  const [agencyBrandColor, setAgencyBrandColor] = useState("#000000");
  const [createdAgencyId, setCreatedAgencyId] = useState<string | null>(null);

  // Step 3: First Client (Optional)
  const [wantsClient, setWantsClient] = useState<boolean | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientWebsite, setClientWebsite] = useState("");
  const [clientBrandColor, setClientBrandColor] = useState("#000000");
  const [clientNotes, setClientNotes] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // ProtectedRoute already handles membership checking and redirection
  // No need for duplicate logic here

  const handleStep1Continue = async () => {
    if (!fullName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your full name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update profile with full name
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user?.id);

      if (error) throw error;

      setStep(2);
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

  const handleStep2Continue = async () => {
    if (!agencyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your agency name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create agency
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .insert({
          user_id: user?.id,
          name: agencyName,
          website: agencyWebsite || null,
          niche: agencyNiche || null,
        } as any)
        .select()
        .single();

      if (agencyError) throw agencyError;

      // Create agency_members entry (owner role)
      const { error: memberError } = await supabase
        .from("agency_members")
        .insert({
          agency_id: agency.id,
          user_id: user?.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      setCreatedAgencyId(agency.id);

      toast({
        title: "Success",
        description: "Agency created successfully!",
      });

      setStep(3);
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

  const handleStep3Skip = () => {
    navigate("/dashboard");
  };

  const handleStep3CreateClient = async () => {
    if (!clientName.trim()) {
      toast({
        title: "Error",
        description: "Please enter client brand name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Upload logo if provided
      let logoUrl = null;
      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("client-logos")
          .upload(fileName, logoFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("client-logos").getPublicUrl(fileName);

        logoUrl = publicUrl;
      }

      // Create client
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .insert({
          agency_id: createdAgencyId,
          name: clientName,
          logo_url: logoUrl,
          brand_colors: [clientBrandColor],
          website: clientWebsite || null,
          notes: clientNotes || null,
          status: "active",
        } as any)
        .select()
        .single();

      if (clientError) throw clientError;

      toast({
        title: "Success",
        description: "First client created successfully!",
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
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-center gap-2 mb-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-2 w-12 rounded-full transition-colors ${
                  i === step
                    ? "bg-primary"
                    : i < step
                    ? "bg-primary/50"
                    : "bg-muted"
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
            {step === 2 && "Tell us about your agency"}
            {step === 3 && "Optional: Add your first client now"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* STEP 1: User Identity */}
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
                <RadioGroup value={isOwner} onValueChange={setIsOwner}>
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
                <Select value={userRole} onValueChange={setUserRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleStep1Continue}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? "Saving..." : "Continue"}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* STEP 2: Agency Setup */}
          {step === 2 && (
            <div className="space-y-6">
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
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleStep2Continue}
                  disabled={loading}
                  className="flex-1"
                  size="lg"
                >
                  {loading ? "Creating Agency..." : "Continue"}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: First Client (Optional) */}
          {step === 3 && (
            <div className="space-y-6">
              {wantsClient === null ? (
                <>
                  <p className="text-center text-muted-foreground">
                    Do you want to create your first client now?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleStep3Skip}
                      variant="outline"
                      className="flex-1"
                      size="lg"
                    >
                      Skip for now
                    </Button>
                    <Button
                      onClick={() => setWantsClient(true)}
                      className="flex-1"
                      size="lg"
                    >
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
                    <Button
                      onClick={handleStep3Skip}
                      variant="outline"
                      className="flex-1"
                    >
                      Skip
                    </Button>
                    <Button
                      onClick={handleStep3CreateClient}
                      disabled={loading}
                      className="flex-1"
                      size="lg"
                    >
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
