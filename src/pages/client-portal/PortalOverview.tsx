import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useHasSupabaseSession } from "@/hooks/useHasSupabaseSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PremiumPage, PremiumStatCard } from "@/components/shared/PremiumPage";
import { 
  Palette, 
  Globe, 
  MessageSquare, 
  CalendarDays,
  CheckCircle2,
  Lightbulb,
  FileText,
  FolderOpen
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  primary_font: string | null;
  secondary_font: string | null;
  brand_colors: any;
  website: string | null;
  notes: string | null;
  niche: string | null;
  tone_of_voice: string | null;
}

interface OutletContext {
  client: Client;
  clientId: string;
}

interface Stats {
  totalPosts: number;
  totalIdeas: number;
  totalAssets: number;
}

export function PortalOverview() {
  const { client, clientId } = useOutletContext<OutletContext>();
  const { hasSession, loading: sessionLoading } = useHasSupabaseSession();
  const [stats, setStats] = useState<Stats>({
    totalPosts: 0,
    totalIdeas: 0,
    totalAssets: 0,
  });
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const brandColorsFallback = Array.isArray(client.brand_colors) ? client.brand_colors : [];

  useEffect(() => {
    if (sessionLoading) return;
    if (!hasSession) return;
    fetchStats();
    fetchBrandColors();
  }, [clientId, hasSession, sessionLoading]);

  const fetchBrandColors = async () => {
    const { data } = await supabase
      .from("client_branding")
      .select("primary_color, secondary_color, accent_color, brand_palette")
      .eq("client_id", clientId)
      .maybeSingle();
    
    if (data) {
      const colors = [];
      if (data.primary_color) colors.push(data.primary_color);
      if (data.secondary_color) colors.push(data.secondary_color);
      if (data.accent_color) colors.push(data.accent_color);
      if (data.brand_palette) colors.push(...data.brand_palette);
      setBrandColors(colors);
    }
  };

  const fetchStats = async () => {
    // Fetch scheduled assets count (scheduled + published)
    const { count: scheduledCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .in("pipeline_stage", ["scheduled", "published"]);

    // Fetch total ideas
    const { count: ideasCount } = await supabase
      .from("ideas")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);

    // Fetch total assets
    const { count: assetsCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);

    setStats({
      totalPosts: scheduledCount || 0,
      totalIdeas: ideasCount || 0,
      totalAssets: assetsCount || 0,
    });
  };

  const displayColors = brandColors.length > 0 ? brandColors : brandColorsFallback;

  return (
    <PremiumPage
      eyebrow="Portal Home"
      title={`Welcome, ${client.name}`}
      description="Your shared workspace for approvals, assets, campaign performance, and brand information."
    >
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Brand Information Card */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Brand Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.website && (
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Website</p>
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {client.website}
                  </a>
                </div>
              </div>
            )}

            {client.niche && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Niche</p>
                  <p className="text-sm text-muted-foreground">{client.niche}</p>
                </div>
              </div>
            )}

            {client.tone_of_voice && (
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Tone of Voice</p>
                  <p className="text-sm text-muted-foreground">{client.tone_of_voice}</p>
                </div>
              </div>
            )}

            {client.primary_font && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Primary Font</p>
                  <p 
                    className="text-lg" 
                    style={{ fontFamily: client.primary_font }}
                  >
                    {client.primary_font}
                  </p>
                </div>
              </div>
            )}

            {client.secondary_font && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Secondary Font</p>
                  <p 
                    className="text-lg" 
                    style={{ fontFamily: client.secondary_font }}
                  >
                    {client.secondary_font}
                  </p>
                </div>
              </div>
            )}

            {displayColors && displayColors.length > 0 && (
              <div className="flex items-start gap-3">
                <Palette className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Brand Colors</p>
                  <div className="flex flex-wrap gap-2">
                    {displayColors.map((color, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-md border border-border/80 bg-muted/30 px-3 py-1.5">
                        <div
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-mono">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Card */}
        {client.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {client.notes}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">Your Content</h2>
          <div className="grid gap-3">
            <PremiumStatCard icon={CalendarDays} label="Scheduled Posts" value={stats.totalPosts} />
            <PremiumStatCard icon={Lightbulb} label="Total Ideas" value={stats.totalIdeas} tone="warning" />
            <PremiumStatCard icon={FolderOpen} label="Total Assets" value={stats.totalAssets} tone="accent" />
          </div>
        </section>

        {/* Quick Actions Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Portal Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Share Ideas</p>
                <p className="text-xs text-muted-foreground">
                  Submit content ideas for your campaigns
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <FolderOpen className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Upload & Download</p>
                <p className="text-xs text-muted-foreground">
                  Manage all your brand assets
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Track Progress</p>
                <p className="text-xs text-muted-foreground">
                  Monitor your content status
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </PremiumPage>
  );
}
