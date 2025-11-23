import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { Palette, Plus, X, Save } from "lucide-react";

interface BrandingTabProps {
  clientId: string;
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

export default function BrandingTab({ clientId }: BrandingTabProps) {
  const { toast } = useToast();
  const { canEditSettings, isViewer } = useRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState<ClientBranding>({
    primary_color: "#000000",
    secondary_color: "#000000",
    accent_color: "#000000",
    brand_palette: [],
    brand_voice: "",
    brand_tone: "",
    brand_guidelines: "",
  });
  const [newPaletteColor, setNewPaletteColor] = useState("#000000");

  useEffect(() => {
    fetchBranding();
  }, [clientId]);

  const fetchBranding = async () => {
    const { data, error } = await supabase
      .from("client_branding")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching branding:", error);
    } else if (data) {
      setBranding({
        id: data.id,
        primary_color: data.primary_color || "#000000",
        secondary_color: data.secondary_color || "#000000",
        accent_color: data.accent_color || "#000000",
        brand_palette: data.brand_palette || [],
        brand_voice: data.brand_voice || "",
        brand_tone: data.brand_tone || "",
        brand_guidelines: data.brand_guidelines || "",
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading branding...</div>
      </div>
    );
  }

  const canEdit = canEditSettings && !isViewer;

  return (
    <div className="space-y-6">
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
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={branding.primary_color || "#000000"}
                  onChange={(e) =>
                    setBranding({ ...branding, primary_color: e.target.value })
                  }
                  className="h-10 w-20 cursor-pointer"
                  disabled={!canEdit}
                />
                <Input
                  type="text"
                  value={branding.primary_color || ""}
                  onChange={(e) =>
                    setBranding({ ...branding, primary_color: e.target.value })
                  }
                  placeholder="#000000"
                  className="flex-1 font-mono"
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_color">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary_color"
                  type="color"
                  value={branding.secondary_color || "#000000"}
                  onChange={(e) =>
                    setBranding({ ...branding, secondary_color: e.target.value })
                  }
                  className="h-10 w-20 cursor-pointer"
                  disabled={!canEdit}
                />
                <Input
                  type="text"
                  value={branding.secondary_color || ""}
                  onChange={(e) =>
                    setBranding({ ...branding, secondary_color: e.target.value })
                  }
                  placeholder="#000000"
                  className="flex-1 font-mono"
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent_color">Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="accent_color"
                  type="color"
                  value={branding.accent_color || "#000000"}
                  onChange={(e) =>
                    setBranding({ ...branding, accent_color: e.target.value })
                  }
                  className="h-10 w-20 cursor-pointer"
                  disabled={!canEdit}
                />
                <Input
                  type="text"
                  value={branding.accent_color || ""}
                  onChange={(e) =>
                    setBranding({ ...branding, accent_color: e.target.value })
                  }
                  placeholder="#000000"
                  className="flex-1 font-mono"
                  disabled={!canEdit}
                />
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
        <Card className="border-yellow-500/50 bg-yellow-500/10">
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
