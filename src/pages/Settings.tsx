import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Sun, Moon, Palette } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { canManageTeam, canEditSettings } = useRole();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string>("");
  const [agencyName, setAgencyName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");

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

      // Get stored brand color from localStorage
      const storedColor = localStorage.getItem("brand-color");
      if (storedColor) {
        setPrimaryColor(storedColor);
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

  const handleColorChange = (color: string) => {
    setPrimaryColor(color);
    localStorage.setItem("brand-color", color);
    
    // Apply color to CSS variable
    document.documentElement.style.setProperty("--primary", color);
    
    toast({
      title: "Color Updated",
      description: "Brand color will be applied across the app",
    });
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
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
                <Button variant="outline" onClick={() => window.location.href = "/settings/team"}>
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
              <p className="text-sm text-muted-foreground">Only owners can edit agency settings</p>
            )}
          </CardContent>
        </Card>

        {/* Brand Theme */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Theme</CardTitle>
            <CardDescription>Customize your app appearance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="theme-mode">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark theme
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                <Switch
                  id="theme-mode"
                  checked={theme === "dark"}
                  onCheckedChange={toggleTheme}
                />
                <Moon className="h-4 w-4" />
              </div>
            </div>

            <Separator />

            {/* Primary Brand Color */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="brand-color">Primary Brand Color</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Choose a color that represents your brand
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Input
                    id="brand-color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-20 h-10 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-32 font-mono text-sm"
                    placeholder="#3b82f6"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleColorChange("#3b82f6")}
                >
                  Reset to Default
                </Button>
              </div>
              <div className="flex items-center gap-2 p-4 rounded-lg border" style={{ backgroundColor: primaryColor }}>
                <div className="text-sm font-medium text-white">Preview Color</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
