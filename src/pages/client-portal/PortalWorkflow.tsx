import { useOutletContext } from "react-router-dom";
import ApprovalWorkflowManager from "@/components/approval/ApprovalWorkflowManager";

interface OutletContext {
  clientId: string;
}

export function PortalWorkflow() {
  const { clientId } = useOutletContext<OutletContext>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Approval Workflow</h2>
        <p className="text-muted-foreground">
          Configure who reviews and approves your content before publication
        </p>
      </div>
      
      <ApprovalWorkflowManager clientId={clientId} isClientPortal={true} />
    </div>
  );
}