import { useOutletContext } from "react-router-dom";
import AiRepChatTab from "@/components/client-tabs/AiRepChatTab";
import { PremiumPage } from "@/components/shared/PremiumPage";

interface OutletContext {
  clientId: string;
}

export function PortalAiAssistant() {
  const { clientId } = useOutletContext<OutletContext>();

  return (
    <PremiumPage
      eyebrow="Assistant"
      title="AI Assistant"
      description="Ask campaign, asset, and performance questions in your client portal."
      className="mx-auto max-w-4xl"
    >
      <AiRepChatTab clientId={clientId} />
    </PremiumPage>
  );
}

