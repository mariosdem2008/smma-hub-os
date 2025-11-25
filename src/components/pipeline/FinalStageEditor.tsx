import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Wand2, Calendar } from "lucide-react";
import { AspectRatioWarning } from "./AspectRatioWarning";
import { PlatformSelector } from "./PlatformSelector";
import { ThumbnailSelector } from "./ThumbnailSelector";
import { CaptionEditor } from "./CaptionEditor";

interface FinalStageEditorProps {
  asset: {
    id: string;
    filename: string;
    file_url: string;
    file_type: string;
    thumbnail_url: string | null;
    final_caption: string | null;
    hashtags: string | null;
    platforms: string[] | null;
    scheduled_time: string | null;
  };
  clientId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function FinalStageEditor({ asset, clientId, onClose, onSuccess }: FinalStageEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(asset.platforms || []);
  const [caption, setCaption] = useState(asset.final_caption || "");
  const [hashtags, setHashtags] = useState(asset.hashtags || "");
  const [thumbnailUrl, setThumbnailUrl] = useState(asset.thumbnail_url || "");
  const [scheduledTime, setScheduledTime] = useState(
    asset.scheduled_time ? new Date(asset.scheduled_time).toISOString().slice(0, 16) : ""
  );
  const [aspectRatio, setAspectRatio] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    // Detect video dimensions for aspect ratio
    if (asset.file_type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = asset.file_url;
      video.onloadedmetadata = () => {
        setAspectRatio({ width: video.videoWidth, height: video.videoHeight });
      };
    }
  }, [asset.file_url, asset.file_type]);

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({
          final_caption: caption,
          hashtags,
          platforms: selectedPlatforms,
          thumbnail_url: thumbnailUrl,
          scheduled_time: scheduledTime || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', asset.id);

      if (error) throw error;

      toast({
        title: "Draft saved",
        description: "Metadata has been saved successfully"
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Save draft error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePost = async () => {
    if (!scheduledTime) {
      toast({
        title: "Scheduling required",
        description: "Please select a scheduled time",
        variant: "destructive"
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Platform required",
        description: "Please select at least one platform",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({
          final_caption: caption,
          hashtags,
          platforms: selectedPlatforms,
          thumbnail_url: thumbnailUrl,
          scheduled_time: scheduledTime,
          pipeline_stage: 'scheduled',
          updated_at: new Date().toISOString()
        })
        .eq('id', asset.id);

      if (error) throw error;

      toast({
        title: "Post scheduled",
        description: "Asset moved to Scheduled stage"
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Schedule post error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalize Metadata - {asset.filename}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Asset Preview */}
          <div className="space-y-2">
            <Label>Asset Preview</Label>
            {asset.file_type.startsWith('video/') ? (
              <video src={asset.file_url} controls className="w-full rounded-lg max-h-96" />
            ) : (
              <img src={asset.file_url} alt={asset.filename} className="w-full rounded-lg max-h-96 object-contain" />
            )}
            {aspectRatio && (
              <p className="text-sm text-muted-foreground">
                Dimensions: {aspectRatio.width}x{aspectRatio.height} ({(aspectRatio.width / aspectRatio.height).toFixed(2)})
              </p>
            )}
          </div>

          {/* Platform Selection */}
          <PlatformSelector
            selectedPlatforms={selectedPlatforms}
            onPlatformsChange={setSelectedPlatforms}
            aspectRatio={aspectRatio}
          />

          {/* Caption Editor with AI */}
          <CaptionEditor
            caption={caption}
            onCaptionChange={setCaption}
            selectedPlatforms={selectedPlatforms}
            clientId={clientId}
          />

          {/* Hashtags */}
          <div className="space-y-2">
            <Label htmlFor="hashtags">Hashtags</Label>
            <Textarea
              id="hashtags"
              placeholder="#hashtag1 #hashtag2 #hashtag3"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              rows={2}
            />
          </div>

          {/* Thumbnail Selector */}
          <ThumbnailSelector
            assetUrl={asset.file_url}
            assetType={asset.file_type}
            currentThumbnail={thumbnailUrl}
            onThumbnailChange={setThumbnailUrl}
            assetId={asset.id}
          />

          {/* Scheduling */}
          <div className="space-y-2">
            <Label htmlFor="scheduled_time">Schedule Date & Time</Label>
            <div className="flex gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-3" />
              <Input
                id="scheduled_time"
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSaveDraft} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Draft
          </Button>
          <Button onClick={handleSchedulePost} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Schedule Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
