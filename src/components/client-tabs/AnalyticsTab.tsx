import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientAnalytics } from "@/hooks/useClientAnalytics";
import { useTopPosts } from "@/hooks/useTopPosts";
import { useWorstPosts } from "@/hooks/useWorstPosts";
import { useProfileTrends } from "@/hooks/useProfileTrends";
import { useSyncSocialMetrics } from "@/hooks/useSyncSocialMetrics";
import { useToast } from "@/hooks/use-toast";
import { Eye, Users, Heart, TrendingUp, TrendingDown, Instagram, Facebook, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";

interface AnalyticsTabProps {
  clientId: string;
}

export default function AnalyticsTab({ clientId }: AnalyticsTabProps) {
  const { toast } = useToast();
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useClientAnalytics(clientId);
  const { data: topPosts, isLoading: topPostsLoading } = useTopPosts(clientId, 5);
  const { data: worstPosts, isLoading: worstPostsLoading } = useWorstPosts(clientId, 5);
  const { data: trends, isLoading: trendsLoading } = useProfileTrends(clientId, 30);
  const syncMutation = useSyncSocialMetrics();

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.permissionError) {
          toast({
            title: "Permission Error",
            description: data.permissionError,
            variant: "destructive",
          });
        } else if (data.success) {
          toast({
            title: "Sync Complete",
            description: `Synced ${data.posts_synced || 0} posts and ${data.profiles_synced || 0} profiles.`,
          });
        } else {
          toast({
            title: "Sync Failed",
            description: data.error || "Failed to sync metrics",
            variant: "destructive",
          });
        }
      },
      onError: (error: any) => {
        toast({
          title: "Sync Error",
          description: error.message || "Failed to sync metrics",
          variant: "destructive",
        });
      },
    });
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "instagram":
        return <Instagram className="h-4 w-4" />;
      case "facebook":
        return <Facebook className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (analyticsLoading && !analytics) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!analytics || (analytics.postsThisMonth === 0 && analytics.totalFollowers === 0)) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <div className="w-16 h-16 bg-gradient-to-br from-primary/5 to-accent-purple/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/10">
            <Eye className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground font-medium mb-2">No Analytics Data Yet</p>
          <p className="text-sm text-muted-foreground mb-6">
            Connect social profiles and publish content to see insights. Metrics sync runs every 6 hours.
          </p>
          <Button onClick={handleSync} disabled={syncMutation.isPending} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Syncing..." : "Sync Now"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Sync Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Performance Analytics</h2>
          <p className="text-sm text-muted-foreground">Last 30 days</p>
        </div>
        <Button onClick={handleSync} disabled={syncMutation.isPending} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing..." : "Sync Metrics"}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Total Impressions</p>
                <p className="text-2xl font-bold">{analytics.totalImpressions.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs">
                  {analytics.impressionsGrowth > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={analytics.impressionsGrowth > 0 ? "text-green-500" : "text-red-500"}>
                    {Math.abs(analytics.impressionsGrowth)}%
                  </span>
                </div>
              </div>
              <div className="rounded-lg p-2 bg-gradient-to-br from-accent-purple to-accent-purple/80 shadow-lg">
                <Eye className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Total Reach</p>
                <p className="text-2xl font-bold">{analytics.totalReach.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{analytics.postsThisMonth} posts</p>
              </div>
              <div className="rounded-lg p-2 bg-gradient-to-br from-accent-teal to-accent-teal/80 shadow-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Engagement Rate</p>
                <p className="text-2xl font-bold">{analytics.avgEngagementRate}%</p>
                <p className="text-xs text-muted-foreground">{analytics.totalEngagement.toLocaleString()} total</p>
              </div>
              <div className="rounded-lg p-2 bg-gradient-to-br from-accent-pink to-accent-pink/80 shadow-lg">
                <Heart className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Followers</p>
                <p className="text-2xl font-bold">{analytics.totalFollowers.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs">
                  {analytics.followerGrowth > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={analytics.followerGrowth > 0 ? "text-green-500" : "text-red-500"}>
                    {Math.abs(analytics.followerGrowth)}%
                  </span>
                </div>
              </div>
              <div className="rounded-lg p-2 bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trends Chart */}
      {trends && trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Profile Growth Trends (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), "MMM d")}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")}
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="followers"
                    stroke="hsl(142, 70%, 55%)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Followers"
                  />
                  <Line
                    type="monotone"
                    dataKey="impressions"
                    stroke="hsl(270, 75%, 65%)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Impressions"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top & Worst Posts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Performing Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Top Performing Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPostsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : topPosts && topPosts.length > 0 ? (
              <div className="space-y-3">
                {topPosts.map((post, index) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 text-sm font-bold text-green-500">
                      #{index + 1}
                    </div>
                    {post.project?.thumbnail_url && (
                      <img
                        src={post.project.thumbnail_url}
                        alt={post.project.title}
                        className="h-12 w-12 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{post.project?.title || "Untitled"}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="outline" className="capitalize">
                          {getPlatformIcon(post.platform)}
                          <span className="ml-1">{post.platform}</span>
                        </Badge>
                        <span className="font-semibold text-green-500">{post.engagementRate}%</span>
                        <span>•</span>
                        <span>{post.reach.toLocaleString()} reach</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No posts with analytics yet</p>
            )}
          </CardContent>
        </Card>

        {/* Worst Performing Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Needs Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {worstPostsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : worstPosts && worstPosts.length > 0 ? (
              <div className="space-y-3">
                {worstPosts.map((post, index) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-sm font-bold text-red-500">
                      #{index + 1}
                    </div>
                    {post.project?.thumbnail_url && (
                      <img
                        src={post.project.thumbnail_url}
                        alt={post.project.title}
                        className="h-12 w-12 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{post.project?.title || "Untitled"}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="outline" className="capitalize">
                          {getPlatformIcon(post.platform)}
                          <span className="ml-1">{post.platform}</span>
                        </Badge>
                        <span className="font-semibold text-red-500">{post.engagementRate}%</span>
                        <span>•</span>
                        <span>{post.reach.toLocaleString()} reach</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No posts with analytics yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
