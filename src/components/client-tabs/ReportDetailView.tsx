import { format } from "date-fns";
import {
  ArrowLeft,
  BarChart3,
  Download,
  Eye,
  FileText,
  Heart,
  Lightbulb,
  MousePointerClick,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PremiumStatCard } from "@/components/shared/PremiumPage";
import type { ClientReport } from "@/hooks/useClientReports";

interface ReportDetailViewProps {
  report: ClientReport;
  backLabel: string;
  onBack: () => void;
}

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString();
}

function formatPercent(value: number | null | undefined, includeSign = false) {
  const numeric = Number(value ?? 0);
  const prefix = includeSign && numeric > 0 ? "+" : "";
  return `${prefix}${numeric}%`;
}

export function ReportDetailView({ report, backLabel, onBack }: ReportDetailViewProps) {
  const kpis = report.data.kpis;
  const topPosts = Array.isArray(report.data.topPosts) ? report.data.topPosts : [];
  const insights = report.data.insights?.trim();
  const recommendations = report.data.recommendations?.trim();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 report-detail">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>
        <Button onClick={handlePrint}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-label uppercase tracking-wider text-primary">Monthly Report</p>
        <h1 className="font-display text-3xl font-bold md:text-4xl">
          {format(new Date(`${report.month}-01T00:00:00`), "MMMM yyyy")} Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Generated on {format(new Date(report.created_at), "MMMM d, yyyy 'at' h:mm a")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <PremiumStatCard
          label="Followers Start"
          value={formatNumber(kpis.followersStart)}
          icon={Users}
          detail="Opening audience size"
        />
        <PremiumStatCard
          label="Followers End"
          value={formatNumber(kpis.followersEnd)}
          icon={Users}
          detail="Closing audience size"
          tone="accent"
        />
        <PremiumStatCard
          label="Follower Growth"
          value={formatPercent(kpis.followersGrowth, true)}
          icon={TrendingUp}
          detail={`${formatNumber(kpis.followersStart)} to ${formatNumber(kpis.followersEnd)}`}
          tone={kpis.followersGrowth >= 0 ? "success" : "destructive"}
        />
        <PremiumStatCard
          label="Posts Published"
          value={formatNumber(kpis.postsCount)}
          icon={FileText}
          detail="Content volume"
          tone="primary"
        />
        <PremiumStatCard
          label="Total Impressions"
          value={formatNumber(kpis.totalImpressions)}
          icon={Eye}
          detail="Times content was displayed"
          tone="primary"
        />
        <PremiumStatCard
          label="Total Reach"
          value={formatNumber(kpis.totalReach)}
          icon={BarChart3}
          detail="Unique audience reached"
          tone="accent"
        />
        <PremiumStatCard
          label="Total Engagement"
          value={formatNumber(kpis.totalEngagement)}
          icon={Heart}
          detail="Likes, comments, shares, and saves"
          tone="warning"
        />
        <PremiumStatCard
          label="Engagement Rate"
          value={formatPercent(kpis.avgEngagementRate)}
          icon={Heart}
          detail="Average engagement by reach"
          tone="warning"
        />
        <PremiumStatCard
          label="Profile Visits"
          value={formatNumber(kpis.profileVisits)}
          icon={MousePointerClick}
          detail="Total profile views"
          tone="success"
        />
      </div>

      {insights ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              AI Insight Narrative
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-foreground">
              <p className="whitespace-pre-line">{insights}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {recommendations ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Strategic Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-foreground">
              <p className="whitespace-pre-line">{recommendations}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {topPosts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Top Performing Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPosts.map((post, index) => (
                <div
                  key={`${post.platform_post_id}-${index}`}
                  className="grid gap-4 rounded-lg border border-border/80 bg-muted/20 p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold capitalize">{post.platform}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(post.date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground">Impressions</p>
                      <p className="font-semibold tabular-nums">{formatNumber(post.impressions)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Reach</p>
                      <p className="font-semibold tabular-nums">{formatNumber(post.reach)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Engagement</p>
                      <p className="font-semibold tabular-nums">{formatNumber(post.engagement)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Rate</p>
                      <p className="font-semibold text-success tabular-nums">{formatPercent(post.engagementRate)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

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
