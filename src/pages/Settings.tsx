import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useAuth();
  const { canManageTeam, canEditSettings, isAdmin } = useRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string>("");
  const [agencyName, setAgencyName] = useState("");

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: agency, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (agency) {
        setAgencyId(agency.id);
        setAgencyName(agency.name);
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAgency = async () => {
    if (!agencyId || !agencyName.trim()) {
      toast({
        title: "Validation Error",
        description: "Agency name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("agencies")
      .update({ name: agencyName })
      .eq("id", agencyId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update agency name",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Agency name updated successfully",
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="grid gap-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={user?.user_metadata?.full_name || ""}
                disabled
                className="bg-muted"
              />
            </div>
            {isAdmin && (
              <div className="pt-2">
                <Badge variant="default" className="bg-gradient-to-r from-[#4E5DFF] to-[#6A73FF]">
                  Admin
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  You have admin privileges in this agency (Agency Plus feature)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agency Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Agency Settings</CardTitle>
                <CardDescription>Configure your agency details</CardDescription>
              </div>
              {canManageTeam && (
                <Button variant="outline" onClick={() => window.location.href = "/team"}>
                  Manage Team
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agency-name">
                Agency Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="agency-name"
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Your Agency Name"
                disabled={!canEditSettings}
              />
            </div>
            {canEditSettings && (
              <Button onClick={handleUpdateAgency} disabled={saving}>
                {saving ? "Updating..." : "Update Agency"}
              </Button>
            )}
            {!canEditSettings && (
              <p className="text-sm text-muted-foreground">Only owners and admins can edit agency settings</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
