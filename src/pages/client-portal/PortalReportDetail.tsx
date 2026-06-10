import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumInlineEmpty, PremiumLoading, PremiumPage } from "@/components/shared/PremiumPage";
import { ReportDetailView } from "@/components/client-tabs/ReportDetailView";
import { useClientReport } from "@/hooks/useClientReports";

interface OutletContext {
  clientId: string;
}

export function PortalReportDetail() {
  const { clientId } = useOutletContext<OutletContext>();
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { data: report, isLoading } = useClientReport(clientId, reportId);

  if (isLoading) {
    return <PremiumLoading rows={4} />;
  }

  if (!report) {
    return (
      <PremiumPage
        eyebrow="Report"
        title="Report not found"
        description="This report may have been removed or is no longer available."
      >
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => navigate("../performance")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Performance
          </Button>
          <PremiumInlineEmpty
            icon={FileText}
            title="Report not found"
            description="Ask your agency if you expected a report here."
          />
        </div>
      </PremiumPage>
    );
  }

  return (
    <ReportDetailView
      report={report}
      backLabel="Back to Performance"
      onBack={() => navigate("../performance")}
    />
  );
}
