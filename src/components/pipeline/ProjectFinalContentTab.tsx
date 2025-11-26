import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Video, Image as ImageIcon, AlertCircle, Upload, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";

interface Project {
  id: string;
  client_id: string;
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
  const [finalAssets, setFinalAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(project.platforms || []);
  const [captions, setCaptions] = useState<Record<string, string>>(project.platform_captions || {});
  const [hashtags, setHashtags] = useState(project.hashtags || "");

  useEffect(() => {
    fetchFinalAssets();
  }, [project.id]);

  const fetchFinalAssets = async () => {
    try {
      const { data, error } = await supabase
        .from("project_assets")
        .select("asset_id, assets(id, filename, file_url, file_type)")
        .eq("project_id", project.id)
        .eq("is_final_content", true);

      if (error) throw error;
      
      const assets = data
        ?.map((pa: any) => pa.assets)
        .filter(Boolean) as Asset[];
      
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

        const { error: uploadError } = await supabase.storage
          .from("client-assets")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("client-assets")
          .getPublicUrl(filePath);

        const fileType = file.type.startsWith("image/") ? "image" : 
                         file.type.startsWith("video/") ? "video" : "document";

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

        const { error: linkError } = await supabase
          .from("project_assets")
          .insert({
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

  return (
    <div className="space-y-6 p-6">
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
                    <img
                      src={asset.file_url}
                      alt={asset.filename}
                      className="w-full h-full object-cover"
                    />
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
