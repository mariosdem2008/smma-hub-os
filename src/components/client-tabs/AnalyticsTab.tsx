import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientAnalytics } from "@/hooks/useClientAnalytics";
import { useTopPosts } from "@/hooks/useTopPosts";
import { useWorstPosts } from "@/hooks/useWorstPosts";
import { useProfileTrends } from "@/hooks/useProfileTrends";
import { useSyncSocialMetrics } from "@/hooks/useSyncSocialMetrics";
import { useAiAssistant, AiAssistantError } from "@/hooks/useAiAssistant";
import { useToast } from "@/hooks/use-toast";
import { AiWorkflowBlockNotice } from "@/components/ai/AiWorkflowBlockNotice";
import { buildAssistantBlockStateFromError, type AiWorkflowBlockState } from "@/lib/aiWorkflowBlock";
import { PremiumInlineEmpty, PremiumLoading, PremiumPage, PremiumStatCard } from "@/components/shared/PremiumPage";
import { Eye, Users, Heart, TrendingUp, TrendingDown, Instagram, Facebook, RefreshCw, Wand2, Copy } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AnalyticsTabProps {
  clientId: string;
}

export default function AnalyticsTab({ clientId }: AnalyticsTabProps) {
  const { toast } = useToast();
  const aiAssistant = useAiAssistant();
  const [aiOutput, setAiOutput] = useState<{ body: string; updatedAt: string } | null>(null);
  const [aiBlock, setAiBlock] = useState<AiWorkflowBlockState | null>(null);
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

  const handleAiAnomalySummary = async () => {
    try {
      const response = await aiAssistant.mutateAsync({
        action: "send",
        clientId,
        strategyId: null,
        activeTab: "analytics",
        message:
          "Summarize anomalies and opportunities from recent performance data and propose the top 3 next actions.",
      });
      const assistantMessage =
        "assistant_message" in response ? String(response.assistant_message ?? "") : "";
      setAiBlock(null);
      setAiOutput({
        body: assistantMessage || "No anomaly summary text returned from AI assistant.",
        updatedAt: new Date().toLocaleTimeString(),
      });
      toast({
        title: "AI anomaly summary ready",
        description: assistantMessage.slice(0, 180) || "Anomaly summary generated.",
      });
    } catch (error) {
      if (error instanceof AiAssistantError && error.code === "AI_SETUP_REQUIRED") {
        setAiBlock(buildAssistantBlockStateFromError(error, true));
        toast({
          title: "AI setup required",
          description: "Complete AI Setup to use analytics AI quick actions.",
          variant: "destructive",
        });
        return;
      }
      if (error instanceof AiAssistantError && error.code === "AGENT_ACTIVATION_REQUIRED") {
        setAiBlock(buildAssistantBlockStateFromError(error, true));
        toast({
          title: "Analyst activation required",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to generate anomaly summary";
      toast({
        title: "AI action failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleCopyAiOutput = async () => {
    if (!aiOutput?.body) return;
    try {
      await navigator.clipboard.writeText(aiOutput.body);
      toast({ title: "Copied", description: "Analytics AI output copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard is unavailable in this context.", variant: "destructive" });
    }
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
    return <PremiumLoading rows={3} />;
  }

  if (!analytics || (analytics.postsThisMonth === 0 && analytics.totalFollowers === 0)) {
    return (
      <Card className="py-10">
        <CardContent className="space-y-5">
          <PremiumInlineEmpty
            icon={Eye}
            title="No analytics data yet"
            description="Connect social profiles and publish content to see insights. Metrics sync runs every 6 hours."
          />
          <div className="flex items-center justify-center gap-2">
            <Button onClick={handleAiAnomalySummary} disabled={aiAssistant.isPending} variant="outline">
              <Wand2 className={`h-4 w-4 mr-2 ${aiAssistant.isPending ? "animate-pulse" : ""}`} />
              {aiAssistant.isPending ? "Analyzing..." : "AI Anomaly Summary"}
            </Button>
            <Button onClick={handleSync} disabled={syncMutation.isPending} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
          {aiBlock ? (
            <div className="mt-4">
              <AiWorkflowBlockNotice block={aiBlock} fallbackLink="/agency/ai-setup/activation" />
            </div>
          ) : null}
          {aiOutput && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Analytics AI Output</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Updated {aiOutput.updatedAt}</span>
                  <Button size="sm" variant="outline" onClick={handleCopyAiOutput}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiOutput.body}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <PremiumPage
      eyebrow="Measurement"
      title="Performance Analytics"
      description="Last 30 days of profile, post, reach, and engagement signals."
      actions={
        <>
          <Button onClick={handleAiAnomalySummary} disabled={aiAssistant.isPending} variant="outline" size="sm">
            <Wand2 className={`h-4 w-4 mr-2 ${aiAssistant.isPending ? "animate-pulse" : ""}`} />
            {aiAssistant.isPending ? "Analyzing..." : "AI Anomaly Summary"}
          </Button>
          <Button onClick={handleSync} disabled={syncMutation.isPending} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Syncing..." : "Sync Metrics"}
          </Button>
        </>
      }
    >
      {aiBlock ? (
        <AiWorkflowBlockNotice block={aiBlock} fallbackLink="/agency/ai-setup/activation" />
      ) : null}
      {aiOutput && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Analytics AI Output</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Updated {aiOutput.updatedAt}</span>
              <Button size="sm" variant="outline" onClick={handleCopyAiOutput}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiOutput.body}</p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        <PremiumStatCard
          icon={Eye}
          label="Total Impressions"
          value={analytics.totalImpressions.toLocaleString()}
          detail={
            <span className={cn("inline-flex items-center gap-1", analytics.impressionsGrowth > 0 ? "text-success" : "text-destructive")}>
              {analytics.impressionsGrowth > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(analytics.impressionsGrowth)}%
            </span>
          }
        />
        <PremiumStatCard
          icon={Users}
          label="Total Reach"
          value={analytics.totalReach.toLocaleString()}
          detail={`${analytics.postsThisMonth} posts`}
          tone="accent"
        />
        <PremiumStatCard
          icon={Heart}
          label="Engagement Rate"
          value={`${analytics.avgEngagementRate}%`}
          detail={`${analytics.totalEngagement.toLocaleString()} total engagements`}
          tone="warning"
        />
        <PremiumStatCard
          icon={Users}
          label="Followers"
          value={analytics.totalFollowers.toLocaleString()}
          tone="success"
          detail={
            <span className={cn("inline-flex items-center gap-1", analytics.followerGrowth > 0 ? "text-success" : "text-destructive")}>
              {analytics.followerGrowth > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(analytics.followerGrowth)}%
            </span>
          }
        />
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
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Followers"
                  />
                  <Line
                    type="monotone"
                    dataKey="impressions"
                    stroke="hsl(var(--primary))"
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
              <TrendingUp className="h-5 w-5 text-success" />
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-sm font-bold text-success">
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
                        <span className="font-semibold text-success">{post.engagementRate}%</span>
                        <span>•</span>
                        <span>{post.reach.toLocaleString()} reach</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PremiumInlineEmpty icon={TrendingUp} title="No posts with analytics yet" description="Published posts with synced metrics will appear here." className="py-8" />
            )}
          </CardContent>
        </Card>

        {/* Worst Performing Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-sm font-bold text-destructive">
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
                        <span className="font-semibold text-destructive">{post.engagementRate}%</span>
                        <span>•</span>
                        <span>{post.reach.toLocaleString()} reach</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PremiumInlineEmpty icon={TrendingDown} title="No posts with analytics yet" description="Lower-performing posts will appear once there are enough synced metrics." className="py-8" />
            )}
          </CardContent>
        </Card>
      </div>
    </PremiumPage>
  );
}
