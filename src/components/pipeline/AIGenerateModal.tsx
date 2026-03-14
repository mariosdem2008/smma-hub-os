import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface AIGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "ideas" | "hooks" | "script" | "improve-script" | "captions" | "improve-caption";
  clientId: string;
  projectId?: string;
  onUse: (data: any) => void;
}

export function AIGenerateModal({ open, onOpenChange, type, clientId, projectId, onUse }: AIGenerateModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Form fields
  const [platform, setPlatform] = useState("instagram");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("engaging");
  const [niche, setNiche] = useState("");
  const [pillars, setPillars] = useState("");
  const [trends, setTrends] = useState("");
  const [currentText, setCurrentText] = useState("");

  const readFunctionErrorPayload = async (error: unknown): Promise<{ code?: string; error?: string; deep_link?: string } | null> => {
    if (!error || typeof error !== "object") return null;
    const context = (error as { context?: Response }).context;
    if (!context || typeof (context as any).json !== "function") return null;
    try {
      return await (context as any).json();
    } catch {
      return null;
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setSuggestions([]);

    try {
      // Map UI type to backend mode (based on edge function expectations)
      let mode: string;
      let input_text: string | undefined;
      let brand_context = "";

      switch (type) {
        case "ideas":
          mode = "ideas";
          brand_context = `Niche: ${niche || "general"}. Content Pillars: ${pillars || "education, entertainment, inspiration"}. ${trends ? `Trends: ${trends}` : ""}`;
          break;
        case "hooks":
          mode = "hook"; // Edge function expects 'hook' (singular)
          brand_context = `Tone: ${tone}. Topic: ${keywords || "engaging content"}`;
          break;
        case "script":
          mode = "script";
          brand_context = `Tone: ${tone}. Topic: ${keywords || "video content"}`;
          break;
        case "improve-script":
          mode = "rewrite"; // Edge function expects 'rewrite' for improvements
          input_text = currentText;
          brand_context = `Tone: ${tone}. Improve this script for ${platform}`;
          break;
        case "captions":
          mode = "caption"; // Edge function expects 'caption' (singular)
          brand_context = `Keywords: ${keywords || "engaging post"}. Platform: ${platform}`;
          break;
        case "improve-caption":
          mode = "rewrite"; // Edge function expects 'rewrite' for improvements
          input_text = currentText;
          brand_context = `Improve this caption for ${platform}`;
          break;
        default:
          mode = "caption";
      }

      const requestBody: any = {
        mode,
        client_id: clientId,
        platform: type === "captions" || type === "improve-caption" ? platform : null,
      };

      // Only include project_id if provided
      if (projectId) {
        requestBody.project_id = projectId;
      }

      // Only include brand_context if it has content
      if (brand_context.trim()) {
        requestBody.brand_context = brand_context;
      }

      // Only include input_text if it's a rewrite/improvement type
      if (input_text && (type === "improve-script" || type === "improve-caption")) {
        requestBody.input_text = input_text;
      }

      console.log("Calling AI edge function with:", requestBody);

      const { data, error } = await supabase.functions.invoke("generate-ai-content", {
        body: requestBody,
      });

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        if (payload?.code === "STRATEGY_APPROVAL_REQUIRED" || payload?.code === "AGENT_ACTIVATION_REQUIRED") {
          toast({
            title: payload.code === "AGENT_ACTIVATION_REQUIRED" ? "Creator activation required" : "Strategy approval required",
            description:
              payload.error ||
              (payload.code === "AGENT_ACTIVATION_REQUIRED"
                ? "Activate the creator agent in AI Setup before generating AI content."
                : "Approve the current recommendation and strategy plan before generating AI content."),
            variant: "destructive",
          });
          if (payload.deep_link) navigate(payload.deep_link);
          return;
        }
        throw error;
      }

      if (!data.success) {
        toast({
          title: "Generation Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive",
        });
        return;
      }

      // Handle the response format from the edge function
      if (data.suggestions) {
        setSuggestions(data.suggestions);

        // For captions, the edge function might return simple strings or objects
        if (type === "captions" && data.suggestions.length > 0) {
          // Format the suggestions if they're simple strings
          const formattedSuggestions = data.suggestions.map((suggestion: any, index: number) => {
            if (typeof suggestion === "string") {
              return {
                text: suggestion,
                platform: platform,
                id: index,
              };
            } else if (suggestion.text) {
              return {
                ...suggestion,
                platform: suggestion.platform || platform,
                id: index,
              };
            }
            return suggestion;
          });
          setSuggestions(formattedSuggestions);
        }
      }

      toast({
        title: "Generated!",
        description: `${data.suggestions?.length || 0} suggestions created`,
      });
    } catch (error: any) {
      console.error("AI generation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate content",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUse = (suggestion: any) => {
    // For captions, we need to format the data differently
    if (type === "captions") {
      // Return an object with platform mapping for captions
      const captionData: Record<string, string> = {};
      const captionText = suggestion.text || suggestion;
      captionData[platform] = captionText;
      onUse(captionData);
    } else if (type === "improve-caption") {
      // For improved captions, return as platform mapping
      const captionData: Record<string, string> = {};
      const captionText = suggestion.text || suggestion;
      captionData[platform] = captionText;
      onUse(captionData);
    } else {
      // For other types, pass the suggestion directly
      onUse(suggestion);
    }

    toast({
      title: "Applied",
      description: "Content has been added to your project",
    });
    onOpenChange(false);
  };

  const modalConfig = {
    ideas: {
      title: "Generate Content Ideas",
      description: "Get AI-powered content ideas for your client",
    },
    hooks: {
      title: "Generate Hooks",
      description: "Create attention-grabbing opening hooks",
    },
    script: {
      title: "Write Script",
      description: "Generate a complete video script",
    },
    "improve-script": {
      title: "Improve Script",
      description: "Enhance your existing script",
    },
    captions: {
      title: "Generate Captions",
      description: "Create platform-optimized captions",
    },
    "improve-caption": {
      title: "Improve Captions",
      description: "Enhance existing caption text",
    },
  };

  // Show platform selection for relevant types
  const showPlatformSelect = ["captions", "improve-caption", "hooks", "script", "improve-script"].includes(type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {modalConfig[type].title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{modalConfig[type].description}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Platform Selection for relevant types */}
          {showPlatformSelect && (
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Input Fields Based on Type */}
          {type === "ideas" && (
            <>
              <div className="space-y-2">
                <Label>Niche / Industry</Label>
                <Input
                  placeholder="e.g., fitness, real estate, tech"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Content Pillars (comma-separated)</Label>
                <Input
                  placeholder="e.g., education, tips, behind-the-scenes"
                  value={pillars}
                  onChange={(e) => setPillars(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Current Trends (optional)</Label>
                <Textarea
                  placeholder="Any trending topics or themes to incorporate"
                  value={trends}
                  onChange={(e) => setTrends(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}

          {(type === "hooks" || type === "script") && (
            <>
              <div className="space-y-2">
                <Label>Keywords / Topic</Label>
                <Input
                  placeholder="e.g., morning routine, productivity tips"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="engaging">Engaging</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="inspiring">Inspiring</SelectItem>
                    <SelectItem value="humorous">Humorous</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {type === "improve-script" && (
            <div className="space-y-2">
              <Label>Current Script</Label>
              <Textarea
                placeholder="Paste your existing script here"
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                rows={6}
              />
            </div>
          )}

          {type === "captions" && (
            <div className="space-y-2">
              <Label>Keywords / Topic (optional)</Label>
              <Input
                placeholder="e.g., summer collection, product launch"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>
          )}

          {type === "improve-caption" && (
            <div className="space-y-2">
              <Label>Current Caption</Label>
              <Textarea
                placeholder="Paste your existing caption here"
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={
              loading ||
              (type === "improve-script" && !currentText.trim()) ||
              (type === "improve-caption" && !currentText.trim())
            }
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>

          {/* Suggestions Display */}
          {suggestions.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-medium text-sm">Suggestions ({suggestions.length})</h4>
              {suggestions.map((suggestion, idx) => (
                <Card key={idx} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    {type === "ideas" && suggestion.title && (
                      <>
                        <div className="font-medium mb-2">{suggestion.title}</div>
                        <p className="text-sm text-muted-foreground mb-3">{suggestion.description}</p>
                      </>
                    )}

                    {/* For captions, show platform badge if available */}
                    {(type === "captions" || type === "improve-caption") && suggestion.platform && (
                      <div className="mb-2">
                        <span className="inline-block px-2 py-1 text-xs bg-primary/10 text-primary rounded">
                          {suggestion.platform}
                        </span>
                      </div>
                    )}

                    {/* All other types use text field */}
                    {(!suggestion.title || type !== "ideas") && (
                      <p className="text-sm mb-3 whitespace-pre-wrap">{suggestion.text || suggestion}</p>
                    )}

                    <Button variant="default" size="sm" className="w-full mt-3" onClick={() => handleUse(suggestion)}>
                      <Check className="h-4 w-4 mr-2" />
                      Use This
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && suggestions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {type === "improve-script" || type === "improve-caption"
                ? "Paste your existing content and click Generate to get improvements"
                : "Fill in the fields above and click Generate to get AI suggestions"}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
