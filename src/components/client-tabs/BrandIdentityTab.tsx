import BrandingTab from "./BrandingTab";

interface BrandIdentityTabProps {
  clientId: string;
}

export default function BrandIdentityTab({ clientId }: BrandIdentityTabProps) {
  return <BrandingTab clientId={clientId} />;
}
