import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Clock, Loader2, Instagram, Facebook, Linkedin, Globe } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { convertToUTC } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface SchedulingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  clientId: string;
  agencyId: string;
  onSuccess: () => void;
}

interface SocialConnection {
  id: string;
  platform: string;
  account_name: string | null;
  account_handle: string | null;
  status: string;
}

interface PlatformSchedule {
  enabled: boolean;
  caption: string;
  scheduledFor: Date | undefined;
  time: string;
  connectionId: string | null;
}

const PLATFORMS = [
  { key: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-500" },
  { key: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-600" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-blue-700" },
];

export default function SchedulingModal({
  open,
  onOpenChange,
  projectId,
  clientId,
  agencyId,
  onSuccess,
}: SchedulingModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [project, setProject] = useState<any>(null);
  const [finalAsset, setFinalAsset] = useState<any>(null);
  const [userTimezone, setUserTimezone] = useState<string>("UTC");
  
  const [platforms, setPlatforms] = useState<Record<string, PlatformSchedule>>({
    instagram: { enabled: false, caption: "", scheduledFor: undefined, time: "", connectionId: null },
    facebook: { enabled: false, caption: "", scheduledFor: undefined, time: "", connectionId: null },
    linkedin: { enabled: false, caption: "", scheduledFor: undefined, time: "", connectionId: null },
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, projectId]);

  const fetchData = async () => {
    try {
      // Fetch user timezone
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("timezone")
          .eq("id", user.id)
          .single();
        
        if (profileData?.timezone) {
          setUserTimezone(profileData.timezone);
        }
      }

      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch final asset
      const { data: assetsData } = await supabase
        .from("project_assets")
        .select("asset_id, assets(*)")
        .eq("project_id", projectId)
        .eq("is_final_content", true)
        .single();

      if (assetsData?.assets) {
        setFinalAsset(assetsData.assets);
      }

      // Fetch social connections for this client
      const { data: connectionsData, error: connectionsError } = await supabase
        .from("social_connections")
        .select("id, platform, account_name, account_handle, status")
        .eq("client_id", clientId)
        .eq("status", "connected");

      if (connectionsError) throw connectionsError;
      setConnections(connectionsData || []);

      // Initialize platform states with existing captions if available
      const initialPlatforms = { ...platforms };
      if (projectData.platform_captions) {
        Object.entries(projectData.platform_captions as Record<string, string>).forEach(([platform, caption]) => {
          if (initialPlatforms[platform]) {
            initialPlatforms[platform].caption = caption;
          }
        });
      }

      // Set connection IDs for each platform
      (connectionsData || []).forEach((conn) => {
        if (initialPlatforms[conn.platform]) {
          initialPlatforms[conn.platform].connectionId = conn.id;
        }
      });

      setPlatforms(initialPlatforms);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load scheduling data",
        variant: "destructive",
      });
    }
  };

  const handleSchedule = async () => {
    const enabledPlatforms = Object.entries(platforms).filter(([_, config]) => config.enabled);

    if (enabledPlatforms.length === 0) {
      toast({
        title: "No platforms selected",
        description: "Please select at least one platform to schedule",
        variant: "destructive",
      });
      return;
    }

    // Validate all enabled platforms have required data
    for (const [platform, config] of enabledPlatforms) {
      if (!config.scheduledFor || !config.time) {
        toast({
          title: "Missing schedule time",
          description: `Please set a date and time for ${platform}`,
          variant: "destructive",
        });
        return;
      }

      if (!config.connectionId) {
        toast({
          title: "No connection found",
          description: `Please connect your ${platform} account first`,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    try {
      // Create scheduled_posts records for each enabled platform
      const scheduledPostsPromises = enabledPlatforms.map(async ([platform, config]) => {
        const [hours, minutes] = config.time.split(":").map(Number);
        const localDateTime = new Date(config.scheduledFor!);
        localDateTime.setHours(hours, minutes, 0, 0);

        const utcDateTime = convertToUTC(localDateTime, userTimezone);

        return supabase.from("scheduled_posts").insert({
          project_id: projectId,
          agency_id: agencyId,
          client_id: clientId,
          platform: platform,
          social_connection_id: config.connectionId,
          scheduled_for: utcDateTime,
          status: "pending",
          caption: config.caption || null,
        });
      });

      const results = await Promise.all(scheduledPostsPromises);
      
      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(errors[0].error!.message);
      }

      // Update project status to scheduled
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          status: "scheduled",
          scheduled_for: convertToUTC(
            enabledPlatforms[0][1].scheduledFor!,
            userTimezone
          ),
        })
        .eq("id", projectId);

      if (updateError) throw updateError;

      toast({
        title: "Successfully scheduled",
        description: `Scheduled for ${enabledPlatforms.length} platform(s)`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error scheduling:", error);
      toast({
        title: "Scheduling failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePlatform = (platformKey: string) => {
    setPlatforms((prev) => ({
      ...prev,
      [platformKey]: {
        ...prev[platformKey],
        enabled: !prev[platformKey].enabled,
      },
    }));
  };

  const updatePlatformCaption = (platformKey: string, caption: string) => {
    setPlatforms((prev) => ({
      ...prev,
      [platformKey]: {
        ...prev[platformKey],
        caption,
      },
    }));
  };

  const updatePlatformSchedule = (platformKey: string, date: Date | undefined, time: string) => {
    setPlatforms((prev) => ({
      ...prev,
      [platformKey]: {
        ...prev[platformKey],
        scheduledFor: date,
        time,
      },
    }));
  };

  const applyToAll = (sourceKey: string) => {
    const source = platforms[sourceKey];
    setPlatforms((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        if (updated[key].enabled) {
          updated[key].scheduledFor = source.scheduledFor;
          updated[key].time = source.time;
        }
      });
      return updated;
    });
    toast({
      title: "Applied to all",
      description: "Schedule copied to all enabled platforms",
    });
  };

  const getConnectionForPlatform = (platformKey: string) => {
    return connections.find((c) => c.platform === platformKey);
  };

  if (!project) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Content</DialogTitle>
          <DialogDescription>
            Schedule "{project.title}" to publish on social media platforms
          </DialogDescription>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="gap-1">
              <Globe className="h-3 w-3" />
              {userTimezone}
            </Badge>
            <span className="text-xs text-muted-foreground">
              All times will be saved in UTC
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Media Preview */}
          {finalAsset && (
            <div className="rounded-lg overflow-hidden border">
              {finalAsset.file_type === "image" ? (
                <img
                  src={finalAsset.file_url}
                  alt={finalAsset.filename}
                  className="w-full max-h-64 object-contain bg-muted"
                />
              ) : finalAsset.file_type === "video" ? (
                <video
                  src={finalAsset.file_url}
                  controls
                  className="w-full max-h-64 object-contain bg-muted"
                />
              ) : null}
            </div>
          )}

          {/* Platform Configuration */}
          <div className="space-y-4">
            {PLATFORMS.map(({ key, label, icon: Icon, color }) => {
              const connection = getConnectionForPlatform(key);
              const platformConfig = platforms[key];

              return (
                <div key={key} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={platformConfig.enabled}
                        onCheckedChange={() => togglePlatform(key)}
                        disabled={!connection}
                      />
                      <Icon className={cn("h-5 w-5", color)} />
                      <div>
                        <p className="font-medium">{label}</p>
                        {connection ? (
                          <p className="text-xs text-muted-foreground">
                            @{connection.account_handle || connection.account_name}
                          </p>
                        ) : (
                          <p className="text-xs text-destructive">Not connected</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {platformConfig.enabled && (
                    <div className="space-y-4 pl-8">
                      {/* Caption */}
                      <div className="space-y-2">
                        <Label>Caption</Label>
                        <Textarea
                          placeholder={`Caption for ${label}...`}
                          value={platformConfig.caption}
                          onChange={(e) => updatePlatformCaption(key, e.target.value)}
                          rows={3}
                        />
                      </div>

                      {/* Schedule Date & Time */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !platformConfig.scheduledFor && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {platformConfig.scheduledFor
                                  ? format(platformConfig.scheduledFor, "PPP")
                                  : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={platformConfig.scheduledFor}
                                onSelect={(date) =>
                                  updatePlatformSchedule(key, date, platformConfig.time)
                                }
                                disabled={(date) => date < new Date()}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <Label>Time ({userTimezone})</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <input
                                type="time"
                                value={platformConfig.time}
                                onChange={(e) =>
                                  updatePlatformSchedule(
                                    key,
                                    platformConfig.scheduledFor,
                                    e.target.value
                                  )
                                }
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 pl-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => applyToAll(key)}
                              disabled={
                                !platformConfig.scheduledFor || !platformConfig.time
                              }
                            >
                              Apply to All
                            </Button>
                          </div>
                          {platformConfig.scheduledFor && platformConfig.time && (
                            <p className="text-xs text-muted-foreground">
                              UTC: {format(
                                new Date(
                                  convertToUTC(
                                    new Date(
                                      platformConfig.scheduledFor.getFullYear(),
                                      platformConfig.scheduledFor.getMonth(),
                                      platformConfig.scheduledFor.getDate(),
                                      parseInt(platformConfig.time.split(":")[0]),
                                      parseInt(platformConfig.time.split(":")[1])
                                    ),
                                    userTimezone
                                  )
                                ),
                                "MMM d, yyyy 'at' HH:mm"
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
