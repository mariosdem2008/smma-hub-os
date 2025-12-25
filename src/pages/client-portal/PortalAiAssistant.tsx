import { useOutletContext } from "react-router-dom";
import AiRepChatTab from "@/components/client-tabs/AiRepChatTab";

interface OutletContext {
  clientId: string;
}

export function PortalAiAssistant() {
  const { clientId } = useOutletContext<OutletContext>();

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <h1 className="text-3xl font-bold">AI Assistant</h1>
      <AiRepChatTab clientId={clientId} />
    </div>
  );
}

