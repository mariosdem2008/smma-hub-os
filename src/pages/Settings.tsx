import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

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
        <p className="text-muted-foreground">Manage your account and agency settings</p>
      </div>

      {/* Profile Section */}
      <Card>
...
      </Card>
    </div>
  );
}
