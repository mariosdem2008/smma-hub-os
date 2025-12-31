import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IdeasBoard from "./IdeasTab";
import ScriptsTab from "@/components/scripts/ScriptsTab";

interface IdeaScriptingTabProps {
  clientId: string;
}

export default function IdeaScriptingTab({ clientId }: IdeaScriptingTabProps) {
  return (
    <Tabs defaultValue="ideas" className="space-y-4">
      <TabsList className="bg-muted/60">
        <TabsTrigger value="ideas" className="data-[state=active]:bg-background">
          Ideas
        </TabsTrigger>
        <TabsTrigger value="scripts" className="data-[state=active]:bg-background">
          Scripts
        </TabsTrigger>
      </TabsList>
      <TabsContent value="ideas">
        <IdeasBoard clientId={clientId} />
      </TabsContent>
      <TabsContent value="scripts">
        <ScriptsTab clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}
