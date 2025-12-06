import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { ArrowLeft, Download, TrendingUp, Users, Eye, Heart, FileText, Lightbulb, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { ClientReport } from "@/hooks/useClientReports";

export default function ReportDetail() {
  const { clientId, reportId } = useParams();
  const navigate = useNavigate();

  const { data: report, isLoading } = useQuery({
    queryKey: ["client-report", reportId],
    queryFn: async (): Promise<ClientReport> => {
      const { data, error } = await supabase.from("client_reports").select("*").eq("id", reportId).single();

      if (error) throw error;
      return data as ClientReport;
    },
    enabled: !!reportId,
  });

  const handlePrint = () => {
    window.print();
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

  const { kpis, topPosts, insights, recommendations } = report.data;

  return (
    <div className="space-y-6 report-detail">
      {/* Header - hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate(`/clients/${clientId}?tab=reports`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
        <Button onClick={handlePrint}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {/* Report Title */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{format(new Date(report.month + "-01"), "MMMM yyyy")} Report</h1>
        <p className="text-muted-foreground">
          Generated on {format(new Date(report.created_at), "MMMM d, yyyy 'at' h:mm a")}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Follower Growth"
          value={`${kpis.followersGrowth > 0 ? "+" : ""}${kpis.followersGrowth}%`}
          icon={Users}
          description={`${kpis.followersStart.toLocaleString()} → ${kpis.followersEnd.toLocaleString()}`}
          variant={kpis.followersGrowth >= 0 ? "green" : "default"}
        />
        <StatCard
          title="Total Impressions"
          value={kpis.totalImpressions.toLocaleString()}
          icon={Eye}
          description={`${kpis.postsCount} posts published`}
          variant="teal"
        />
        <StatCard
          title="Engagement Rate"
          value={`${kpis.avgEngagementRate}%`}
          icon={Heart}
          description={`${kpis.totalEngagement.toLocaleString()} total engagements`}
          variant="orange"
        />
        <StatCard
          title="Profile Visits"
          value={kpis.profileVisits.toLocaleString()}
          icon={TrendingUp}
          description="Total profile views"
          variant="purple"
        />
      </div>

      {/* AI Insights */}
      {insights && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-foreground">
              <p className="whitespace-pre-line">{insights}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Recommendations */}
      {recommendations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Strategic Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-foreground">
              <p className="whitespace-pre-line">{recommendations}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Posts */}
      {topPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Top Performing Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPosts.map((post, index) => (
                <div key={post.platform_post_id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-semibold capitalize">{post.platform}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(post.date), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-muted-foreground">Reach</p>
                      <p className="font-semibold">{post.reach.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Engagement</p>
                      <p className="font-semibold">{post.engagement.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Rate</p>
                      <p className="font-semibold text-green-600">{post.engagementRate}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          
          .report-detail {
            max-width: 100% !important;
            padding: 20px;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
