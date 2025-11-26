import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ScriptEditor from "./ScriptEditor";
import ScriptCard from "./ScriptCard";

interface Script {
  id: string;
  title: string;
  hook: string | null;
  script_body: string | null;
  cta: string | null;
  editor_notes: string | null;
  idea_id: string | null;
  status: string;
  created_at: string;
}

interface Idea {
  id: string;
  title: string;
}

interface ScriptsTabProps {
  clientId: string;
}

export default function ScriptsTab({ clientId }: ScriptsTabProps) {
  const { toast } = useToast();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);

  useEffect(() => {
    fetchScripts();
    fetchIdeas();
  }, [clientId]);

  const fetchScripts = async () => {
    try {
      const { data, error } = await supabase
        .from("scripts")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setScripts(data || []);
    } catch (error) {
      console.error("Error fetching scripts:", error);
      toast({
        title: "Error",
        description: "Failed to load scripts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchIdeas = async () => {
    try {
      const { data, error } = await supabase
        .from("ideas")
        .select("id, title")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setIdeas(data || []);
    } catch (error) {
      console.error("Error fetching ideas:", error);
    }
  };

  const handleDelete = async (scriptId: string) => {
    try {
      const { error } = await supabase
        .from("scripts")
        .delete()
        .eq("id", scriptId);

      if (error) throw error;

      toast({
        title: "Script Deleted",
        description: "Script has been deleted successfully",
      });

      fetchScripts();
    } catch (error) {
      console.error("Error deleting script:", error);
      toast({
        title: "Error",
        description: "Failed to delete script",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (script: Script) => {
    setSelectedScript(script);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setSelectedScript(null);
    setEditorOpen(true);
  };

  const handleSave = () => {
    fetchScripts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading scripts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Scripts Library</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage video scripts with hooks, CTAs, and editor notes
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Script
        </Button>
      </div>

      {scripts.length === 0 ? (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="text-lg font-semibold mb-2">No Scripts Yet</h4>
          <p className="text-muted-foreground mb-4">
            Create your first script to organize content creation
          </p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Script
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map((script) => {
            const linkedIdea = ideas.find((idea) => idea.id === script.idea_id);
            return (
              <ScriptCard
                key={script.id}
                script={script}
                linkedIdea={linkedIdea}
                onEdit={() => handleEdit(script)}
                onDelete={() => handleDelete(script.id)}
              />
            );
          })}
        </div>
      )}

      <ScriptEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        script={selectedScript}
        clientId={clientId}
        ideas={ideas}
        onSave={handleSave}
      />
    </div>
  );
}
