import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Eye, Type } from "lucide-react";

interface ClientBranding {
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  brand_palette: string[] | null;
  brand_voice: string | null;
  brand_tone: string | null;
  brand_guidelines: string | null;
}

interface OutletContext {
  clientId: string;
  client: {
    name: string;
    primary_font: string | null;
    secondary_font: string | null;
  };
}

export function PortalBranding() {
  const { clientId, client } = useOutletContext<OutletContext>();
  const [branding, setBranding] = useState<ClientBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBranding();
  }, [clientId]);

  const fetchBranding = async () => {
    const { data } = await supabase
      .from("client_branding")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    setBranding(data);
    setLoading(false);
  };

  if (loading) {
    return <div>Loading branding...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Brand Identity</h1>
        <p className="text-muted-foreground">
          Your complete brand guidelines and visual identity
        </p>
      </div>

      {/* Visual Preview Banner */}
      {branding && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Brand Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Banner Preview */}
            <div 
              className="relative h-24 flex items-center justify-center overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${branding.primary_color || '#06B6D4'} 0%, ${branding.secondary_color || '#0891B2'} 100%)`
              }}
            >
              {/* Accent overlay */}
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  background: `radial-gradient(circle at top right, ${branding.accent_color || '#10B981'}, transparent 60%)`
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
                  {client.name}
                </h2>
              </div>
            </div>
            
            {/* Color Swatches Row */}
            <div className="flex border-t">
              <div 
                className="flex-1 h-16 flex items-center justify-center border-r"
                style={{ backgroundColor: branding.primary_color || '#06B6D4' }}
              >
                <span className="text-xs font-mono text-white drop-shadow-md">Primary</span>
              </div>
              <div 
                className="flex-1 h-16 flex items-center justify-center border-r"
                style={{ backgroundColor: branding.secondary_color || '#0891B2' }}
              >
                <span className="text-xs font-mono text-white drop-shadow-md">Secondary</span>
              </div>
              <div 
                className="flex-1 h-16 flex items-center justify-center"
                style={{ backgroundColor: branding.accent_color || '#10B981' }}
              >
                <span className="text-xs font-mono text-white drop-shadow-md">Accent</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Typography Section */}
      {(client.primary_font || client.secondary_font) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Typography
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.primary_font && (
              <div>
                <Badge variant="outline" className="mb-2">Primary Font</Badge>
                <p className="text-2xl" style={{ fontFamily: client.primary_font }}>
                  {client.primary_font}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            )}
            {client.secondary_font && (
              <div>
                <Badge variant="outline" className="mb-2">Secondary Font</Badge>
                <p className="text-2xl" style={{ fontFamily: client.secondary_font }}>
                  {client.secondary_font}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Brand Colors */}
      {branding && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Brand Colors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Colors */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {branding.primary_color && (
                <div className="space-y-2">
                  <Badge variant="outline">Primary Color</Badge>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-16 h-16 rounded-lg border shadow-sm"
                      style={{ backgroundColor: branding.primary_color }}
                    />
                    <span className="font-mono text-sm">{branding.primary_color}</span>
                  </div>
                </div>
              )}
              {branding.secondary_color && (
                <div className="space-y-2">
                  <Badge variant="outline">Secondary Color</Badge>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-16 h-16 rounded-lg border shadow-sm"
                      style={{ backgroundColor: branding.secondary_color }}
                    />
                    <span className="font-mono text-sm">{branding.secondary_color}</span>
                  </div>
                </div>
              )}
              {branding.accent_color && (
                <div className="space-y-2">
                  <Badge variant="outline">Accent Color</Badge>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-16 h-16 rounded-lg border shadow-sm"
                      style={{ backgroundColor: branding.accent_color }}
                    />
                    <span className="font-mono text-sm">{branding.accent_color}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Additional Palette */}
            {branding.brand_palette && branding.brand_palette.length > 0 && (
              <div className="space-y-3">
                <Badge variant="outline">Additional Palette Colors</Badge>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  {branding.brand_palette.map((color, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-12 h-12 rounded-lg border shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        {color}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Brand Voice & Tone */}
      {branding && (branding.brand_voice || branding.brand_tone) && (
        <Card>
          <CardHeader>
            <CardTitle>Brand Voice & Tone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {branding.brand_voice && (
              <div>
                <Badge variant="outline" className="mb-2">Brand Voice</Badge>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {branding.brand_voice}
                </p>
              </div>
            )}
            {branding.brand_tone && (
              <div>
                <Badge variant="outline" className="mb-2">Brand Tone</Badge>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {branding.brand_tone}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Brand Guidelines */}
      {branding?.brand_guidelines && (
        <Card>
          <CardHeader>
            <CardTitle>Brand Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: branding.brand_guidelines }}
            />
          </CardContent>
        </Card>
      )}

      {!branding && (
        <Card className="p-8 text-center">
          <Palette className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Branding Set Up</h3>
          <p className="text-muted-foreground">
            Your agency hasn't configured brand guidelines yet.
          </p>
        </Card>
      )}
    </div>
  );
}
