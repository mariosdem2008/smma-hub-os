import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { setActiveAgencyId } from "@/lib/active-agency";
import { useToast } from "@/hooks/use-toast";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreateAgencyStub() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [creating, setCreating] = useState(false);
  const [identityName, setIdentityName] = useState("");
  const [identityWebsite, setIdentityWebsite] = useState("");

  const handleCreateAgency = async () => {
    if (!identityName.trim()) {
      toast({ title: "Agency name required", description: "Please enter your agency name." });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_agency_with_admin", {
        _name: identityName.trim(),
        _website: identityWebsite.trim() || null,
      });
      if (error) throw error;

      const newAgencyId = data as string;
      setActiveAgencyId(newAgencyId);
      navigate("/ai/onboarding/agency", { replace: true });
    } catch (err: any) {
      toast({
        title: "Failed to create agency",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Create your agency</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Start with your agency name, then continue in AI-guided onboarding.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agencyName">Agency name</Label>
            <Input
              id="agencyName"
              value={identityName}
              onChange={(e) => setIdentityName(e.target.value)}
              placeholder="Acme Social"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agencyWebsite">Website (optional)</Label>
            <Input
              id="agencyWebsite"
              value={identityWebsite}
              onChange={(e) => setIdentityWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleCreateAgency} disabled={creating}>
              {creating ? "Creating..." : "Continue to AI onboarding"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
