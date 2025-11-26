import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, FileText, Link as LinkIcon } from "lucide-react";

interface Project {
  id: string;
  client_id: string;
  idea_id: string | null;
  script_id: string | null;
}

interface Idea {
  id: string;
  title: string;
  description: string | null;
  content_body: string | null;
}

interface Script {
  id: string;
  title: string;
  hook: string | null;
  script_body: string | null;
  cta: string | null;
  editor_notes: string | null;
}

interface ProjectScriptIdeaTabProps {
  project: Project;
  onUpdate: () => void;
}

export default function ProjectScriptIdeaTab({ project, onUpdate }: ProjectScriptIdeaTabProps) {
  const { toast } = useToast();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [linkedIdea, setLinkedIdea] = useState<Idea | null>(null);
  const [linkedScript, setLinkedScript] = useState<Script | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string>(project.idea_id || "");
  const [selectedScriptId, setSelectedScriptId] = useState<string>(project.script_id || "");

  useEffect(() => {
    fetchData();
  }, [project.id]);

  const fetchData = async () => {
    try {
      // Fetch all ideas and scripts for this client
      const [ideasRes, scriptsRes] = await Promise.all([
        supabase.from("ideas").select("*").eq("client_id", project.client_id),
        supabase.from("scripts").select("*").eq("client_id", project.client_id),
      ]);

      if (ideasRes.data) setIdeas(ideasRes.data);
      if (scriptsRes.data) setScripts(scriptsRes.data);

      // Fetch linked idea if exists
      if (project.idea_id) {
        const { data } = await supabase
          .from("ideas")
          .select("*")
          .eq("id", project.idea_id)
          .single();
        if (data) setLinkedIdea(data);
      }

      // Fetch linked script if exists
      if (project.script_id) {
        const { data } = await supabase
          .from("scripts")
          .select("*")
          .eq("id", project.script_id)
          .single();
        if (data) setLinkedScript(data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleLinkIdea = async () => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({ idea_id: selectedIdeaId || null })
        .eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Updated",
        description: selectedIdeaId ? "Idea linked to project" : "Idea unlinked from project",
      });

      onUpdate();
      fetchData();
    } catch (error) {
      console.error("Error linking idea:", error);
      toast({
        title: "Error",
        description: "Failed to update idea link",
        variant: "destructive",
      });
    }
  };

  const handleLinkScript = async () => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({ script_id: selectedScriptId || null })
        .eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Updated",
        description: selectedScriptId ? "Script linked to project" : "Script unlinked from project",
      });

      onUpdate();
      fetchData();
    } catch (error) {
      console.error("Error linking script:", error);
      toast({
        title: "Error",
        description: "Failed to update script link",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Link Controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Link Idea</label>
          <div className="flex gap-2">
            <Select value={selectedIdeaId || undefined} onValueChange={setSelectedIdeaId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select an idea" />
              </SelectTrigger>
              <SelectContent>
                {ideas.map((idea) => (
                  <SelectItem key={idea.id} value={idea.id}>
                    {idea.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleLinkIdea} disabled={selectedIdeaId === project.idea_id}>
              Update
            </Button>
            {selectedIdeaId && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedIdeaId("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Link Script</label>
          <div className="flex gap-2">
            <Select value={selectedScriptId || undefined} onValueChange={setSelectedScriptId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a script" />
              </SelectTrigger>
              <SelectContent>
                {scripts.map((script) => (
                  <SelectItem key={script.id} value={script.id}>
                    {script.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleLinkScript} disabled={selectedScriptId === project.script_id}>
              Update
            </Button>
            {selectedScriptId && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedScriptId("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Linked Idea Display */}
      {linkedIdea && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Linked Idea
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold mb-1">{linkedIdea.title}</h4>
              {linkedIdea.description && (
                <p className="text-sm text-muted-foreground">{linkedIdea.description}</p>
              )}
            </div>
            {linkedIdea.content_body && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Full Content:</p>
                <div className="text-sm bg-muted p-3 rounded max-h-48 overflow-y-auto">
                  {linkedIdea.content_body}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Linked Script Display */}
      {linkedScript && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Linked Script
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-1">{linkedScript.title}</h4>
            </div>

            {linkedScript.hook && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Hook:</p>
                <p className="text-sm">{linkedScript.hook}</p>
              </div>
            )}

            {linkedScript.script_body && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Script:</p>
                <div className="text-sm bg-muted p-3 rounded max-h-48 overflow-y-auto font-mono">
                  {linkedScript.script_body}
                </div>
              </div>
            )}

            {linkedScript.cta && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">CTA:</p>
                <p className="text-sm">{linkedScript.cta}</p>
              </div>
            )}

            {linkedScript.editor_notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Editor Notes:</p>
                <p className="text-sm text-muted-foreground">{linkedScript.editor_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!linkedIdea && !linkedScript && (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <LinkIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="text-lg font-semibold mb-2">No Linked Content</h4>
          <p className="text-muted-foreground">
            Link an idea or script to provide context for this project
          </p>
        </div>
      )}
    </div>
  );
}
