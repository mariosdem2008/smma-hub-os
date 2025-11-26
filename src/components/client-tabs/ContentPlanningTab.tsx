import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IdeasBoard from "./IdeasTab";
import ScriptsTab from "../scripts/ScriptsTab";

interface ContentPlanningTabProps {
  clientId: string;
}

export default function ContentPlanningTab({ clientId }: ContentPlanningTabProps) {
  return (
    <div className="w-full">
      <Tabs defaultValue="ideas" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
        </TabsList>

        <TabsContent value="ideas">
          <IdeasBoard clientId={clientId} />
        </TabsContent>

        <TabsContent value="scripts">
          <ScriptsTab clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
