import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Image, Lightbulb, Hash, Target, MessageSquare, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "idea" | "asset" | "inspiration" | "hashtag" | "pillar" | "caption" | "post";
  title: string;
  description?: string;
  icon: React.ReactNode;
  color: string;
  tab: string;
}

interface ClientSearchBarProps {
  clientId: string;
}

export default function ClientSearchBar({ clientId }: ClientSearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Map keywords to tabs
  const keywordToTab: Record<string, { tab: string; subtab?: string }> = {
    // Content Library
    "assets": { tab: "library" },
    "images": { tab: "library" },
    "videos": { tab: "library" },
    "files": { tab: "library" },
    "inspiration": { tab: "library" },
    "captions": { tab: "library" },
    "hashtags": { tab: "library" },
    
    // Content Planning
    "posts": { tab: "planning" },
    "calendar": { tab: "planning" },
    "ideas": { tab: "planning" },
    "pillars": { tab: "planning" },
    "content pillars": { tab: "planning" },
    
    // Workspace
    "tasks": { tab: "workspace" },
    "notes": { tab: "workspace" },
    
    // Other tabs
    "brand": { tab: "brand" },
    "branding": { tab: "brand" },
    "social": { tab: "social" },
    "portal": { tab: "portal" },
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(`/clients/${clientId}?tab=${result.tab}&search=${encodeURIComponent(result.title)}`);
    setShowResults(false);
    setQuery("");
  };

  const handleKeywordSearch = (keyword: string) => {
    const mapping = keywordToTab[keyword.toLowerCase()];
    if (mapping) {
      navigate(`/clients/${clientId}?tab=${mapping.tab}`);
      setShowResults(false);
      setQuery("");
      return true;
    }
    return false;
  };

  useEffect(() => {
    const searchContent = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        setShowResults(false);
        return;
      }

      // Check for keyword matches first
      const isKeyword = handleKeywordSearch(query.trim());
      if (isKeyword) {
        return;
      }

      setIsSearching(true);
      setShowResults(true);
      const searchTerm = `%${query.toLowerCase()}%`;
      const allResults: SearchResult[] = [];

      // Search Posts
      const { data: posts } = await supabase
        .from("posts")
        .select("id, title, platform")
        .eq("client_id", clientId)
        .ilike("title", searchTerm);

      if (posts) {
        posts.forEach((post) => {
          allResults.push({
            id: post.id,
            type: "post",
            title: post.title,
            description: post.platform || undefined,
            icon: <Calendar className="h-4 w-4" />,
            color: "text-blue-500",
            tab: "planning",
          });
        });
      }

      // Search Ideas
      const { data: ideas } = await supabase
        .from("client_ideas")
        .select("id, title, description")
        .eq("client_id", clientId)
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);

      if (ideas) {
        ideas.forEach((idea) => {
          allResults.push({
            id: idea.id,
            type: "idea",
            title: idea.title,
            description: idea.description || undefined,
            icon: <Lightbulb className="h-4 w-4" />,
            color: "text-yellow-500",
            tab: "planning",
          });
        });
      }

      // Search Assets
      const { data: assets } = await supabase
        .from("assets")
        .select("id, filename")
        .eq("client_id", clientId)
        .ilike("filename", searchTerm);

      if (assets) {
        assets.forEach((asset) => {
          allResults.push({
            id: asset.id,
            type: "asset",
            title: asset.filename,
            icon: <FileText className="h-4 w-4" />,
            color: "text-blue-500",
            tab: "library",
          });
        });
      }

      // Search Inspiration
      const { data: inspiration } = await supabase
        .from("client_inspiration")
        .select("id, description")
        .eq("client_id", clientId)
        .ilike("description", searchTerm);

      if (inspiration) {
        inspiration.forEach((item) => {
          if (item.description) {
            allResults.push({
              id: item.id,
              type: "inspiration",
              title: item.description,
              icon: <Image className="h-4 w-4" />,
              color: "text-purple-500",
              tab: "library",
            });
          }
        });
      }

      // Search Hashtags
      const { data: hashtags } = await supabase
        .from("client_hashtags")
        .select("id, tag, category")
        .eq("client_id", clientId)
        .or(`tag.ilike.${searchTerm},category.ilike.${searchTerm}`);

      if (hashtags) {
        hashtags.forEach((hashtag) => {
          allResults.push({
            id: hashtag.id,
            type: "hashtag",
            title: hashtag.tag,
            description: hashtag.category || undefined,
            icon: <Hash className="h-4 w-4" />,
            color: "text-green-500",
            tab: "library",
          });
        });
      }

      // Search Content Pillars
      const { data: pillars } = await supabase
        .from("client_content_pillars")
        .select("id, title, description")
        .eq("client_id", clientId)
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);

      if (pillars) {
        pillars.forEach((pillar) => {
          allResults.push({
            id: pillar.id,
            type: "pillar",
            title: pillar.title,
            description: pillar.description || undefined,
            icon: <Target className="h-4 w-4" />,
            color: "text-orange-500",
            tab: "planning",
          });
        });
      }

      // Search Saved Captions
      const { data: captions } = await supabase
        .from("client_saved_captions")
        .select("id, caption")
        .eq("client_id", clientId)
        .ilike("caption", searchTerm);

      if (captions) {
        captions.forEach((caption) => {
          allResults.push({
            id: caption.id,
            type: "caption",
            title: caption.caption.substring(0, 100) + (caption.caption.length > 100 ? "..." : ""),
            icon: <MessageSquare className="h-4 w-4" />,
            color: "text-pink-500",
            tab: "library",
          });
        });
      }

      setResults(allResults);
      setIsSearching(false);
    };

    const debounce = setTimeout(searchContent, 300);
    return () => clearTimeout(debounce);
  }, [query, clientId]);

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-foreground font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const getTypeBadge = (type: SearchResult["type"]) => {
    const badges = {
      post: { label: "Post", variant: "default" as const },
      idea: { label: "Idea", variant: "default" as const },
      asset: { label: "Asset", variant: "secondary" as const },
      inspiration: { label: "Inspiration", variant: "outline" as const },
      hashtag: { label: "Hashtag", variant: "default" as const },
      pillar: { label: "Pillar", variant: "secondary" as const },
      caption: { label: "Caption", variant: "outline" as const },
    };
    return badges[type];
  };

  return (
    <div className="relative w-full sm:max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          className="pl-10 h-9 w-full"
        />
      </div>

      {showResults && (
        <Card className="absolute top-full mt-2 w-full sm:max-w-md max-h-[70vh] sm:max-h-96 overflow-auto z-50 shadow-lg">
          <CardContent className="p-2">
            {isSearching ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results found for "{query}"
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((result) => {
                  const badge = getTypeBadge(result.type);
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors"
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("mt-0.5", result.color)}>
                          {result.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={badge.variant} className="text-xs">
                              {badge.label}
                            </Badge>
                          </div>
                          <div className="text-sm font-medium line-clamp-1">
                            {highlightMatch(result.title, query)}
                          </div>
                          {result.description && (
                            <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {highlightMatch(result.description, query)}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
