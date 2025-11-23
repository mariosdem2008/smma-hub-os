import BrandingTab from "./BrandingTab";

interface BrandIdentityTabProps {
  clientId: string;
  clientName?: string;
}

export default function BrandIdentityTab({ clientId, clientName }: BrandIdentityTabProps) {
  return <BrandingTab clientId={clientId} clientName={clientName} />;
}
