import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import SocialConnectionsSection from "./SocialConnectionsSection";

interface SocialProfile {
  id: string;
  platform: string;
  url: string;
  created_at: string;
}

interface SocialProfilesTabProps {
  clientId: string;
}

const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube", "Twitter", "Pinterest"];

export default function SocialProfilesTab({ clientId }: SocialProfilesTabProps) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProfile, setNewProfile] = useState({ platform: "", url: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, [clientId]);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("social_profiles")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch social profiles",
        variant: "destructive",
      });
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  };

  const handleAddProfile = async () => {
    if (!newProfile.platform || !newProfile.url) {
      toast({
        title: "Validation Error",
        description: "Please select a platform and enter a URL",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from("social_profiles")
      .insert({
        client_id: clientId,
        platform: newProfile.platform,
        url: newProfile.url,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add social profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Social profile added successfully",
      });
      setNewProfile({ platform: "", url: "" });
      setIsDialogOpen(false);
      fetchProfiles();
    }
    setSubmitting(false);
  };

  const handleDeleteProfile = async (profileId: string) => {
    const { error } = await supabase
      .from("social_profiles")
      .delete()
      .eq("id", profileId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete social profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Social profile deleted successfully",
      });
      fetchProfiles();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* API Connections Section */}
      <SocialConnectionsSection clientId={clientId} />

      <Separator />

      {/* Manual Social Profiles Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Social Profiles</h3>
          <p className="text-sm text-muted-foreground">Manage social media links for this client</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Social Profile</DialogTitle>
              <DialogDescription>
                Add a new social media profile for this client
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select
                  value={newProfile.platform}
                  onValueChange={(value) =>
                    setNewProfile({ ...newProfile, platform: value })
                  }
                >
                  <SelectTrigger id="platform">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://..."
                  value={newProfile.url}
                  onChange={(e) =>
                    setNewProfile({ ...newProfile, url: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleAddProfile} disabled={submitting}>
                {submitting ? "Adding..." : "Add Profile"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No social profiles added yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {profile.platform}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteProfile(profile.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent>
                <a
                  href={profile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-sm text-primary hover:underline"
                >
                  <span className="truncate">{profile.url}</span>
                  <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
