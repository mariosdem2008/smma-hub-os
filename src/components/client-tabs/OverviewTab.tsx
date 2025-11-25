import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
  Palette, 
  Globe, 
  MessageSquare, 
  CalendarDays,
  CheckCircle2,
  Clock
} from "lucide-react";

interface OverviewTabProps {
  clientId: string;
  client: {
    name: string;
    logo_url: string | null;
    website: string | null;
    tone_of_voice: string | null;
  };
  onNotesUpdate: (notes: string) => void;
}

interface Stats {
  totalScheduled: number;
  totalPublished: number;
  upcomingPosts: number;
}

export default function OverviewTab({ clientId, client }: OverviewTabProps) {
  const [stats, setStats] = useState<Stats>({
    totalScheduled: 0,
    totalPublished: 0,
    upcomingPosts: 0,
  });
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const [socialProfiles, setSocialProfiles] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchBrandColors();
    fetchSocialProfiles();
  }, [clientId]);
  
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

  const fetchSocialProfiles = async () => {
    const { data } = await supabase
      .from("social_profiles")
      .select("*")
      .eq("client_id", clientId);
    
    setSocialProfiles(data || []);
  };

  const fetchStats = async () => {
    // Fetch scheduled content
    const { count: scheduledCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("pipeline_stage", "scheduled");

    // Fetch published content
    const { count: publishedCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("pipeline_stage", "published");

    // Fetch upcoming content (scheduled in next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { count: upcomingCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("pipeline_stage", "scheduled")
      .gte("scheduled_time", new Date().toISOString())
      .lte("scheduled_time", sevenDaysFromNow.toISOString());

    setStats({
      totalScheduled: scheduledCount || 0,
      totalPublished: publishedCount || 0,
      upcomingPosts: upcomingCount || 0,
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Brand Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.logo_url && (
              <div className="flex justify-center pb-4">
                <img 
                  src={client.logo_url} 
                  alt={client.name} 
                  className="h-24 w-24 object-contain rounded-lg"
                />
              </div>
            )}

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

            {client.tone_of_voice && (
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Tone of Voice</p>
                  <p className="text-sm text-muted-foreground">{client.tone_of_voice}</p>
                </div>
              </div>
            )}

            {brandColors && brandColors.length > 0 && (
              <div className="flex items-start gap-3">
                <Palette className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Brand Colors</p>
                  <div className="flex flex-wrap gap-2">
                    {brandColors.map((color, index) => (
                      <div key={index} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
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

        {/* Social Profiles Card */}
        {socialProfiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Social Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {socialProfiles.map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between py-2">
                    <span className="font-medium">{profile.platform}</span>
                    <a 
                      href={profile.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      View Profile
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        {/* Key Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>Content Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Scheduled</p>
                  <p className="text-2xl font-bold">{stats.totalScheduled}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-500/10 p-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Published</p>
                  <p className="text-2xl font-bold">{stats.totalPublished}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-orange-500/10 p-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming (7 days)</p>
                  <p className="text-2xl font-bold">{stats.upcomingPosts}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
