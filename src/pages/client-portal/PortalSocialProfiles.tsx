import { useOutletContext } from "react-router-dom";
import SocialConnectionsSection from "@/components/SocialConnectionsSection";
import { PremiumPage } from "@/components/shared/PremiumPage";

interface OutletContext {
  clientId: string;
  client: any;
  clientUser: any;
}

export default function PortalSocialProfiles() {
  const { clientId } = useOutletContext<OutletContext>();

  return (
    <PremiumPage
      eyebrow="Connections"
      title="Social Profiles"
      description="Connect and manage your social media accounts."
    >
      <SocialConnectionsSection clientId={clientId} isClientPortal={true} />
    </PremiumPage>
  );
}
