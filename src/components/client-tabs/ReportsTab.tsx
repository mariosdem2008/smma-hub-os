import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Calendar, Download, Plus, TrendingUp } from "lucide-react";
import { useClientReports } from "@/hooks/useClientReports";
import { useGenerateReport } from "@/hooks/useGenerateReport";
import { format, startOfMonth, subMonths } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

interface ReportsTabProps {
  clientId: string;
  agencyId: string;
}

export default function ReportsTab({ clientId, agencyId }: ReportsTabProps) {
  const navigate = useNavigate();
  const { data: reports, isLoading } = useClientReports(clientId);
  const generateReport = useGenerateReport();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(startOfMonth(new Date()), "yyyy-MM")
  );

  // Generate list of last 12 months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(startOfMonth(date), "yyyy-MM"),
      label: format(date, "MMMM yyyy"),
    };
  });

  const handleGenerateReport = () => {
    generateReport.mutate({
      clientId,
      agencyId,
      month: selectedMonth,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generate Report Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Generate New Report
          </CardTitle>
          <CardDescription>
            Create a comprehensive monthly analytics report with AI-powered insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Select Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleGenerateReport}
              disabled={generateReport.isPending}
            >
              {generateReport.isPending ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Generated Reports
        </h3>

        {!reports || reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No reports generated yet</p>
              <p className="text-sm text-muted-foreground">
                Generate your first monthly report to see analytics and AI insights
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card 
                key={report.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/clients/${clientId}/reports/${report.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold">
                          {format(new Date(report.month + "-01"), "MMMM yyyy")} Report
                        </h4>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Posts</p>
                          <p className="text-lg font-semibold">{report.data.kpis.postsCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Impressions</p>
                          <p className="text-lg font-semibold">
                            {report.data.kpis.totalImpressions.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Engagement Rate</p>
                          <p className="text-lg font-semibold">
                            {report.data.kpis.avgEngagementRate}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Follower Growth</p>
                          <p className={`text-lg font-semibold flex items-center gap-1 ${
                            report.data.kpis.followersGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            <TrendingUp className="h-4 w-4" />
                            {report.data.kpis.followersGrowth > 0 ? '+' : ''}
                            {report.data.kpis.followersGrowth}%
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                        <Calendar className="h-4 w-4" />
                        Generated {format(new Date(report.created_at), "MMM d, yyyy")}
                      </div>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/clients/${clientId}/reports/${report.id}`);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}