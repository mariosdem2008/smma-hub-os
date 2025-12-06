import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Download,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Save,
  Target,
  BarChart3,
  Trophy,
  Calendar,
  Zap,
  Award,
  ChevronRight,
  FileText,
  Lightbulb,
  TrendingDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import type { ClientReport } from "@/hooks/useClientReports";
import { useState } from "react";

// PDF Generation Component
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image } from "@react-pdf/renderer";

// Create styles for PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 30,
  },
  section: {
    margin: 10,
    padding: 10,
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    color: "#1a1a1a",
    fontWeight: "bold",
  },
  subheader: {
    fontSize: 18,
    marginBottom: 10,
    color: "#333333",
    fontWeight: "bold",
  },
  text: {
    fontSize: 12,
    marginBottom: 5,
    color: "#666666",
  },
  metric: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    backgroundColor: "#fafafa",
  },
});

// PDF Report Component
const PDFReport = ({ report }: { report: ClientReport }) => {
  const { kpis, topPosts, analysis, client_info } = report.data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.header}>{client_info.name} - Social Media Performance Report</Text>
          <Text style={styles.text}>Period: {format(parseISO(report.data.month + "-01"), "MMMM yyyy")}</Text>
          <Text style={styles.text}>Generated: {format(parseISO(report.data.generated_at), "MMMM d, yyyy")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.subheader}>Executive Summary</Text>
          <Text style={styles.text}>{analysis.executiveSummary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.subheader}>Key Performance Indicators</Text>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.metric}>Follower Growth: {kpis.followersGrowth}%</Text>
            <Text style={styles.text}>
              {kpis.followersStart.toLocaleString()} → {kpis.followersEnd.toLocaleString()} followers
            </Text>
          </View>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.metric}>Engagement Rate: {kpis.avgEngagementRate}%</Text>
            <Text style={styles.text}>{kpis.totalEngagement.toLocaleString()} total engagements</Text>
          </View>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.metric}>Total Impressions: {kpis.totalImpressions.toLocaleString()}</Text>
            <Text style={styles.text}>{kpis.postsCount} posts published</Text>
          </View>
        </View>

        {analysis.strategicRecommendations && (
          <View style={styles.card}>
            <Text style={styles.subheader}>Strategic Recommendations</Text>
            <Text style={styles.text}>{analysis.strategicRecommendations}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
};

export default function ReportDetail() {
  const { clientId, reportId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: report, isLoading } = useQuery({
    queryKey: ["client-report", reportId],
    queryFn: async (): Promise<ClientReport> => {
      const { data, error } = await supabase.from("client_reports").select("*").eq("id", reportId).single();

      if (error) throw error;

      // Proper type assertion
      return {
        ...data,
        data: data.data as ClientReport["data"],
      } as ClientReport;
    },
    enabled: !!reportId,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
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

  const { kpis, topPosts, analysis, client_info } = report.data;
  const reportDate = parseISO(report.data.month + "-01");

  // Calculate engagement distribution
  const totalEngagement =
    kpis.engagementByType.likes +
    kpis.engagementByType.comments +
    kpis.engagementByType.shares +
    kpis.engagementByType.saves;

  const engagementDistribution = {
    likes: (kpis.engagementByType.likes / totalEngagement) * 100,
    comments: (kpis.engagementByType.comments / totalEngagement) * 100,
    shares: (kpis.engagementByType.shares / totalEngagement) * 100,
    saves: (kpis.engagementByType.saves / totalEngagement) * 100,
  };

  return (
    <div className="space-y-6 report-detail">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate(`/clients/${clientId}?tab=reports`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
        <div className="flex items-center gap-2">
          <PDFDownloadLink
            document={<PDFReport report={report} />}
            fileName={`${client_info.name}-${format(reportDate, "yyyy-MM")}-report.pdf`}
          >
            {({ loading }) => (
              <Button disabled={loading}>
                <Download className="mr-2 h-4 w-4" />
                {loading ? "Generating PDF..." : "Download PDF"}
              </Button>
            )}
          </PDFDownloadLink>
          <Button onClick={handlePrint} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Report Header */}
      <div className="space-y-4 print:mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client_info.name} Performance Report</h1>
            <p className="text-muted-foreground mt-1">
              {format(reportDate, "MMMM yyyy")} • {client_info.industry} Industry
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            <Calendar className="mr-1 h-3 w-3" />
            {format(parseISO(report.data.generated_at), "MMM d, yyyy")}
          </Badge>
        </div>
        <Separator />
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="content">Top Content</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Executive Summary */}
          <Card className="border-blue-100 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-blue-600" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground leading-relaxed">
                  {analysis.executiveSummary || "Executive summary will be generated by AI analysis."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Follower Growth"
              value={`${kpis.followersGrowth > 0 ? "+" : ""}${kpis.followersGrowth.toFixed(1)}%`}
              icon={TrendingUp}
              description={`${kpis.followersStart.toLocaleString()} → ${kpis.followersEnd.toLocaleString()}`}
              variant={kpis.followersGrowth >= 5 ? "green" : kpis.followersGrowth >= 0 ? "default" : "destructive"}
              trend={kpis.followersGrowth}
            />
            <StatCard
              title="Engagement Rate"
              value={`${kpis.avgEngagementRate.toFixed(2)}%`}
              icon={Heart}
              description="Above industry average"
              variant={kpis.avgEngagementRate >= 3 ? "green" : kpis.avgEngagementRate >= 1 ? "default" : "destructive"}
              trend={kpis.avgEngagementRate}
            />
            <StatCard
              title="Total Reach"
              value={(kpis.totalReach / 1000).toFixed(1) + "K"}
              icon={Eye}
              description={`${kpis.postsCount} posts • ${kpis.avgReachPerPost.toLocaleString()} avg`}
              variant="teal"
            />
            <StatCard
              title="Top Platform"
              value={kpis.topPerformingPlatform}
              icon={Trophy}
              description="Highest engagement rate"
              variant="purple"
            />
          </div>

          {/* Engagement Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Engagement Breakdown
              </CardTitle>
              <CardDescription>Distribution of engagement types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      Likes
                    </span>
                    <span className="text-sm font-bold">
                      {kpis.engagementByType.likes.toLocaleString()} ({engagementDistribution.likes.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={engagementDistribution.likes} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      Comments
                    </span>
                    <span className="text-sm font-bold">
                      {kpis.engagementByType.comments.toLocaleString()} ({engagementDistribution.comments.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={engagementDistribution.comments} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-green-500" />
                      Shares
                    </span>
                    <span className="text-sm font-bold">
                      {kpis.engagementByType.shares.toLocaleString()} ({engagementDistribution.shares.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={engagementDistribution.shares} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Save className="h-4 w-4 text-purple-500" />
                      Saves
                    </span>
                    <span className="text-sm font-bold">
                      {kpis.engagementByType.saves.toLocaleString()} ({engagementDistribution.saves.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={engagementDistribution.saves} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          {/* Detailed KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Posting Frequency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.postingFrequency.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Posts per day</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg. Impressions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.avgImpressionsPerPost.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Per post</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Profile Visits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.profileVisits.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total visits</p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground whitespace-pre-line">
                  {analysis.performanceInsights || "Detailed performance insights will be generated by AI analysis."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Competitive Analysis */}
          {analysis.competitiveAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  Competitive Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="text-foreground whitespace-pre-line">{analysis.competitiveAnalysis}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Top Performing Content
              </CardTitle>
              <CardDescription>Top 10 posts by engagement rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPosts.map((post, index) => (
                  <Card key={post.platform_post_id} className="overflow-hidden">
                    <div className="flex items-start justify-between p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                          #{index + 1}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {post.platform}
                            </Badge>
                            <Badge variant="secondary">{post.media_type}</Badge>
                          </div>
                          <p className="text-sm font-medium line-clamp-2">{post.caption || "No caption available"}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(post.date), "MMM d, yyyy")}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-green-600">{post.engagementRate}%</span>
                          <span className="text-xs text-muted-foreground">Eng. Rate</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-right">
                            <div className="font-semibold">{post.reach.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">Reach</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{post.engagement.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">Engagement</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30">
                      <div className="text-center">
                        <Heart className="h-4 w-4 text-red-500 mx-auto mb-1" />
                        <div className="text-sm font-semibold">{post.likes.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Likes</div>
                      </div>
                      <div className="text-center">
                        <MessageSquare className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                        <div className="text-sm font-semibold">{post.comments.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Comments</div>
                      </div>
                      <div className="text-center">
                        <Share2 className="h-4 w-4 text-green-500 mx-auto mb-1" />
                        <div className="text-sm font-semibold">{post.shares.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Shares</div>
                      </div>
                      <div className="text-center">
                        <Eye className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                        <div className="text-sm font-semibold">{post.impressions.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Impressions</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          {/* Strategic Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                Strategic Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground whitespace-pre-line">
                  {analysis.strategicRecommendations || "Strategic recommendations will be generated by AI analysis."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Industry Benchmarks */}
          {analysis.industryBenchmarks && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Industry Benchmarks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="text-foreground whitespace-pre-line">{analysis.industryBenchmarks}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Key Takeaways */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Key Takeaways
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600 mt-2"></div>
                  <span className="text-sm">
                    <strong>Follower Growth:</strong> {kpis.followersGrowth > 0 ? "Positive" : "Needs improvement"} at{" "}
                    {Math.abs(kpis.followersGrowth).toFixed(1)}%
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600 mt-2"></div>
                  <span className="text-sm">
                    <strong>Engagement Quality:</strong>{" "}
                    {kpis.avgEngagementRate >= 3
                      ? "Excellent"
                      : kpis.avgEngagementRate >= 1
                        ? "Average"
                        : "Below average"}{" "}
                    at {kpis.avgEngagementRate.toFixed(2)}%
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600 mt-2"></div>
                  <span className="text-sm">
                    <strong>Content Performance:</strong> {kpis.topPerformingPlatform} is the most effective platform
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600 mt-2"></div>
                  <span className="text-sm">
                    <strong>Posting Strategy:</strong> {kpis.postingFrequency >= 1 ? "Optimal" : "Insufficient"}{" "}
                    frequency at {kpis.postingFrequency.toFixed(1)} posts/day
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Print-only summary */}
      <div className="hidden print:block space-y-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Executive Summary</h2>
          <p className="text-foreground">{analysis.executiveSummary}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-bold">Follower Growth</h3>
            <p>
              {kpis.followersGrowth.toFixed(1)}% ({kpis.followersStart.toLocaleString()} →{" "}
              {kpis.followersEnd.toLocaleString()})
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold">Engagement Rate</h3>
            <p>{kpis.avgEngagementRate.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          
          .report-detail {
            max-width: 100% !important;
            padding: 0;
            font-size: 12px;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .card {
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #e5e5e5 !important;
            margin-bottom: 16px;
          }
          
          h1, h2, h3 {
            color: #000000 !important;
          }
          
          .text-muted-foreground {
            color: #666666 !important;
          }
        }
      `}</style>
    </div>
  );
}
