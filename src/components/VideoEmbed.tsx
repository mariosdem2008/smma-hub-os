interface VideoEmbedProps {
  url: string;
}

export function VideoEmbed({ url }: VideoEmbedProps) {
  // Extract video ID from YouTube URL
  const getYouTubeEmbedUrl = (videoUrl: string) => {
    try {
      const urlObj = new URL(videoUrl);
      let videoId = "";
      
      if (urlObj.hostname.includes("youtube.com")) {
        videoId = urlObj.searchParams.get("v") || "";
      } else if (urlObj.hostname.includes("youtu.be")) {
        videoId = urlObj.pathname.slice(1);
      }
      
      return videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl;
    } catch {
      return videoUrl;
    }
  };

  const embedUrl = getYouTubeEmbedUrl(url);

  return (
    <div className="aspect-video w-full">
      <iframe
        src={embedUrl}
        title="SMMAHUB Demo Video"
        className="w-full h-full rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
