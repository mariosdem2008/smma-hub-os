import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Video, Image as ImageIcon, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface Project {
  id: string;
  final_asset_id: string | null;
  platforms: string[];
  platform_captions: Record<string, string>;
  hashtags: string | null;
  scheduled_time: string | null;
}

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
}

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "linkedin", label: "LinkedIn" },
];

interface ProjectFinalContentTabProps {
  project: Project;
  onUpdate: () => void;
}

export default function ProjectFinalContentTab({ project, onUpdate }: ProjectFinalContentTabProps) {
  const { toast } = useToast();
  const [finalAsset, setFinalAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(project.platforms || []);
  const [captions, setCaptions] = useState<Record<string, string>>(project.platform_captions || {});
  const [hashtags, setHashtags] = useState(project.hashtags || "");

  useEffect(() => {
    fetchFinalAsset();
  }, [project.final_asset_id]);

  const fetchFinalAsset = async () => {
    if (!project.final_asset_id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("assets")
        .select("id, filename, file_url, file_type")
        .eq("id", project.final_asset_id)
        .single();

      if (error) throw error;
      setFinalAsset(data);
    } catch (error) {
      console.error("Error fetching final asset:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          platforms: selectedPlatforms,
          platform_captions: captions,
          hashtags: hashtags || null,
        })
        .eq("id", project.id);

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

  if (!finalAsset) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Final Content Set</h3>
        <p className="text-muted-foreground text-center mb-4">
          Go to the Assets tab and mark one asset as "Final Content" to prepare it for client review
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Final Asset Preview */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Final Content Asset</h3>
        <div className="aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
          {finalAsset.file_type === "image" ? (
            <img src={finalAsset.file_url} alt={finalAsset.filename} className="w-full h-full object-contain" />
          ) : finalAsset.file_type === "video" ? (
            <video src={finalAsset.file_url} controls className="w-full h-full" />
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground">{finalAsset.filename}</p>
            </div>
          )}
        </div>
      </div>

      {/* Platform Selection */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Publishing Platforms</Label>
        <div className="grid grid-cols-2 gap-3">
          {PLATFORMS.map((platform) => (
            <div key={platform.id} className="flex items-center space-x-2">
              <Checkbox
                id={platform.id}
                checked={selectedPlatforms.includes(platform.id)}
                onCheckedChange={() => handlePlatformToggle(platform.id)}
              />
              <label
                htmlFor={platform.id}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {platform.label}
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

      {/* Scheduled Time Display */}
      {project.scheduled_time && (
        <div className="p-4 rounded-lg bg-muted">
          <p className="text-sm font-medium mb-1">Scheduled Time</p>
          <p className="text-sm text-muted-foreground">
            {new Date(project.scheduled_time).toLocaleString()}
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSaveSettings}>Save Settings</Button>
      </div>
    </div>
  );
}
