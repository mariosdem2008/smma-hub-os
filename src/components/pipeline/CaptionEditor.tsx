import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CaptionEditorProps {
  caption: string;
  onCaptionChange: (caption: string) => void;
  selectedPlatforms: string[];
  clientId: string;
}

const PLATFORM_LIMITS = {
  tiktok: 2200,
  instagram: 2200,
  youtube: 5000,
  facebook: 63206,
  linkedin: 3000
};

export function CaptionEditor({ caption, onCaptionChange, selectedPlatforms, clientId }: CaptionEditorProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiVariants, setAiVariants] = useState<Array<{ caption: string; length: string }>>([]);
  const [showVariants, setShowVariants] = useState(false);

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

  const generateCaptionVariants = async () => {
    if (selectedPlatforms.length === 0) {
      toast({
        title: "Select platforms first",
        description: "Please select at least one platform",
        variant: "destructive"
      });
      return;
    }

    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-content', {
        body: {
          type: 'caption_variants',
          platforms: selectedPlatforms,
          clientId
        }
      });

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        if (payload?.code === "STRATEGY_APPROVAL_REQUIRED" || payload?.code === "AGENT_ACTIVATION_REQUIRED") {
          toast({
            title: payload.code === "AGENT_ACTIVATION_REQUIRED" ? "Creator activation required" : "Strategy approval required",
            description:
              payload.error ||
              (payload.code === "AGENT_ACTIVATION_REQUIRED"
                ? "Activate the creator agent in AI Setup before generating captions."
                : "Approve the current recommendation and strategy plan before generating captions."),
            variant: "destructive"
          });
          if (payload.deep_link) navigate(payload.deep_link);
          return;
        }
        throw error;
      }

      setAiVariants(data.content);
      setShowVariants(true);
      
      toast({
        title: "Caption variants generated",
        description: "Select a variant to apply"
      });
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast({
        title: "Error generating captions",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  const applyVariant = (variantCaption: string) => {
    onCaptionChange(variantCaption);
    setShowVariants(false);
    toast({
      title: "Caption applied",
      description: "AI-generated caption has been applied"
    });
  };

  const getCharacterLimit = () => {
    if (selectedPlatforms.length === 0) return null;
    return Math.min(...selectedPlatforms.map(p => PLATFORM_LIMITS[p as keyof typeof PLATFORM_LIMITS] || 2200));
  };

  const charLimit = getCharacterLimit();
  const isOverLimit = charLimit && caption.length > charLimit;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="caption">Caption</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={generateCaptionVariants}
          disabled={generatingAI || selectedPlatforms.length === 0}
        >
          {generatingAI ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Generate Variants
        </Button>
      </div>

      <Textarea
        id="caption"
        placeholder="Write your caption here..."
        value={caption}
        onChange={(e) => onCaptionChange(e.target.value)}
        rows={6}
        className={isOverLimit ? "border-destructive" : ""}
      />

      {charLimit && (
        <div className="flex items-center justify-between text-sm">
          <span className={isOverLimit ? "text-destructive" : "text-muted-foreground"}>
            {caption.length} / {charLimit} characters
          </span>
          {isOverLimit && (
            <Badge variant="destructive">Over limit by {caption.length - charLimit}</Badge>
          )}
        </div>
      )}

      {showVariants && aiVariants.length > 0 && (
        <div className="space-y-2 p-4 rounded-lg border border-border bg-accent/20">
          <Label>AI-Generated Variants</Label>
          {aiVariants.map((variant, index) => (
            <div
              key={index}
              className="p-3 rounded border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => applyVariant(variant.caption)}
            >
              <div className="flex items-start justify-between mb-2">
                <Badge variant="secondary">{variant.length}</Badge>
                <Button size="sm" variant="ghost">Apply</Button>
              </div>
              <p className="text-sm">{variant.caption}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
