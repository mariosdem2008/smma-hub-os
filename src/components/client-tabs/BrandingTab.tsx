import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { Palette, Plus, X, Save, Eye, Type, FileDown, Link2, Loader2 } from "lucide-react";
import FontPicker from "./FontPicker";
import { useClientFonts } from "@/hooks/useClientFonts";

interface BrandingTabProps {
  clientId: string;
  clientName?: string;
}

interface ClientData {
  primary_font: string | null;
  secondary_font: string | null;
}

interface ClientBranding {
  id?: string;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  brand_palette: string[] | null;
  brand_voice: string | null;
  brand_tone: string | null;
  brand_guidelines: string | null;
}

export default function BrandingTab({ clientId, clientName = "Client Name" }: BrandingTabProps) {
  const { toast } = useToast();
  const { canEditSettings, isViewer } = useRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState<ClientBranding>({
    primary_color: "#06B6D4",
    secondary_color: "#0891B2",
    accent_color: "#10B981",
    brand_palette: [],
    brand_voice: "",
    brand_tone: "",
    brand_guidelines: "",
  });
  const [clientData, setClientData] = useState<ClientData>({
    primary_font: null,
    secondary_font: null,
  });
  const [newPaletteColor, setNewPaletteColor] = useState("#000000");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Load fonts dynamically
  const { primaryFontFamily, secondaryFontFamily } = useClientFonts({
    primaryFont: clientData.primary_font,
    secondaryFont: clientData.secondary_font,
  });

  useEffect(() => {
    fetchBranding();
    fetchClientData();
  }, [clientId]);

  const fetchClientData = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("primary_font, secondary_font")
      .eq("id", clientId)
      .single();

    if (!error && data) {
      setClientData({
        primary_font: data.primary_font,
        secondary_font: data.secondary_font,
      });
    }
  };

  const fetchBranding = async () => {
    const { data, error } = await supabase
      .from("client_branding")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      // Keep any existing branding state on a fetch error (best-effort load).
    } else if (data) {
      setBranding({
        id: data.id,
        primary_color: data.primary_color || "#06B6D4",
        secondary_color: data.secondary_color || "#0891B2",
        accent_color: data.accent_color || "#10B981",
        brand_palette: data.brand_palette || [],
        brand_voice: data.brand_voice || "",
        brand_tone: data.brand_tone || "",
        brand_guidelines: data.brand_guidelines || "",
      });
    } else {
      // Auto-save SMMAHUB defaults if no branding exists
      const defaultBranding = {
        client_id: clientId,
        primary_color: "#06B6D4",
        secondary_color: "#0891B2",
        accent_color: "#10B981",
        brand_palette: [],
        brand_voice: "",
        brand_tone: "",
        brand_guidelines: "",
      };
      
      const { data: newData } = await supabase
        .from("client_branding")
        .insert(defaultBranding)
        .select()
        .single();
      
      if (newData) {
        setBranding({ ...defaultBranding, id: newData.id });
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    // Save fonts to clients table
    const { error: clientError } = await supabase
      .from("clients")
      .update({
        primary_font: clientData.primary_font,
        secondary_font: clientData.secondary_font,
      })
      .eq("id", clientId);

    if (clientError) {
      toast({
        title: "Error",
        description: "Failed to update fonts",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    const brandingData = {
      client_id: clientId,
      primary_color: branding.primary_color,
      secondary_color: branding.secondary_color,
      accent_color: branding.accent_color,
      brand_palette: branding.brand_palette,
      brand_voice: branding.brand_voice,
      brand_tone: branding.brand_tone,
      brand_guidelines: branding.brand_guidelines,
    };

    if (branding.id) {
      const { error } = await supabase
        .from("client_branding")
        .update(brandingData)
        .eq("id", branding.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update branding",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Branding updated successfully",
        });
      }
    } else {
      const { data, error } = await supabase
        .from("client_branding")
        .insert(brandingData)
        .select()
        .single();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to save branding",
          variant: "destructive",
        });
      } else {
        setBranding({ ...branding, id: data.id });
        toast({
          title: "Success",
          description: "Branding saved successfully",
        });
      }
    }

    setSaving(false);
  };

  const addPaletteColor = () => {
    if (newPaletteColor && !branding.brand_palette?.includes(newPaletteColor)) {
      setBranding({
        ...branding,
        brand_palette: [...(branding.brand_palette || []), newPaletteColor],
      });
      setNewPaletteColor("#000000");
    }
  };

  const removePaletteColor = (color: string) => {
    setBranding({
      ...branding,
      brand_palette: branding.brand_palette?.filter((c) => c !== color) || [],
    });
  };

  const handleGeneratePDF = async () => {
    setGeneratingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-brand-guidelines-pdf', {
        body: { clientId },
      });

      if (error) throw error;

      setPdfUrl(data.url);
      toast({
        title: "Success",
        description: "Brand guidelines PDF generated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!pdfUrl) return;
    
    try {
      // Create a temporary link element for download
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${clientName.replace(/\s+/g, '-')}-brand-guidelines.pdf`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download Started",
        description: "Your PDF is being downloaded",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async () => {
    if (pdfUrl) {
      await navigator.clipboard.writeText(pdfUrl);
      toast({
        title: "Link Copied",
        description: "PDF link copied to clipboard",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading branding...</div>
      </div>
    );
  }

  const canEdit = canEditSettings && !isViewer;
  
  // Preset color suggestions
  const presetColors = [
    "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899",
    "#14B8A6", "#F97316", "#06B6D4", "#6366F1", "#84CC16", "#F43F5E"
  ];

  return (
    <div className="space-y-6">
      {/* Visual Preview Banner */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Brand Preview
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Banner Preview */}
          <div 
            className="relative h-24 flex items-center justify-center overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${branding.primary_color} 0%, ${branding.secondary_color} 100%)`
            }}
          >
            {/* Accent overlay */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                background: `radial-gradient(circle at top right, ${branding.accent_color}, transparent 60%)`
              }}
            />
            
            {/* Content */}
            <div className="relative z-10 text-center px-4">
              <h2 
                className="text-2xl font-bold drop-shadow-lg"
                style={{
                  color: '#FFFFFF',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                {clientName}
              </h2>
            </div>
          </div>
          
          {/* Color Swatches Row */}
          <div className="flex border-t">
            <div 
              className="flex-1 h-16 flex items-center justify-center border-r"
              style={{ backgroundColor: branding.primary_color }}
            >
              <span className="text-xs font-mono text-white drop-shadow-md">Primary</span>
            </div>
            <div 
              className="flex-1 h-16 flex items-center justify-center border-r"
              style={{ backgroundColor: branding.secondary_color }}
            >
              <span className="text-xs font-mono text-white drop-shadow-md">Secondary</span>
            </div>
            <div 
              className="flex-1 h-16 flex items-center justify-center"
              style={{ backgroundColor: branding.accent_color }}
            >
              <span className="text-xs font-mono text-white drop-shadow-md">Accent</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Colors Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Brand Colors
          </CardTitle>
          {canEdit && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save All Changes"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Colors */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
            <div className="space-y-3">
              <Label htmlFor="primary_color">Primary Color</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={branding.primary_color || "#06B6D4"}
                    onChange={(e) =>
                      setBranding({ ...branding, primary_color: e.target.value })
                    }
                    className="h-12 w-24 cursor-pointer"
                    disabled={!canEdit}
                  />
                  <Input
                    type="text"
                    value={branding.primary_color || ""}
                    onChange={(e) =>
                      setBranding({ ...branding, primary_color: e.target.value })
                    }
                    placeholder="#06B6D4"
                    className="flex-1 font-mono"
                    disabled={!canEdit}
                  />
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-1">
                    {presetColors.slice(0, 4).map((color) => (
                      <button
                        key={color}
                        className="h-6 w-6 rounded border-2 border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={() => setBranding({ ...branding, primary_color: color })}
                        type="button"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="secondary_color">Secondary Color</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={branding.secondary_color || "#0891B2"}
                    onChange={(e) =>
                      setBranding({ ...branding, secondary_color: e.target.value })
                    }
                    className="h-12 w-24 cursor-pointer"
                    disabled={!canEdit}
                  />
                  <Input
                    type="text"
                    value={branding.secondary_color || ""}
                    onChange={(e) =>
                      setBranding({ ...branding, secondary_color: e.target.value })
                    }
                    placeholder="#0891B2"
                    className="flex-1 font-mono"
                    disabled={!canEdit}
                  />
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-1">
                    {presetColors.slice(4, 8).map((color) => (
                      <button
                        key={color}
                        className="h-6 w-6 rounded border-2 border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={() => setBranding({ ...branding, secondary_color: color })}
                        type="button"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="accent_color">Accent Color</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="accent_color"
                    type="color"
                    value={branding.accent_color || "#10B981"}
                    onChange={(e) =>
                      setBranding({ ...branding, accent_color: e.target.value })
                    }
                    className="h-12 w-24 cursor-pointer"
                    disabled={!canEdit}
                  />
                  <Input
                    type="text"
                    value={branding.accent_color || ""}
                    onChange={(e) =>
                      setBranding({ ...branding, accent_color: e.target.value })
                    }
                    placeholder="#10B981"
                    className="flex-1 font-mono"
                    disabled={!canEdit}
                  />
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-1">
                    {presetColors.slice(8, 12).map((color) => (
                      <button
                        key={color}
                        className="h-6 w-6 rounded border-2 border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={() => setBranding({ ...branding, accent_color: color })}
                        type="button"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Palette Colors */}
          <div className="space-y-3">
            <Label>Brand Palette (Additional Colors)</Label>
            
            {/* Add New Color */}
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={newPaletteColor}
                  onChange={(e) => setNewPaletteColor(e.target.value)}
                  className="h-10 w-20 cursor-pointer"
                />
                <Input
                  type="text"
                  value={newPaletteColor}
                  onChange={(e) => setNewPaletteColor(e.target.value)}
                  placeholder="#000000"
                  className="flex-1 font-mono"
                />
                <Button onClick={addPaletteColor} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Color
                </Button>
              </div>
            )}

            {/* Display Palette Colors */}
            {branding.brand_palette && branding.brand_palette.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {branding.brand_palette.map((color, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <div
                      className="h-8 w-8 rounded border"
                      style={{ backgroundColor: color }}
                    />
                    <span className="flex-1 text-sm font-mono">{color}</span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePaletteColor(color)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No additional palette colors added yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Brand Voice & Tone Section */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Voice & Tone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand_voice">Brand Voice</Label>
            <Textarea
              id="brand_voice"
              value={branding.brand_voice || ""}
              onChange={(e) =>
                setBranding({ ...branding, brand_voice: e.target.value })
              }
              placeholder="Describe the brand's voice (e.g., friendly, professional, casual, authoritative...)"
              rows={4}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              The personality and character of the brand
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand_tone">Brand Tone</Label>
            <Textarea
              id="brand_tone"
              value={branding.brand_tone || ""}
              onChange={(e) =>
                setBranding({ ...branding, brand_tone: e.target.value })
              }
              placeholder="Describe the brand's tone (e.g., warm, serious, playful, empathetic...)"
              rows={4}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              The emotional inflection applied to the voice
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Brand Typography Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Brand Typography
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Font Preview */}
          <Card className="p-6 bg-muted/50">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Headline Preview (Primary Font)</p>
                <h2 
                  className="text-3xl font-bold"
                  style={{ fontFamily: primaryFontFamily || 'inherit' }}
                >
                  {clientName}
                </h2>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Body Text Preview (Secondary Font)</p>
                <p 
                  className="text-base"
                  style={{ fontFamily: secondaryFontFamily || 'inherit' }}
                >
                  This is how your brand's body text will appear across all content. 
                  Clear typography enhances readability and reinforces brand identity.
                </p>
              </div>
            </div>
          </Card>

          {/* Font Pickers */}
          <div className="grid gap-6 md:grid-cols-2">
            <FontPicker
              clientId={clientId}
              label="Primary Font (Headings)"
              value={clientData.primary_font}
              onChange={(font) => setClientData({ ...clientData, primary_font: font })}
              disabled={!canEdit}
            />
            
            <FontPicker
              clientId={clientId}
              label="Secondary Font (Body Text)"
              value={clientData.secondary_font}
              onChange={(font) => setClientData({ ...clientData, secondary_font: font })}
              disabled={!canEdit}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            💡 Tip: Choose complementary fonts that reflect your brand personality. 
            Primary font is used for headings and titles, secondary for body text and paragraphs.
          </p>
        </CardContent>
      </Card>

      {/* Brand Guidelines Section */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="brand_guidelines">Guidelines & Documentation</Label>
            <Textarea
              id="brand_guidelines"
              value={branding.brand_guidelines || ""}
              onChange={(e) =>
                setBranding({ ...branding, brand_guidelines: e.target.value })
              }
              placeholder="Add comprehensive brand guidelines, usage rules, do's and don'ts, typography preferences, imagery style, etc."
              rows={12}
              className="font-mono text-sm"
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              Detailed documentation for maintaining brand consistency
            </p>
          </div>
        </CardContent>
      </Card>

      {/* PDF Generation Section */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Guidelines PDF</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a comprehensive PDF document containing all your brand guidelines including logo, colors, typography, tone of voice, hashtags, content pillars, and visual assets.
          </p>
          
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={handleGeneratePDF} 
              disabled={generatingPdf}
              size="lg"
            >
              {generatingPdf ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Generate Brand Guidelines PDF
                </>
              )}
            </Button>

            {pdfUrl && (
              <>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={handleDownloadPDF}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={handleCopyLink}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Copy Share Link
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save Button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      )}
      
      {!canEdit && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              You have read-only access to branding settings. Only agency owners and managers can edit brand identity.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
