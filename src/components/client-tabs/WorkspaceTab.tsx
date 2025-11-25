import NotesTab from "./NotesTab";

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
    <div className="w-full">
      <NotesTab 
        clientId={clientId}
        initialNotes={initialNotes}
        onNotesUpdate={onNotesUpdate}
      />
    </div>
  );
}
