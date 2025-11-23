import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrandingTab from "./BrandingTab";
import SocialProfilesTab from "../SocialProfilesTab";

interface BrandIdentityTabProps {
  clientId: string;
}

export default function BrandIdentityTab({ clientId }: BrandIdentityTabProps) {
  return (
    <Tabs defaultValue="branding" className="w-full">
      <TabsList>
        <TabsTrigger value="branding">Branding</TabsTrigger>
        <TabsTrigger value="social">Social Profiles</TabsTrigger>
      </TabsList>

      <TabsContent value="branding" className="mt-4">
        <BrandingTab clientId={clientId} />
      </TabsContent>

      <TabsContent value="social" className="mt-4">
        <SocialProfilesTab clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}
