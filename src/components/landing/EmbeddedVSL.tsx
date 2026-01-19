import { Play } from "lucide-react";

export function EmbeddedVSL() {
  return (
    <div className="relative aspect-video w-full max-w-4xl mx-auto my-10 rounded-lg border-2 border-primary/20 bg-card/40 shadow-2xl shadow-primary/10 overflow-hidden">
      {/* Placeholder for an embedded video player (e.g., Wistia, Vimeo) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm">
        <div className="w-20 h-20 rounded-full bg-primary/80 flex items-center justify-center text-primary-foreground mb-[4px]">
            <Play className="w-10 h-10 ml-1" />
        </div>
        <h3 className="text-2xl font-semibold text-foreground">Watch the 3-Min Value Demo</h3>
        <p className="text-muted-foreground">See how to scale your agency, not your headcount.</p>
      </div>
       {/* This would be replaced by the actual video player script/iframe */}
      <img src="/placeholder.svg" alt="Video Placeholder" className="w-full h-full object-cover opacity-10" />
    </div>
  );
}
