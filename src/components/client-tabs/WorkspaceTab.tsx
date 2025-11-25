import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TasksTab from "./TasksTab";
import NotesTab from "./NotesTab";
import ApprovalWorkflowManager from "@/components/approval/ApprovalWorkflowManager";

interface WorkspaceTabProps {
  clientId: string;
  initialNotes: string | null;
  onNotesUpdate: (notes: string) => void;
}

export default function WorkspaceTab({ 
  clientId, 
  initialNotes, 
  onNotesUpdate 
}: WorkspaceTabProps) {
  return (
    <Tabs defaultValue="tasks" className="w-full">
      <TabsList>
        <TabsTrigger value="tasks">Tasks</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="workflow">Approval Workflow</TabsTrigger>
      </TabsList>

      <TabsContent value="tasks" className="mt-4">
        <TasksTab clientId={clientId} />
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        <NotesTab 
          clientId={clientId}
          initialNotes={initialNotes}
          onNotesUpdate={onNotesUpdate}
        />
      </TabsContent>

      <TabsContent value="workflow" className="mt-4">
        <ApprovalWorkflowManager clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}
