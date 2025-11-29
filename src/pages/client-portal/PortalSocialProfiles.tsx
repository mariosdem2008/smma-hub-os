import { useOutletContext } from "react-router-dom";
import SocialConnectionsSection from "@/components/SocialConnectionsSection";

interface OutletContext {
  clientId: string;
  client: any;
  clientUser: any;
}

export default function PortalSocialProfiles() {
  const { clientId } = useOutletContext<OutletContext>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Social Profiles</h2>
        <p className="text-muted-foreground">
          Connect and manage your social media accounts
        </p>
      </div>

      <SocialConnectionsSection clientId={clientId} isClientPortal={true} />
    </div>
  );
}
