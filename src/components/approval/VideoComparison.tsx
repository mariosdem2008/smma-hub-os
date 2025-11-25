import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause } from "lucide-react";

interface VideoComparisonProps {
  currentUrl: string;
  previousUrl: string;
  fileType: string;
}

export default function VideoComparison({ 
  currentUrl, 
  previousUrl,
  fileType 
}: VideoComparisonProps) {
  const [sliderValue, setSliderValue] = useState([50]);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentVideoRef = useRef<HTMLVideoElement>(null);
  const previousVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Sync video playback
    const syncVideos = () => {
      if (currentVideoRef.current && previousVideoRef.current) {
        const current = currentVideoRef.current;
        const previous = previousVideoRef.current;
        
        if (Math.abs(current.currentTime - previous.currentTime) > 0.1) {
          previous.currentTime = current.currentTime;
        }
      }
    };

    const currentVideo = currentVideoRef.current;
    if (currentVideo) {
      currentVideo.addEventListener('timeupdate', syncVideos);
      return () => currentVideo.removeEventListener('timeupdate', syncVideos);
    }
  }, []);

  const handlePlayPause = () => {
    if (currentVideoRef.current && previousVideoRef.current) {
      if (isPlaying) {
        currentVideoRef.current.pause();
        previousVideoRef.current.pause();
      } else {
        currentVideoRef.current.play();
        previousVideoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (fileType.startsWith('video/')) {
    return (
      <div className="space-y-4">
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
          {/* Previous Version */}
          <div 
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${100 - sliderValue[0]}% 0 0)` }}
          >
            <video
              ref={previousVideoRef}
              src={previousUrl}
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
              Previous Version
            </div>
          </div>

          {/* Current Version */}
          <div 
            className="absolute inset-0"
            style={{ clipPath: `inset(0 0 0 ${sliderValue[0]}%)` }}
          >
            <video
              ref={currentVideoRef}
              src={currentUrl}
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
              Current Version
            </div>
          </div>

          {/* Divider Line */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
            style={{ left: `${sliderValue[0]}%` }}
          />
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={handlePlayPause}
            variant="outline"
            size="sm"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <Slider
            value={sliderValue}
            onValueChange={setSliderValue}
            max={100}
            step={1}
            className="flex-1"
          />
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Drag the slider to compare previous and current versions
        </p>
      </div>
    );
  }

  // Image comparison
  return (
    <div className="space-y-4">
      <div className="relative w-full aspect-video rounded-lg overflow-hidden">
        {/* Previous Version */}
        <div 
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - sliderValue[0]}% 0 0)` }}
        >
          <img
            src={previousUrl}
            alt="Previous version"
            className="w-full h-full object-contain"
          />
          <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
            Previous Version
          </div>
        </div>

        {/* Current Version */}
        <div 
          className="absolute inset-0"
          style={{ clipPath: `inset(0 0 0 ${sliderValue[0]}%)` }}
        >
          <img
            src={currentUrl}
            alt="Current version"
            className="w-full h-full object-contain"
          />
          <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
            Current Version
          </div>
        </div>

        {/* Divider Line */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
          style={{ left: `${sliderValue[0]}%` }}
        />
      </div>

      <Slider
        value={sliderValue}
        onValueChange={setSliderValue}
        max={100}
        step={1}
      />

      <p className="text-xs text-muted-foreground text-center">
        Drag the slider to compare previous and current versions
      </p>
    </div>
  );
}
