import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
}

export function PortalBranding() {
  const { clientId } = useOutletContext<OutletContext>();
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

      {/* Brand Colors */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Brand Colors</h2>
        <div className="space-y-4">
          {branding?.primary_color && (
            <div>
              <Badge variant="outline" className="mb-2">Primary Color</Badge>
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded-lg border shadow-sm"
                  style={{ backgroundColor: branding.primary_color }}
                />
                <span className="font-mono text-sm">{branding.primary_color}</span>
              </div>
            </div>
          )}

          {branding?.secondary_color && (
            <div>
              <Badge variant="outline" className="mb-2">Secondary Color</Badge>
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded-lg border shadow-sm"
                  style={{ backgroundColor: branding.secondary_color }}
                />
                <span className="font-mono text-sm">{branding.secondary_color}</span>
              </div>
            </div>
          )}

          {branding?.accent_color && (
            <div>
              <Badge variant="outline" className="mb-2">Accent Color</Badge>
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded-lg border shadow-sm"
                  style={{ backgroundColor: branding.accent_color }}
                />
                <span className="font-mono text-sm">{branding.accent_color}</span>
              </div>
            </div>
          )}

          {branding?.brand_palette && branding.brand_palette.length > 0 && (
            <div>
              <Badge variant="outline" className="mb-2">Color Palette</Badge>
              <div className="flex flex-wrap gap-3">
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
        </div>
      </Card>

      {/* Brand Voice & Tone */}
      {(branding?.brand_voice || branding?.brand_tone) && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Brand Voice & Tone</h2>
          <div className="space-y-4">
            {branding?.brand_voice && (
              <div>
                <h3 className="font-medium mb-2">Brand Voice</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {branding.brand_voice}
                </p>
              </div>
            )}
            {branding?.brand_tone && (
              <div>
                <h3 className="font-medium mb-2">Brand Tone</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {branding.brand_tone}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Brand Guidelines */}
      {branding?.brand_guidelines && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Brand Guidelines</h2>
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: branding.brand_guidelines }}
          />
        </Card>
      )}

      {!branding && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No branding information has been set up yet.
          </p>
        </Card>
      )}
    </div>
  );
}
