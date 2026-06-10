import { useNavigate, useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumInlineEmpty, PremiumLoading, PremiumPage, PremiumStatCard } from "@/components/shared/PremiumPage";
import { useClientAnalyticsWithGate } from "@/hooks/useClientAnalytics";
import { useProfileTrendsWithGate } from "@/hooks/useProfileTrends";
import { useTopPostsWithGate } from "@/hooks/useTopPosts";
import { useHasSupabaseSession } from "@/hooks/useHasSupabaseSession";
import { useClientReports } from "@/hooks/useClientReports";
import { Calendar, Eye, Users, Heart, TrendingUp, Instagram, Facebook, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

interface OutletContext {
  client: { id: string; name: string };
  clientId: string;
}

export function PortalPerformance() {
  const { clientId } = useOutletContext<OutletContext>();
  const navigate = useNavigate();
  const { hasSession, loading: sessionLoading } = useHasSupabaseSession();
  const portalQueryEnabled = hasSession && !sessionLoading;
  const { data: analytics, isLoading: analyticsLoading } = useClientAnalyticsWithGate(clientId, portalQueryEnabled);
  const { data: trends, isLoading: trendsLoading } = useProfileTrendsWithGate(clientId, 30, portalQueryEnabled);
  const { data: topPosts, isLoading: topPostsLoading } = useTopPostsWithGate(clientId, 5, portalQueryEnabled);
  const { data: reports = [], isLoading: reportsLoading } = useClientReports(clientId, portalQueryEnabled);

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

  const hasPerformanceData = !!analytics && !(analytics.postsThisMonth === 0 && analytics.totalFollowers === 0);

  if ((analyticsLoading || reportsLoading) && !analytics && reports.length === 0) {
    return <PremiumLoading rows={2} />;
  }

  return (
    <PremiumPage
      eyebrow="Performance"
      title="Campaign Performance"
      description="A client-ready view of reach, engagement, followers, and top content."
    >
      {hasPerformanceData && analytics ? (
        <div className="grid gap-4 md:grid-cols-3">
          <PremiumStatCard icon={Eye} label="Total Reach" value={analytics.totalReach.toLocaleString()} detail={`${analytics.postsThisMonth} posts`} />
          <PremiumStatCard icon={Heart} label="Engagement Rate" value={`${analytics.avgEngagementRate}%`} detail={`${analytics.totalEngagement.toLocaleString()} total`} tone="warning" />
          <PremiumStatCard
            icon={Users}
            label="Followers"
            value={analytics.totalFollowers.toLocaleString()}
            tone="success"
            detail={
              <span className={analytics.followerGrowth > 0 ? "text-success" : "text-destructive"}>
                {analytics.followerGrowth > 0 ? "+" : "-"}
                {Math.abs(analytics.followerGrowth)}%
              </span>
            }
          />
        </div>
      ) : (
        <PremiumInlineEmpty
          icon={Eye}
          title="No performance data yet"
          description="Performance metrics will appear here once content has been published."
        />
      )}

      {/* Followers Trend Chart */}
      {hasPerformanceData && trends && trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Growth Trends (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
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
                  <Line
                    type="monotone"
                    dataKey="followers"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Followers"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top Posts */}
      {hasPerformanceData ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Top Performing Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPostsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : topPosts && topPosts.length > 0 ? (
              <div className="space-y-3">
                {topPosts.map((post, index) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-sm font-bold text-success">
                      #{index + 1}
                    </div>
                    {post.project?.thumbnail_url && (
                      <img
                        src={post.project.thumbnail_url}
                        alt={post.project.title}
                        className="h-10 w-10 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{post.project?.title || "Untitled"}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="capitalize">
                          {getPlatformIcon(post.platform)}
                          <span className="ml-1">{post.platform}</span>
                        </Badge>
                        <span className="font-semibold text-success">{post.engagementRate}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PremiumInlineEmpty icon={TrendingUp} title="No posts with analytics yet" description="Top content appears here after metrics sync." className="py-8" />
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Monthly Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : reports.length > 0 ? (
            <div className="space-y-3">
              {reports.slice(0, 6).map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">
                      {format(new Date(`${report.month}-01T00:00:00`), "MMMM yyyy")} Report
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(report.created_at), "MMM d, yyyy")}
                      </span>
                      <span>{report.data.kpis.postsCount} posts</span>
                      <span>{report.data.kpis.totalReach.toLocaleString()} reach</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`../reports/${report.id}`)}>
                    View Report
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <PremiumInlineEmpty
              icon={FileText}
              title="No monthly reports yet"
              description="Published reports from your agency will appear here."
              className="py-8"
            />
          )}
        </CardContent>
      </Card>
    </PremiumPage>
  );
}
