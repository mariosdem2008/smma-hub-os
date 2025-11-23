import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ContentCalendarTab from "./ContentCalendarTab";
import IdeasTab from "./IdeasTab";
import ContentPillarsTab from "./ContentPillarsTab";

interface ContentPlanningTabProps {
  clientId: string;
}

export default function ContentPlanningTab({ clientId }: ContentPlanningTabProps) {
  return (
    <Tabs defaultValue="calendar" className="w-full">
      <TabsList>
        <TabsTrigger value="calendar">Content Calendar</TabsTrigger>
        <TabsTrigger value="ideas">Ideas</TabsTrigger>
        <TabsTrigger value="pillars">Content Pillars</TabsTrigger>
      </TabsList>

      <TabsContent value="calendar" className="mt-4">
        <ContentCalendarTab clientId={clientId} />
      </TabsContent>

      <TabsContent value="ideas" className="mt-4">
        <IdeasTab clientId={clientId} />
      </TabsContent>

      <TabsContent value="pillars" className="mt-4">
        <ContentPillarsTab clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}
