import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Download,
  TrendingUp,
  Users,
  Eye,
  Heart,
  FileText,
  Lightbulb,
  Target,
  BarChart3,
  PieChart,
  Calendar,
  CheckCircle2,
  Award,
  DollarSign,
  Building,
  Sparkles,
  Shield,
  Zap,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import type { ClientReport } from "@/hooks/useClientReports";
import { cn } from "@/lib/utils";

interface ProfessionalReportData {
  metadata: {
    client: {
      name: string;
      company: string | null;
      niche: string | null;
      logo_url: string | null;
    };
    agency: {
      name: string;
      contact: string;
    };
    period: {
      month: string;
      start_date: string;
      end_date: string;
      generated_at: string;
      report_version: string;
    };
  };
  executive_summary: {
    overview: string;
    key_highlights: {
      follower_growth_percentage: number;
      engagement_rate: number;
      content_volume: number;
      content_performance_score: number;
    };
  };
  performance_kpis: {
    audience_growth: {
      starting_followers: number;
      ending_followers: number;
      net_growth: number;
      growth_percentage: number;
      profile_visits: number;
    };
    content_performance: {
      total_posts: number;
      total_impressions: number;
      total_reach: number;
      total_engagement: number;
      engagement_rate: number;
      avg_impressions_per_post: number;
      avg_reach_per_post: number;
    };
    engagement_breakdown: {
      likes: number;
      comments: number;
      shares: number;
      saves: number;
    };
    efficiency_metrics: {
      engagement_per_post: number;
      impressions_per_follower: number;
    };
  };
  platform_analysis: Array<{
    platform: string;
    posts: number;
    impressions: number;
    reach: number;
    engagement: number;
    engagement_rate: number;
    avg_impressions_per_post: number;
  }>;
  top_performing_content: {
    posts: Array<{
      rank: number;
      platform: string;
      date: string;
      impressions: number;
      reach: number;
      engagement: number;
      engagement_rate: number;
      content_type: string;
    }>;
    campaigns: Array<{
      title: string;
      platforms: string[];
      date: string;
      thumbnail_url: string | null;
    }>;
  };
  strategic_analysis: {
    detailed_insights: string;
    platform_recommendations: Array<{
      platform: string;
      recommendation: string;
      priority: string;
    }>;
  };
  recommendations: {
    executive_summary: string;
    timeline: {
      immediate: string[];
      short_term: string[];
      long_term: string[];
    };
  };
  estimated_value: {
    brand_exposure_value: number;
    lead_generation_value: number;
    customer_acquisition_value: number;
    total_estimated_roi: string;
  };
  appendix: {
    methodology: string;
    definitions: Record<string, string>;
  };
}

export default function ReportDetail() {
  const { clientId, reportId } = useParams();
  const navigate = useNavigate();

  const { data: report, isLoading } = useQuery({
    queryKey: ["client-report", reportId],
    queryFn: async (): Promise<ClientReport & { data: ProfessionalReportData }> => {
      const { data, error } = await supabase.from("client_reports").select("*").eq("id", reportId).single();

      if (error) throw error;
      return data as unknown as ClientReport & { data: ProfessionalReportData };
    },
    enabled: !!reportId,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // In a real implementation, this would call your PDF generation endpoint
    if (report?.data.metadata?.client) {
      window.open(
        `https://${import.meta.env.VITE_SUPABASE_URL?.replace("https://", "")}/storage/v1/object/public/reports/${reportId}.pdf`,
        "_blank",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(`/clients/${clientId}?tab=reports`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Report not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const reportData = report.data;
  const isLegacyFormat = !reportData.metadata;

  // Legacy format fallback
  if (isLegacyFormat) {
    return (
      <div className="space-y-6 report-detail">
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => navigate(`/clients/${clientId}?tab=reports`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reports
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Download className="mr-2 h-4 w-4" />
              Print Report
            </Button>
            <Button onClick={handleDownloadPDF}>
              <FileText className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Legacy report display */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{format(new Date(report.month + "-01"), "MMMM yyyy")} Report</h1>
          <p className="text-muted-foreground">
            Generated on {format(new Date(report.created_at), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>

        {/* ... rest of legacy display ... */}
      </div>
    );
  }

  // Professional report display
  return (
    <div className="space-y-8 report-detail">
      {/* Header - hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate(`/clients/${clientId}?tab=reports`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Download className="mr-2 h-4 w-4" />
            Print Report
          </Button>
          <Button onClick={handleDownloadPDF}>
            <FileText className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Agency Header - Visible in print */}
      <div className="border-b pb-6 print:block">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-primary">{reportData.metadata.agency.name}</h1>
            </div>
            <p className="text-sm text-muted-foreground">Strategic Social Media Intelligence</p>
          </div>
          <Badge variant="outline" className="text-xs">
            v{reportData.metadata.period.report_version}
          </Badge>
        </div>
      </div>

      {/* Client & Report Info */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {reportData.metadata.client.logo_url && (
                  <img
                    src={reportData.metadata.client.logo_url}
                    alt={reportData.metadata.client.name}
                    className="h-12 w-12 rounded-lg object-cover border"
                  />
                )}
                <div>
                  <h2 className="text-2xl font-bold">
                    {reportData.metadata.client.company || reportData.metadata.client.name}
                  </h2>
                  <p className="text-muted-foreground">
                    {reportData.metadata.client.niche || "Social Media Performance Report"}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-right">
              <div className="flex items-center gap-2 justify-end">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">
                  {format(parseISO(reportData.metadata.period.start_date), "MMMM yyyy")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Generated {format(parseISO(reportData.metadata.period.generated_at), "MMMM d, yyyy")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Executive Summary</CardTitle>
          </div>
          <CardDescription>Key highlights and strategic overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none text-foreground">
            <p className="whitespace-pre-line text-base leading-relaxed">{reportData.executive_summary.overview}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-background/50 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <p className="text-sm text-muted-foreground">Follower Growth</p>
              </div>
              <p className="text-2xl font-bold">
                {reportData.executive_summary.key_highlights.follower_growth_percentage > 0 ? "+" : ""}
                {reportData.executive_summary.key_highlights.follower_growth_percentage.toFixed(1)}%
              </p>
            </div>

            <div className="bg-background/50 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-orange-500" />
                <p className="text-sm text-muted-foreground">Content Score</p>
              </div>
              <p className="text-2xl font-bold">
                {reportData.executive_summary.key_highlights.content_performance_score}/100
              </p>
            </div>

            <div className="bg-background/50 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <p className="text-sm text-muted-foreground">Engagement Rate</p>
              </div>
              <p className="text-2xl font-bold">
                {reportData.executive_summary.key_highlights.engagement_rate.toFixed(2)}%
              </p>
            </div>

            <div className="bg-background/50 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-purple-500" />
                <p className="text-sm text-muted-foreground">Content Volume</p>
              </div>
              <p className="text-2xl font-bold">{reportData.executive_summary.key_highlights.content_volume}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="performance">
            <BarChart3 className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="platforms">
            <PieChart className="h-4 w-4 mr-2" />
            Platforms
          </TabsTrigger>
          <TabsTrigger value="content">
            <FileText className="h-4 w-4 mr-2" />
            Top Content
          </TabsTrigger>
          <TabsTrigger value="strategy">
            <Target className="h-4 w-4 mr-2" />
            Strategy
          </TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          {/* Audience Growth */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Audience Growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Starting Followers</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.audience_growth.starting_followers.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Ending Followers</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.audience_growth.ending_followers.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Net Growth</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      reportData.performance_kpis.audience_growth.net_growth >= 0
                        ? "text-green-600"
                        : "text-destructive",
                    )}
                  >
                    {reportData.performance_kpis.audience_growth.net_growth > 0 ? "+" : ""}
                    {reportData.performance_kpis.audience_growth.net_growth.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Profile Visits</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.audience_growth.profile_visits.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Content Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Posts</p>
                  <p className="text-2xl font-bold">{reportData.performance_kpis.content_performance.total_posts}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Impressions</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.content_performance.total_impressions.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Reach</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.content_performance.total_reach.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Engagement Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {reportData.performance_kpis.content_performance.engagement_rate.toFixed(2)}%
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg Impressions/Post</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.content_performance.avg_impressions_per_post.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg Reach/Post</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.content_performance.avg_reach_per_post.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Engagement/Post</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.efficiency_metrics.engagement_per_post.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Engagement Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Engagement Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Likes</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.engagement_breakdown.likes.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Comments</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.engagement_breakdown.comments.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Shares</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.engagement_breakdown.shares.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Saves</p>
                  <p className="text-2xl font-bold">
                    {reportData.performance_kpis.engagement_breakdown.saves.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platforms Tab */}
        <TabsContent value="platforms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Platform Performance
              </CardTitle>
              <CardDescription>Performance metrics by platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.platform_analysis.map((platform) => (
                  <div key={platform.platform} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-medium">
                          {platform.platform}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{platform.posts} posts</span>
                      </div>
                      <Badge
                        variant={platform.engagement_rate > 3 ? "default" : "secondary"}
                        className={cn(platform.engagement_rate > 3 && "bg-green-100 text-green-800 hover:bg-green-100")}
                      >
                        {platform.engagement_rate.toFixed(2)}% engagement
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Impressions</p>
                        <p className="text-lg font-semibold">{platform.impressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Reach</p>
                        <p className="text-lg font-semibold">{platform.reach.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Engagement</p>
                        <p className="text-lg font-semibold">{platform.engagement.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg/Post</p>
                        <p className="text-lg font-semibold">{platform.avg_impressions_per_post.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Top Performing Content
              </CardTitle>
              <CardDescription>Highest engagement rate posts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.top_performing_content.posts.map((post) => (
                  <div key={post.rank} className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-full font-bold",
                            post.rank <= 3 ? "bg-yellow-100 text-yellow-800" : "bg-muted text-muted-foreground",
                          )}
                        >
                          #{post.rank}
                        </div>
                        <div>
                          <p className="font-semibold capitalize">{post.platform}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(post.date), "MMM d, yyyy")} • {post.content_type}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-semibold",
                          post.engagement_rate > 5 && "bg-green-50 text-green-700 border-green-200",
                        )}
                      >
                        {post.engagement_rate.toFixed(2)}% Engagement
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Impressions</p>
                        <p className="text-lg font-semibold">{post.impressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Reach</p>
                        <p className="text-lg font-semibold">{post.reach.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Engagement</p>
                        <p className="text-lg font-semibold">{post.engagement.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Rate</p>
                        <p
                          className={cn(
                            "text-lg font-semibold",
                            post.engagement_rate > 5 ? "text-green-600" : "text-orange-600",
                          )}
                        >
                          {post.engagement_rate.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Campaign Performance */}
          {reportData.top_performing_content.campaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Campaign Highlights
                </CardTitle>
                <CardDescription>Top performing campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.top_performing_content.campaigns.map((campaign, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                      {campaign.thumbnail_url && (
                        <img
                          src={campaign.thumbnail_url}
                          alt={campaign.title}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold">{campaign.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {format(parseISO(campaign.date), "MMM d, yyyy")}
                          </span>
                          <span className="text-sm text-muted-foreground">•</span>
                          <div className="flex gap-1">
                            {campaign.platforms.map((platform) => (
                              <Badge key={platform} variant="secondary" className="text-xs">
                                {platform}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Strategy Tab */}
        <TabsContent value="strategy" className="space-y-6">
          {/* Detailed Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Detailed Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-foreground">
                <p className="whitespace-pre-line">{reportData.strategic_analysis.detailed_insights}</p>
              </div>
            </CardContent>
          </Card>

          {/* Platform Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                Platform Recommendations
              </CardTitle>
              <CardDescription>Prioritized actions by platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reportData.strategic_analysis.platform_recommendations.map((rec) => (
                  <div key={rec.platform} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0">
                      <Badge variant={rec.priority === "High" ? "destructive" : "secondary"} className="font-medium">
                        {rec.priority}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-semibold capitalize">{rec.platform}</p>
                      <p className="text-sm text-muted-foreground mt-1">{rec.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Strategic Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Strategic Roadmap
              </CardTitle>
              <CardDescription>Prioritized timeline for implementation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-foreground mb-6">
                <p className="whitespace-pre-line">{reportData.recommendations.executive_summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Immediate Actions */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-red-500" />
                    <h3 className="font-semibold">Immediate Actions</h3>
                  </div>
                  <div className="space-y-2">
                    {reportData.recommendations.timeline.immediate.map((action, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Short-term Initiatives */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <h3 className="font-semibold">Short-term Initiatives</h3>
                  </div>
                  <div className="space-y-2">
                    {reportData.recommendations.timeline.short_term.map((action, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Long-term Opportunities */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-purple-500" />
                    <h3 className="font-semibold">Long-term Opportunities</h3>
                  </div>
                  <div className="space-y-2">
                    {reportData.recommendations.timeline.long_term.map((action, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estimated Value */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Estimated Value
              </CardTitle>
              <CardDescription>Calculated ROI and business impact</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Brand Exposure</p>
                  <p className="text-xl font-bold">
                    ${reportData.estimated_value.brand_exposure_value.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Lead Generation</p>
                  <p className="text-xl font-bold">
                    ${reportData.estimated_value.lead_generation_value.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Customer Acquisition</p>
                  <p className="text-xl font-bold">
                    ${reportData.estimated_value.customer_acquisition_value.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Estimated ROI</p>
                  <p className="text-xl font-bold text-green-600">{reportData.estimated_value.total_estimated_roi}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Appendix */}
      <Card className="mt-8 border-dashed">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Appendix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Methodology</p>
              <p className="text-sm text-muted-foreground">{reportData.appendix.methodology}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Definitions</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(reportData.appendix.definitions).map(([term, definition]) => (
                  <div key={term} className="text-sm">
                    <span className="font-medium">{term}:</span>
                    <span className="text-muted-foreground ml-2">{definition}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agency Footer */}
      <div className="border-t pt-6 text-center text-sm text-muted-foreground">
        <p>
          <strong>{reportData.metadata.agency.name}</strong> • {reportData.metadata.agency.contact}
        </p>
        <p className="mt-1">This report contains confidential information. Unauthorized distribution is prohibited.</p>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          
          .report-detail {
            max-width: 100% !important;
            padding: 0 !important;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            font-size: 12px;
          }
          
          .card {
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #e5e7eb !important;
            margin-bottom: 16px !important;
          }
          
          .tabs-list,
          .tabs-trigger {
            display: none !important;
          }
          
          .tabs-content {
            display: block !important;
          }
          
          .border-primary {
            border-color: #3b82f6 !important;
          }
          
          h1, h2, h3, h4 {
            color: #111827 !important;
          }
          
          @page {
            margin: 20mm;
          }
        }
      `}</style>
    </div>
  );
}
