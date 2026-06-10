import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumInlineEmpty, PremiumLoading } from "@/components/shared/PremiumPage";
import { ReportDetailView } from "@/components/client-tabs/ReportDetailView";
import { useClientReport } from "@/hooks/useClientReports";

export default function ReportDetail() {
  const { clientId, reportId } = useParams();
  const navigate = useNavigate();
  const { data: report, isLoading } = useClientReport(clientId, reportId);

  if (isLoading) {
    return <PremiumLoading rows={4} />;
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(`/clients/${clientId}?tab=reports`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
        <PremiumInlineEmpty
          icon={FileText}
          title="Report not found"
          description="This report may have been removed or is no longer available."
        />
      </div>
    );
  }

  return (
    <ReportDetailView
      report={report}
      backLabel="Back to Reports"
      onBack={() => navigate(`/clients/${clientId}?tab=reports`)}
    />
  );
}
