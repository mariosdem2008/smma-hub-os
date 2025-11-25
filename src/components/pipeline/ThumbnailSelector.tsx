import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, Image as ImageIcon } from "lucide-react";

interface ThumbnailSelectorProps {
  assetUrl: string;
  assetType: string;
  currentThumbnail: string;
  onThumbnailChange: (url: string) => void;
  assetId: string;
}

export function ThumbnailSelector({
  assetUrl,
  assetType,
  currentThumbnail,
  onThumbnailChange,
  assetId
}: ThumbnailSelectorProps) {
  const { toast } = useToast();
  const [videoThumbnails, setVideoThumbnails] = useState<string[]>([]);
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (assetType.startsWith('video/')) {
      generateVideoThumbnails();
    }
  }, [assetUrl, assetType]);

  const generateVideoThumbnails = async () => {
    setGeneratingThumbnails(true);
    try {
      const video = document.createElement('video');
      video.src = assetUrl;
      video.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = (320 * video.videoHeight) / video.videoWidth;
      const ctx = canvas.getContext('2d')!;

      const thumbnails: string[] = [];
      const duration = video.duration;
      const intervals = 8;

      for (let i = 0; i < intervals; i++) {
        const time = (duration / (intervals + 1)) * (i + 1);
        video.currentTime = time;
        
        await new Promise(resolve => {
          video.onseeked = resolve;
        });

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbnails.push(canvas.toDataURL('image/jpeg', 0.8));
      }

      setVideoThumbnails(thumbnails);
    } catch (error) {
      console.error('Error generating thumbnails:', error);
      toast({
        title: "Error",
        description: "Failed to generate video thumbnails",
        variant: "destructive"
      });
    } finally {
      setGeneratingThumbnails(false);
    }
  };

  const handleCustomUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${assetId}-thumb-${Date.now()}.${fileExt}`;
      const filePath = `${assetId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      onThumbnailChange(publicUrl);
      
      toast({
        title: "Thumbnail uploaded",
        description: "Custom thumbnail has been set"
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const selectThumbnail = async (thumbnail: string) => {
    setUploading(true);
    try {
      // Convert base64 to blob
      const response = await fetch(thumbnail);
      const blob = await response.blob();
      
      const fileName = `${assetId}-thumb-${Date.now()}.jpg`;
      const filePath = `${assetId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      onThumbnailChange(publicUrl);
      
      toast({
        title: "Thumbnail selected",
        description: "Video thumbnail has been set"
      });
    } catch (error: any) {
      console.error('Thumbnail selection error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  if (!assetType.startsWith('video/')) {
    return null; // Only show for videos
  }

  return (
    <div className="space-y-3">
      <Label>Thumbnail</Label>
      
      {/* Current Thumbnail */}
      {currentThumbnail && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Current thumbnail:</p>
          <img src={currentThumbnail} alt="Current thumbnail" className="w-32 h-auto rounded border-2 border-primary" />
        </div>
      )}

      {/* Auto-generated thumbnails */}
      {generatingThumbnails ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Generating thumbnails...</span>
        </div>
      ) : videoThumbnails.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Select a frame:</p>
          <div className="grid grid-cols-4 gap-2">
            {videoThumbnails.map((thumb, index) => (
              <button
                key={index}
                type="button"
                onClick={() => selectThumbnail(thumb)}
                disabled={uploading}
                className="relative rounded border-2 border-border hover:border-primary transition-colors overflow-hidden"
              >
                <img src={thumb} alt={`Frame ${index + 1}`} className="w-full h-auto" />
                {uploading && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Custom upload */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Or upload custom thumbnail:</p>
        <div className="flex gap-2">
          <Input
            type="file"
            accept="image/*"
            onChange={handleCustomUpload}
            disabled={uploading}
            className="flex-1"
          />
          {uploading && <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
      </div>
    </div>
  );
}
