import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, RefreshCw, Plus, X, CheckCircle, XCircle } from "lucide-react";
import { useRole } from "@/hooks/useRole";

interface BrandVoiceTabProps {
  clientId: string;
  agencyId: string;
}

interface BrandVoice {
  tone: string[];
  vocabulary: string[];
  rules: {
    do: string[];
    dont: string[];
  };
  examples: string[];
}

export default function BrandVoiceTab({ clientId, agencyId }: BrandVoiceTabProps) {
  const { toast } = useToast();
  const { isViewer } = useRole();
  
  const [textSamples, setTextSamples] = useState<string[]>(['', '', '']);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [brandVoice, setBrandVoice] = useState<BrandVoice | null>(null);
  const [applyToAI, setApplyToAI] = useState(true);
  const [hasExistingVoice, setHasExistingVoice] = useState(false);

  useEffect(() => {
    loadExistingBrandVoice();
  }, [clientId]);

  const loadExistingBrandVoice = async () => {
    try {
      const { data, error } = await supabase
        .from('client_brand_voice')
        .select('*')
        .eq('client_id', clientId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setBrandVoice({
          tone: data.tone as string[],
          vocabulary: data.vocabulary as string[],
          rules: data.rules as { do: string[]; dont: string[] },
          examples: data.examples as string[],
        });
        setHasExistingVoice(true);
      }
    } catch (error: any) {
      console.error('Error loading brand voice:', error);
    }
  };

  const handleAddSample = () => {
    if (textSamples.length < 5) {
      setTextSamples([...textSamples, '']);
    }
  };

  const handleRemoveSample = (index: number) => {
    if (textSamples.length > 1) {
      setTextSamples(textSamples.filter((_, i) => i !== index));
    }
  };

  const handleSampleChange = (index: number, value: string) => {
    const newSamples = [...textSamples];
    newSamples[index] = value;
    setTextSamples(newSamples);
  };

  const handleGenerateBrandVoice = async () => {
    const filledSamples = textSamples.filter(s => s.trim() !== '');
    
    if (filledSamples.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please provide at least one text sample",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to use this feature",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-brand-voice', {
        body: {
          textSamples: filledSamples,
          websiteUrl: websiteUrl.trim() || null,
          clientId,
          agencyId,
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

      setBrandVoice(data.brandVoice);
      setHasExistingVoice(true);
      
      toast({
        title: "Brand Voice Generated!",
        description: "Your brand voice has been analyzed and saved",
      });
    } catch (error: any) {
      console.error('Error generating brand voice:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate brand voice",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    setBrandVoice(null);
    setHasExistingVoice(false);
  };

  if (isViewer) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">You don't have permission to manage brand voice</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>Brand Voice AI Extractor</CardTitle>
              </div>
              <CardDescription>
                Upload 3-5 text samples to extract your client's unique brand voice
              </CardDescription>
            </div>
            {hasExistingVoice && (
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Text Samples ({textSamples.filter(s => s.trim()).length}/5)</Label>
              {textSamples.length < 5 && (
                <Button variant="ghost" size="sm" onClick={handleAddSample}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Sample
                </Button>
              )}
            </div>

            {textSamples.map((sample, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`sample-${index}`}>Sample {index + 1}</Label>
                  {textSamples.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSample(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Textarea
                  id={`sample-${index}`}
                  placeholder="Paste content sample here (social post, email, website copy, etc.)"
                  value={sample}
                  onChange={(e) => handleSampleChange(index, e.target.value)}
                  rows={4}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website URL (Optional)</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="apply-ai"
              checked={applyToAI}
              onCheckedChange={setApplyToAI}
            />
            <Label htmlFor="apply-ai">Apply to AI Assistant automatically</Label>
          </div>

          <Button
            onClick={handleGenerateBrandVoice}
            disabled={loading || textSamples.filter(s => s.trim()).length === 0}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Brand Voice...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {hasExistingVoice ? 'Update Brand Voice' : 'Generate Brand Voice'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Output Section */}
      {brandVoice && (
        <div className="space-y-6">
          {/* Tone Descriptors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tone Descriptors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {brandVoice.tone.map((tone, index) => (
                  <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                    {tone}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Vocabulary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Characteristic Vocabulary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {brandVoice.vocabulary.map((word, index) => (
                  <Badge key={index} variant="outline" className="text-sm">
                    {word}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Writing Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Writing Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Do
                </h4>
                <ul className="space-y-1 ml-6">
                  {brandVoice.rules.do.map((rule, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      • {rule}
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Don't
                </h4>
                <ul className="space-y-1 ml-6">
                  {brandVoice.rules.dont.map((rule, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      • {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Example Caption */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Example in Brand Voice</CardTitle>
            </CardHeader>
            <CardContent>
              {brandVoice.examples.map((example, index) => (
                <div key={index} className="p-4 bg-muted rounded-lg">
                  <p className="text-sm italic">{example}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
