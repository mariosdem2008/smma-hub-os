import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssetsTab from "./AssetsTab";
import InspirationTab from "./InspirationTab";
import SavedCaptionsTab from "./SavedCaptionsTab";
import HashtagsTab from "./HashtagsTab";

interface ContentLibraryTabProps {
  clientId: string;
  agencyId: string;
}

export default function ContentLibraryTab({ clientId, agencyId }: ContentLibraryTabProps) {
  return (
    <Tabs defaultValue="assets" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="assets">Assets</TabsTrigger>
        <TabsTrigger value="inspiration">Inspiration</TabsTrigger>
        <TabsTrigger value="captions">Saved Captions</TabsTrigger>
        <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
      </TabsList>

      <TabsContent value="assets" className="mt-4">
        <AssetsTab clientId={clientId} agencyId={agencyId} />
      </TabsContent>

      <TabsContent value="inspiration" className="mt-4">
        <InspirationTab clientId={clientId} />
      </TabsContent>

      <TabsContent value="captions" className="mt-4">
        <SavedCaptionsTab clientId={clientId} />
      </TabsContent>

      <TabsContent value="hashtags" className="mt-4">
        <HashtagsTab clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}
