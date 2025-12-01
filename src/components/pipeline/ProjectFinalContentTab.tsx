import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Video,
  Image as ImageIcon,
  AlertCircle,
  Upload,
  X,
  Calendar as CalendarIcon,
  Lightbulb,
  Send,
  Loader2,
  Clock,
  Info,
  Globe,
  ExternalLink,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { getAllPlatformSuggestions } from "@/lib/platform-posting-times";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { convertToUTC, convertToLocal } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface Project {
  id: string;
  client_id: string;
  final_asset_id: string | null;
  platforms: string[];
  platform_captions: Record<string, string>;
  hashtags: string | null;
  scheduled_time: string | null;
  status: string | null;
  published_urls: Record<string, string> | null;
  error_message: string | null;
}

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
}

const PLATFORMS = [
  { id: "instagram", label: "Instagram", enabled: true },
  { id: "facebook", label: "Facebook", enabled: true },
  { id: "tiktok", label: "TikTok", enabled: false },
  { id: "linkedin", label: "LinkedIn", enabled: false },
];

interface ProjectFinalContentTabProps {
  project: Project;
  onUpdate: () => void;
}

export default function ProjectFinalContentTab({ project, onUpdate }: ProjectFinalContentTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [finalAssets, setFinalAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(project.platforms || []);
  const [captions, setCaptions] = useState<Record<string, string>>(project.platform_captions || {});
  const [hashtags, setHashtags] = useState(project.hashtags || "");
  const [userTimezone, setUserTimezone] = useState<string>("UTC");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    project.scheduled_time ? new Date(project.scheduled_time) : undefined,
  );
  const [scheduledTime, setScheduledTime] = useState<string>(
    project.scheduled_time ? format(new Date(project.scheduled_time), "HH:mm") : "12:00",
  );

  useEffect(() => {
    fetchFinalAssets();
    fetchUserTimezone();
  }, [project.id]);

  useEffect(() => {
    // Convert UTC scheduled time to user's local timezone for display
    if (project.scheduled_time && userTimezone !== "UTC") {
      const localDate = convertToLocal(project.scheduled_time, userTimezone);
      setScheduledDate(localDate);
      setScheduledTime(format(localDate, "HH:mm"));
    }
  }, [project.scheduled_time, userTimezone]);

  const fetchUserTimezone = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();

      if (error) throw error;
      if (data?.timezone) {
        setUserTimezone(data.timezone);
      }
    } catch (error) {
      console.error("Error fetching timezone:", error);
    }
  };

  const fetchFinalAssets = async () => {
    try {
      const { data, error } = await supabase
        .from("project_assets")
        .select("asset_id, assets(id, filename, file_url, file_type)")
        .eq("project_id", project.id)
        .eq("is_final_content", true);

      if (error) throw error;

      const assets = data?.map((pa: any) => pa.assets).filter(Boolean) as Asset[];

      setFinalAssets(assets || []);
    } catch (error) {
      console.error("Error fetching final assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${project.client_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("client-assets").upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("client-assets").getPublicUrl(filePath);

        const fileType = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : "document";

        const { data: asset, error: assetError } = await supabase
          .from("assets")
          .insert({
            client_id: project.client_id,
            filename: file.name,
            file_url: publicUrl,
            file_type: fileType,
            file_size: file.size,
          })
          .select()
          .single();

        if (assetError) throw assetError;

        const { error: linkError } = await supabase.from("project_assets").insert({
          project_id: project.id,
          asset_id: asset.id,
          is_final_content: true,
        });

        if (linkError) throw linkError;
      }

      toast({
        title: "Success",
        description: "Final content uploaded successfully",
      });

      fetchFinalAssets();
      onUpdate();
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({
        title: "Error",
        description: "Failed to upload final content",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFinalAsset = async (assetId: string) => {
    try {
      const { error } = await supabase
        .from("project_assets")
        .update({ is_final_content: false })
        .eq("project_id", project.id)
        .eq("asset_id", assetId);

      if (error) throw error;

      toast({
        title: "Removed",
        description: "Asset removed from final content",
      });

      fetchFinalAssets();
      onUpdate();
    } catch (error) {
      console.error("Error removing final asset:", error);
      toast({
        title: "Error",
        description: "Failed to remove asset",
        variant: "destructive",
      });
    }
  };

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId) ? prev.filter((p) => p !== platformId) : [...prev, platformId],
    );
  };

  const handleSchedulePost = async () => {
    if (!scheduledDate) {
      toast({
        title: "Missing information",
        description: "Please select a date for scheduling",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Missing platforms",
        description: "Please select at least one platform",
        variant: "destructive",
      });
      return;
    }

    if (finalAssets.length === 0) {
      toast({
        title: "Missing content",
        description: "Please upload final content first",
        variant: "destructive",
      });
      return;
    }

    try {
      const [hours, minutes] = scheduledTime.split(":");
      const scheduleDateTime = new Date(scheduledDate);
      scheduleDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Convert local time to UTC before saving
      const utcDateTime = convertToUTC(scheduleDateTime, userTimezone);

      // Filter platforms to only supported ones (Instagram, Facebook)
      const supportedPlatforms = selectedPlatforms.filter((p) => p === "instagram" || p === "facebook");

      const { error } = await supabase
        .from("projects")
        .update({
          scheduled_time: utcDateTime,
          platforms: supportedPlatforms,
          platform_captions: captions,
          hashtags: hashtags || null,
          pipeline_stage: "scheduled",
        })
        .eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Scheduled",
        description: `Post scheduled successfully for ${format(scheduleDateTime, "PPP 'at' p")} (${userTimezone})`,
      });

      onUpdate();
    } catch (error) {
      console.error("Error scheduling post:", error);
      toast({
        title: "Error",
        description: "Failed to schedule post",
        variant: "destructive",
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Filter platforms to only supported ones (Instagram, Facebook)
      const supportedPlatforms = selectedPlatforms.filter((p) => p === "instagram" || p === "facebook");

      const updateData: any = {
        platforms: supportedPlatforms,
        platform_captions: captions,
        hashtags: hashtags || null,
      };

      if (scheduledDate && scheduledTime) {
        const [hours, minutes] = scheduledTime.split(":");
        const scheduleDateTime = new Date(scheduledDate);
        scheduleDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        // Convert local time to UTC before saving
        updateData.scheduled_time = convertToUTC(scheduleDateTime, userTimezone);
      }

      const { error } = await supabase.from("projects").update(updateData).eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Final content settings updated successfully",
      });

      onUpdate();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading final content...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Error Message Display */}
      {project.error_message && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-destructive mb-1">Publishing Failed</h4>
                <p className="text-sm text-destructive/90">{project.error_message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Final Content */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Final Content</h3>
          <label htmlFor="final-content-upload">
            <Button disabled={uploading} asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Final Content"}
              </span>
            </Button>
          </label>
          <input
            id="final-content-upload"
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {finalAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed rounded-lg">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Final Content</h3>
            <p className="text-muted-foreground text-center mb-4">
              Upload the final content that clients will see for review
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {finalAssets.map((asset) => (
              <Card key={asset.id} className="relative group overflow-hidden">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {asset.file_type === "image" ? (
                    <img src={asset.file_url} alt={asset.filename} className="w-full h-full object-cover" />
                  ) : asset.file_type === "video" ? (
                    <video src={asset.file_url} className="w-full h-full object-cover" />
                  ) : (
                    <p className="text-sm text-muted-foreground">{asset.filename}</p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveFinalAsset(asset.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="p-2 bg-background">
                  <p className="text-xs truncate">{asset.filename}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Platform Selection */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Publishing Platforms</Label>
        <div className="grid grid-cols-2 gap-3">
          {PLATFORMS.map((platform) => (
            <div key={platform.id} className="flex items-center space-x-2 opacity-100">
              <Checkbox
                id={platform.id}
                checked={selectedPlatforms.includes(platform.id)}
                onCheckedChange={() => handlePlatformToggle(platform.id)}
                disabled={!platform.enabled}
              />
              <label
                htmlFor={platform.id}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
              >
                {platform.label}
                {!platform.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    Coming Soon
                  </Badge>
                )}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Platform-Specific Captions */}
      {selectedPlatforms.length > 0 && (
        <div className="space-y-4">
          <Label className="text-base font-semibold">Platform Captions</Label>
          {selectedPlatforms.map((platformId) => {
            const platform = PLATFORMS.find((p) => p.id === platformId);
            return (
              <div key={platformId} className="space-y-2">
                <Label htmlFor={`caption-${platformId}`}>{platform?.label}</Label>
                <Textarea
                  id={`caption-${platformId}`}
                  placeholder={`Write caption for ${platform?.label}...`}
                  value={captions[platformId] || ""}
                  onChange={(e) =>
                    setCaptions((prev) => ({
                      ...prev,
                      [platformId]: e.target.value,
                    }))
                  }
                  rows={4}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Hashtags */}
      <div className="space-y-2">
        <Label htmlFor="hashtags">Hashtags</Label>
        <Textarea
          id="hashtags"
          placeholder="#contentmarketing #socialmedia #brand"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          rows={2}
        />
      </div>

      {/* Schedule Post Section */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Schedule Post</h3>
              <Badge variant="secondary" className="gap-1">
                <Globe className="h-3 w-3" />
                {userTimezone}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => window.open("/scheduling-debug", "_blank")}>
              <ExternalLink className="h-3 w-3 mr-1" />
              Debug
            </Button>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg text-sm space-y-1">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium">How scheduling works:</p>
                <ul className="text-xs space-y-0.5 text-muted-foreground">
                  <li>
                    • Pick a time in <span className="font-medium text-foreground">{userTimezone}</span>
                  </li>
                  <li>• System stores it in UTC for autoposting</li>
                  <li>• Displays always show your local timezone</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input id="time" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            {scheduledDate && scheduledTime && (
              <p className="text-xs text-muted-foreground mt-1">
                Will be saved as: {format(convertToUTC(
                  new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate(), parseInt(scheduledTime.split(':')[0]), parseInt(scheduledTime.split(':')[1])),
                  userTimezone
                ), "HH:mm")} UTC (server time)
              </p>
            )}
          </div>
        </div>

        {/* Optimal Posting Times */}
        {selectedPlatforms.length > 0 && scheduledDate && (
          <Card className="p-4 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-start gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm mb-2">Optimal Posting Times</h4>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-3">
                    {getAllPlatformSuggestions(selectedPlatforms, scheduledDate).map(
                      ({ platform, suggestedTime, rules }) => (
                        <div key={platform} className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="capitalize">
                              {platform}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Best time: {format(suggestedTime, "h:mm a")}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => setScheduledTime(format(suggestedTime, "HH:mm"))}
                            >
                              Use this time
                            </Button>
                          </div>
                          {rules && rules.bestPractices.length > 0 && (
                            <ul className="text-xs text-muted-foreground ml-2 space-y-0.5">
                              {rules.bestPractices.slice(0, 2).map((practice, idx) => (
                                <li key={idx}>• {practice}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </Card>
        )}

        <Button
          onClick={handleSchedulePost}
          className="w-full"
          disabled={!scheduledDate || selectedPlatforms.length === 0 || finalAssets.length === 0 || uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Scheduling...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Schedule Post
            </>
          )}
        </Button>

        {project.status === "published" && project.published_urls && (
          <div className="space-y-2 mt-4 p-3 rounded bg-green-500/10 border border-green-500/20">
            <p className="text-sm font-medium text-green-600">✓ Published successfully</p>
            <div className="space-y-1">
              {Object.entries(project.published_urls as Record<string, string>).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline block"
                >
                  View on {platform.charAt(0).toUpperCase() + platform.slice(1)} →
                </a>
              ))}
            </div>
          </div>
        )}

        {project.status === "scheduled" && project.scheduled_time && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Scheduled for:</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold">
                  {format(convertToLocal(project.scheduled_time, userTimezone), "MMMM d, yyyy")} at{" "}
                  {format(convertToLocal(project.scheduled_time, userTimezone), "h:mm a")}
                </p>
                <Badge variant="secondary" className="gap-1">
                  <Globe className="h-3 w-3" />
                  {userTimezone}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                UTC: {new Date(project.scheduled_time).toISOString().replace("T", " ").slice(0, 19)} (server time)
              </p>
            </div>
          </div>
        )}

        {project.status === "failed" && project.error_message && (
          <p className="text-sm text-red-600 mt-4">✕ Publishing failed: {project.error_message}</p>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSaveSettings}>Save Settings</Button>
      </div>
    </div>
  );
}
