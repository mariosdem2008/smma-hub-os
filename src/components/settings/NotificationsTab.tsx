import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface NotificationPreferences {
  email_on_approval: boolean;
  email_on_changes_requested: boolean;
  email_on_post_failed: boolean;
  email_weekly_reminders: boolean;
}

export default function NotificationsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_on_approval: true,
    email_on_changes_requested: true,
    email_on_post_failed: true,
    email_weekly_reminders: true,
  });

  useEffect(() => {
    fetchPreferences();
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setPreferences({
          email_on_approval: data.email_on_approval,
          email_on_changes_requested: data.email_on_changes_requested,
          email_on_post_failed: data.email_on_post_failed,
          email_weekly_reminders: data.email_weekly_reminders,
        });
      }
    } catch (error: any) {
      console.error("Error fetching preferences:", error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;

    try {
      const newPreferences = { ...preferences, [key]: value };
      setPreferences(newPreferences);

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...newPreferences,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notification preferences updated",
      });
    } catch (error: any) {
      console.error("Error updating preferences:", error);
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive",
      });
      // Revert on error
      fetchPreferences();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Manage how and when you receive email notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email_on_approval">Client Approvals</Label>
            <p className="text-sm text-muted-foreground">
              Email me when a client approves content
            </p>
          </div>
          <Switch
            id="email_on_approval"
            checked={preferences.email_on_approval}
            onCheckedChange={(checked) =>
              updatePreference("email_on_approval", checked)
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email_on_changes_requested">
              Change Requests
            </Label>
            <p className="text-sm text-muted-foreground">
              Email me when a client requests changes
            </p>
          </div>
          <Switch
            id="email_on_changes_requested"
            checked={preferences.email_on_changes_requested}
            onCheckedChange={(checked) =>
              updatePreference("email_on_changes_requested", checked)
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email_on_post_failed">Auto-Post Failures</Label>
            <p className="text-sm text-muted-foreground">
              Email me when auto-posting fails
            </p>
          </div>
          <Switch
            id="email_on_post_failed"
            checked={preferences.email_on_post_failed}
            onCheckedChange={(checked) =>
              updatePreference("email_on_post_failed", checked)
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email_weekly_reminders">Weekly Reminders</Label>
            <p className="text-sm text-muted-foreground">
              Send weekly approval reminders to clients
            </p>
          </div>
          <Switch
            id="email_weekly_reminders"
            checked={preferences.email_weekly_reminders}
            onCheckedChange={(checked) =>
              updatePreference("email_weekly_reminders", checked)
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
