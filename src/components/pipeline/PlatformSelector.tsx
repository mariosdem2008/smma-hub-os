import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface PlatformSelectorProps {
  selectedPlatforms: string[];
  onPlatformsChange: (platforms: string[]) => void;
  aspectRatio: { width: number; height: number } | null;
}

const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', recommended: '9:16 (1080x1920)' },
  { id: 'instagram', name: 'Instagram Reels', recommended: '9:16 (1080x1920)' },
  { id: 'youtube', name: 'YouTube Shorts', recommended: '9:16 (1080x1920)' },
  { id: 'facebook', name: 'Facebook', recommended: '16:9 (1920x1080) or 1:1 (1080x1080)' },
  { id: 'linkedin', name: 'LinkedIn', recommended: '16:9 (1920x1080) or 1:1 (1080x1080)' }
];

export function PlatformSelector({ selectedPlatforms, onPlatformsChange, aspectRatio }: PlatformSelectorProps) {
  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      onPlatformsChange(selectedPlatforms.filter(p => p !== platformId));
    } else {
      onPlatformsChange([...selectedPlatforms, platformId]);
    }
  };

  const getAspectRatioWarning = (platform: { id: string }) => {
    if (!aspectRatio) return false;
    
    const ratio = aspectRatio.width / aspectRatio.height;
    
    // Vertical platforms (9:16)
    if (['tiktok', 'instagram', 'youtube'].includes(platform.id)) {
      return Math.abs(ratio - 0.5625) > 0.1; // 9/16 = 0.5625
    }
    
    // Horizontal/square platforms (16:9 or 1:1)
    if (['facebook', 'linkedin'].includes(platform.id)) {
      const isHorizontal = Math.abs(ratio - 1.778) < 0.1; // 16/9 = 1.778
      const isSquare = Math.abs(ratio - 1) < 0.1;
      return !isHorizontal && !isSquare;
    }
    
    return false;
  };

  return (
    <div className="space-y-3">
      <Label>Select Platforms</Label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PLATFORMS.map(platform => {
          const hasWarning = selectedPlatforms.includes(platform.id) && getAspectRatioWarning(platform);
          return (
            <div
              key={platform.id}
              className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                id={platform.id}
                checked={selectedPlatforms.includes(platform.id)}
                onCheckedChange={() => togglePlatform(platform.id)}
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor={platform.id} className="cursor-pointer font-medium">
                  {platform.name}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recommended: {platform.recommended}
                </p>
                {hasWarning && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Aspect ratio mismatch
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
