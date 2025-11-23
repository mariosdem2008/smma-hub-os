import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { Save } from "lucide-react";

interface NotesTabProps {
  clientId: string;
  initialNotes: string | null;
  onNotesUpdate: (notes: string) => void;
}

export default function NotesTab({ clientId, initialNotes, onNotesUpdate }: NotesTabProps) {
  const { toast } = useToast();
  const { canEditContent, isViewer } = useRole();
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasChanges(value !== (initialNotes || ""));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({ notes })
      .eq("id", clientId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Notes saved successfully",
      });
      onNotesUpdate(notes);
      setHasChanges(false);
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Client Notes</CardTitle>
            <CardDescription>
              {isViewer 
                ? "View notes about this client"
                : "Keep important notes and information about this client"}
            </CardDescription>
          </div>
          {canEditContent && (
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              size="sm"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Notes"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder={isViewer ? "No notes available" : "Add notes about this client..."}
          className="min-h-[400px] resize-y"
          disabled={isViewer || !canEditContent}
        />
      </CardContent>
    </Card>
  );
}
