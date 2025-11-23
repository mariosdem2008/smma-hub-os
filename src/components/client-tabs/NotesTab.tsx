import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface NotesTabProps {
  clientId: string;
  initialNotes: string | null;
  onUpdate: (notes: string) => void;
}

export default function NotesTab({
  clientId,
  initialNotes,
  onUpdate,
}: NotesTabProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);

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
      onUpdate(notes);
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Client Notes</CardTitle>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Notes"}
        </Button>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this client..."
          rows={15}
          className="resize-none"
        />
      </CardContent>
    </Card>
  );
}
