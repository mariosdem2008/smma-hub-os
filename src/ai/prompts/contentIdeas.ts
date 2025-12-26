import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  mode: "ideas" | "hook" | "caption" | "script" | "rewrite";
  platform?: string;
  brandContext?: string;
  inputText?: string;
};

export function buildContentIdeasPrompt(args: PromptArgs): ChatMessage[] {
  const platform = args.platform || "social media";
  const brandInfo = args.brandContext || "";

  switch (args.mode) {
    case "ideas":
      return [
        { role: "system", content: "You are a creative content strategist. Generate innovative, actionable content ideas." },
        {
          role: "user",
          content: `Generate 5 content ideas for ${platform}. ${brandInfo}\n\nReturn as JSON array: [{"title": "...", "description": "..."}]`,
        },
      ];
    case "hook":
      return [
        { role: "system", content: "You are an expert copywriter. Generate attention-grabbing hooks for social media content." },
        {
          role: "user",
          content: `Generate 5 powerful hooks for ${platform} content. ${brandInfo}\n\nReturn as JSON array: [{"text": "..."}]`,
        },
      ];
    case "caption":
      return [
        { role: "system", content: "You are an expert social media content creator. Generate engaging captions optimized for the platform." },
        {
          role: "user",
          content: `Generate 3 captions for ${platform}. ${brandInfo}\n\nReturn as JSON array: [{"text": "..."}]`,
        },
      ];
    case "script":
      return [
        { role: "system", content: "You are a video script writer. Generate engaging video scripts with clear structure." },
        {
          role: "user",
          content: `Generate 3 video script variations for ${platform}. ${brandInfo}\n\nEach script should have:\n- Hook (first 3 seconds)\n- Body (main content)\n- CTA (call to action)\n\nReturn as JSON array: [{"text": "..."}]`,
        },
      ];
    case "rewrite":
      return [
        { role: "system", content: "You are an expert editor. Improve the given text while maintaining its core message." },
        {
          role: "user",
          content: `Improve this text for ${platform}: "${args.inputText ?? ""}"\n\n${brandInfo}\n\nReturn as JSON array with 3 variations: [{"text": "..."}]`,
        },
      ];
    default:
      return [
        { role: "system", content: "You are a content strategist." },
        { role: "user", content: "Provide content ideas." },
      ];
  }
}
