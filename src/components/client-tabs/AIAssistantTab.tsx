import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Copy, Save, Loader2, Lightbulb, MessageSquare } from "lucide-react";
import { useRole } from "@/hooks/useRole";

interface AIAssistantTabProps {
  clientId: string;
}

export default function AIAssistantTab({ clientId }: AIAssistantTabProps) {
  const { toast } = useToast();
  const { canCreateContent, isViewer } = useRole();
  
  // Caption Generator State
  const [captionPlatform, setCaptionPlatform] = useState<string>("");
  const [captionTone, setCaptionTone] = useState<string>("");
  const [captionKeywords, setCaptionKeywords] = useState<string>("");
  const [generatedCaptions, setGeneratedCaptions] = useState<Array<{ caption: string; hashtags: string[] }>>([]);
  const [captionLoading, setCaptionLoading] = useState(false);

  // Idea Generator State
  const [ideaNiche, setIdeaNiche] = useState<string>("");
  const [ideaPillars, setIdeaPillars] = useState<string>("");
  const [ideaTrends, setIdeaTrends] = useState<string>("");
  const [generatedIdeas, setGeneratedIdeas] = useState<Array<{ title: string; description: string; tags: string[] }>>([]);
  const [ideaLoading, setIdeaLoading] = useState(false);

  // Usage state
  const [usage, setUsage] = useState<{ used: number; quota: number; remaining: number } | null>(null);
  const [brandVoice, setBrandVoice] = useState<any>(null);

  useEffect(() => {
    loadBrandVoice();
  }, [clientId]);

  const loadBrandVoice = async () => {
    try {
      const { data, error } = await supabase
        .from('client_brand_voice')
        .select('*')
        .eq('client_id', clientId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading brand voice:', error);
        return;
      }

      if (data) {
        setBrandVoice({
          tone: data.tone,
          vocabulary: data.vocabulary,
          rules: data.rules,
        });
      }
    } catch (error) {
      console.error('Error loading brand voice:', error);
    }
  };

  const handleGenerateCaptions = async () => {
    if (!captionPlatform || !captionTone || !captionKeywords.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setCaptionLoading(true);
    try {
      // Get current session to verify authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to use AI features",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-ai-content', {
        body: {
          type: 'caption',
          platform: captionPlatform,
          tone: captionTone,
          keywords: captionKeywords,
          brandVoice: brandVoice || undefined,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data.error) {
        toast({
          title: "Generation Failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setGeneratedCaptions(data.content);
      setUsage(data.usage);
      toast({
        title: "Captions Generated!",
        description: `Generated ${data.content.length} caption variations`,
      });
    } catch (error: any) {
      console.error('Error generating captions:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate captions",
        variant: "destructive",
      });
    } finally {
      setCaptionLoading(false);
    }
  };

  const handleSaveCaption = async (caption: string, hashtags: string[]) => {
    try {
      const fullCaption = `${caption}\n\n${hashtags.join(' ')}`;
      
      const { error } = await supabase.from('client_saved_captions').insert({
        client_id: clientId,
        caption: fullCaption,
      });

      if (error) throw error;

      toast({
        title: "Saved!",
        description: "Caption saved to library",
      });
    } catch (error: any) {
      console.error('Error saving caption:', error);
      toast({
        title: "Error",
        description: "Failed to save caption",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Caption copied to clipboard",
    });
  };

  const handleGenerateIdeas = async () => {
    if (!ideaNiche.trim() || !ideaPillars.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in niche and content pillars",
        variant: "destructive",
      });
      return;
    }

    setIdeaLoading(true);
    try {
      // Get current session to verify authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to use AI features",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-ai-content', {
        body: {
          type: 'idea',
          niche: ideaNiche,
          contentPillars: ideaPillars,
          trends: ideaTrends || undefined,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data.error) {
        toast({
          title: "Generation Failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setGeneratedIdeas(data.content);
      setUsage(data.usage);

      // Auto-save ideas to Ideas board
      const ideaInserts = data.content.map((idea: any) => ({
        client_id: clientId,
        title: idea.title,
        description: idea.description,
        tags: idea.tags,
        status: 'draft',
      }));

      const { error: insertError } = await supabase
        .from('ideas')
        .insert(ideaInserts);

      if (insertError) throw insertError;

      toast({
        title: "Ideas Generated!",
        description: `Generated ${data.content.length} ideas and added to Ideas board`,
      });
    } catch (error: any) {
      console.error('Error generating ideas:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate ideas",
        variant: "destructive",
      });
    } finally {
      setIdeaLoading(false);
    }
  };

  if (isViewer) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">You don't have permission to use AI Assistant</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Voice Status */}
      {brandVoice && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium">Brand Voice Active</span>
              </div>
              <Badge variant="secondary" className="text-sm">
                {brandVoice.tone.slice(0, 3).join(', ')}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Badge */}
      {usage && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium">AI Generations This Month</span>
              </div>
              <Badge variant={usage.remaining < 10 ? "destructive" : "secondary"} className="text-sm">
                {usage.used} / {usage.quota} used ({usage.remaining} remaining)
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Caption Generator */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle>AI Caption Generator</CardTitle>
          </div>
          <CardDescription>Generate engaging captions with recommended hashtags</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={captionPlatform} onValueChange={setCaptionPlatform}>
                <SelectTrigger id="platform">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="Twitter">Twitter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <Select value={captionTone} onValueChange={setCaptionTone}>
                <SelectTrigger id="tone">
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="fun">Fun</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                  <SelectItem value="persuasive">Persuasive</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="inspiring">Inspiring</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input
                id="keywords"
                placeholder="e.g., summer, sale, fashion"
                value={captionKeywords}
                onChange={(e) => setCaptionKeywords(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleGenerateCaptions}
            disabled={captionLoading || !canCreateContent}
            className="w-full"
          >
            {captionLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Captions
              </>
            )}
          </Button>

          {generatedCaptions.length > 0 && (
            <div className="space-y-3 mt-6">
              <Separator />
              <h4 className="font-semibold">Generated Captions:</h4>
              {generatedCaptions.map((item, index) => (
                <Card key={index} className="p-4">
                  <p className="text-sm mb-3">{item.caption}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.hashtags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(`${item.caption}\n\n${item.hashtags.join(' ')}`)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveCaption(item.caption, item.hashtags)}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save to Library
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Idea Generator */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <CardTitle>AI Idea Generator</CardTitle>
          </div>
          <CardDescription>Generate creative content ideas based on your niche and pillars</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="niche">Client Niche</Label>
              <Input
                id="niche"
                placeholder="e.g., Fitness coaching"
                value={ideaNiche}
                onChange={(e) => setIdeaNiche(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pillars">Content Pillars</Label>
              <Input
                id="pillars"
                placeholder="e.g., Nutrition, Workouts, Mindset"
                value={ideaPillars}
                onChange={(e) => setIdeaPillars(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trends">Current Trends (Optional)</Label>
            <Textarea
              id="trends"
              placeholder="e.g., Intermittent fasting, HIIT workouts..."
              value={ideaTrends}
              onChange={(e) => setIdeaTrends(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            onClick={handleGenerateIdeas}
            disabled={ideaLoading || !canCreateContent}
            className="w-full"
          >
            {ideaLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Ideas
              </>
            )}
          </Button>

          {generatedIdeas.length > 0 && (
            <div className="space-y-3 mt-6">
              <Separator />
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Generated Ideas:</h4>
                <Badge variant="secondary">Auto-saved to Ideas board</Badge>
              </div>
              {generatedIdeas.map((idea, index) => (
                <Card key={index} className="p-4">
                  <h5 className="font-semibold mb-2">{idea.title}</h5>
                  <p className="text-sm text-muted-foreground mb-3">{idea.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {idea.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
