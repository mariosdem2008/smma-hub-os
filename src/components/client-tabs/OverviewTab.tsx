import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// REMOVE useAuth import - it's causing re-renders
// import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import {
  Palette,
  Globe,
  MessageSquare,
  CalendarDays,
  CheckCircle2,
  Clock,
  Plus,
  Edit,
  FileText,
  Mail,
  Phone,
  Building,
  TrendingUp,
  TrendingDown,
  Eye,
  Users,
  Heart,
} from "lucide-react";
import { useClientAnalytics } from "@/hooks/useClientAnalytics";
import { useTopPosts } from "@/hooks/useTopPosts";
import { useWorstPosts } from "@/hooks/useWorstPosts";

interface OverviewTabProps {
  clientId: string;
  client: {
    name: string;
    logo_url: string | null;
    website: string | null;
    niche: string | null;
    tone_of_voice: string | null;
    brand_colors: string[] | null;
    notes: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    status: string | null;
  };
  onNotesUpdate: (notes: string) => void;
}

interface Stats {
  totalScheduled: number;
  totalPublished: number;
  upcomingPosts: number;
}

export default function OverviewTab({ clientId, client, onNotesUpdate }: OverviewTabProps) {
  const { toast } = useToast();
  // REMOVE useAuth call - it causes re-renders
  // const { user } = useAuth();
  const { isOwner, isAdmin, canCreateContent } = useRole();
  const [stats, setStats] = useState<Stats>({
    totalScheduled: 0,
    totalPublished: 0,
    upcomingPosts: 0,
  });
  const [isEditNotesOpen, setIsEditNotesOpen] = useState(false);
  const [notes, setNotes] = useState(client.notes || "");
  const [saving, setSaving] = useState(false);
  const [brandColors, setBrandColors] = useState<string[]>([]);

  // Fetch real analytics
  const { data: analytics, isLoading: analyticsLoading } = useClientAnalytics(clientId);
  const { data: topPosts, isLoading: topPostsLoading } = useTopPosts(clientId, 3);
  const { data: worstPosts, isLoading: worstPostsLoading } = useWorstPosts(clientId, 3);

  useEffect(() => {
    fetchStats();
    fetchBrandColors();
  }, [clientId]); // Only run when clientId changes, not on every render

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
    // Fetch scheduled content
    const { count: scheduledCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "scheduled");

    // Fetch published content
    const { count: publishedCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "published");

    // Fetch upcoming content (scheduled in next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { count: upcomingCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "scheduled")
      .gte("scheduled_time", new Date().toISOString())
      .lte("scheduled_time", sevenDaysFromNow.toISOString());

    setStats({
      totalScheduled: scheduledCount || 0,
      totalPublished: publishedCount || 0,
      upcomingPosts: upcomingCount || 0,
    });
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    const { error } = await supabase.from("clients").update({ notes }).eq("id", clientId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Notes saved successfully",
      });
      onNotesUpdate(notes);
      setIsEditNotesOpen(false);
    }
    setSaving(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-status-active";
      case "inactive":
        return "bg-status-inactive";
      case "paused":
        return "bg-status-paused";
      default:
        return "bg-muted";
    }
  };

  const canUploadLogo = isOwner || isAdmin || canCreateContent;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Client Details Card - Only for Owners and Admins */}
        {(isOwner || isAdmin) && (
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.company && (
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Company</p>
                    <p className="text-sm text-muted-foreground">{client.company}</p>
                  </div>
                </div>
              )}

              {client.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{client.email}</p>
                  </div>
                </div>
              )}

              {client.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">{client.phone}</p>
                  </div>
                </div>
              )}

              {client.status && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Status</p>
                    <Badge className={getStatusColor(client.status)}>{client.status}</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Brand Information Card */}
        <Card>
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

            {brandColors && brandColors.length > 0 && (
              <div className="flex items-start gap-3">
                <Palette className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Brand Colors</p>
                  <div className="flex flex-wrap gap-2">
                    {brandColors.map((color, index) => (
                      <div key={index} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                        <div className="h-4 w-4 rounded" style={{ backgroundColor: color }} />
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Notes</CardTitle>
            <Dialog open={isEditNotesOpen} onOpenChange={setIsEditNotesOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Notes
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Client Notes</DialogTitle>
                  <DialogDescription>Add or update notes about this client</DialogDescription>
                </DialogHeader>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this client..."
                  rows={12}
                  className="resize-none"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditNotesOpen(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveNotes} disabled={saving}>
                    {saving ? "Saving..." : "Save Notes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {client.notes ? (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No notes added yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        {/* Analytics Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle>Analytics (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analyticsLoading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : analytics ? (
              <>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-accent-purple/10 p-2">
                      <Eye className="h-5 w-5 text-accent-purple" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Impressions</p>
                      <p className="text-2xl font-bold">{analytics.totalImpressions.toLocaleString()}</p>
                      <div className="flex items-center gap-1 text-xs">
                        {analytics.impressionsGrowth > 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className={analytics.impressionsGrowth > 0 ? "text-green-500" : "text-red-500"}>
                          {Math.abs(analytics.impressionsGrowth)}% vs prev 30d
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-accent-teal/10 p-2">
                      <Users className="h-5 w-5 text-accent-teal" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Reach</p>
                      <p className="text-2xl font-bold">{analytics.totalReach.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{analytics.postsThisMonth} posts</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-accent-pink/10 p-2">
                      <Heart className="h-5 w-5 text-accent-pink" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Engagement Rate</p>
                      <p className="text-2xl font-bold">{analytics.avgEngagementRate}%</p>
                      <p className="text-xs text-muted-foreground">
                        {analytics.totalEngagement.toLocaleString()} interactions
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-green-500/10 p-2">
                      <Users className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Followers</p>
                      <p className="text-2xl font-bold">{analytics.totalFollowers.toLocaleString()}</p>
                      <div className="flex items-center gap-1 text-xs">
                        {analytics.followerGrowth > 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className={analytics.followerGrowth > 0 ? "text-green-500" : "text-red-500"}>
                          {Math.abs(analytics.followerGrowth)}% vs prev 30d
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No analytics data available yet. Connect social profiles and publish content to see insights.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Posts Card */}
        {topPosts && topPosts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Posts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topPostsLoading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : (
                topPosts.map((post) => (
                  <div key={post.id} className="flex items-center gap-3 rounded-lg border p-3">
                    {post.project?.thumbnail_url && (
                      <img
                        src={post.project.thumbnail_url}
                        alt={post.project.title}
                        className="h-12 w-12 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-1">{post.project?.title || "Untitled"}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="capitalize">
                          {post.platform}
                        </Badge>
                        <span>{post.engagementRate}% engagement</span>
                        <span>•</span>
                        <span>{post.reach.toLocaleString()} reach</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Content Stats Card */}
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
