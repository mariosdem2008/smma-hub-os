export type VideoEmbed = {
  provider: "loom" | "youtube" | "unknown";
  embedUrl: string | null;
};

function tryParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function getVideoEmbed(demoUrl: string | null): VideoEmbed {
  if (!demoUrl) return { provider: "unknown", embedUrl: null };
  const parsed = tryParseUrl(demoUrl);
  if (!parsed) return { provider: "unknown", embedUrl: null };

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "loom.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    // https://www.loom.com/share/{id}
    if (parts[0] === "share" && parts[1]) {
      return { provider: "loom", embedUrl: `https://www.loom.com/embed/${parts[1]}` };
    }
    // https://www.loom.com/embed/{id}
    if (parts[0] === "embed" && parts[1]) {
      return { provider: "loom", embedUrl: demoUrl };
    }
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = parsed.searchParams.get("v");
    if (id) return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` };
  }

  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    if (id) return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` };
  }

  return { provider: "unknown", embedUrl: null };
}

