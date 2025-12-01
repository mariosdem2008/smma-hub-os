import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Folder } from "lucide-react";
import ProjectAssetsTab from "./ProjectAssetsTab";
import ProjectScriptIdeaTab from "./ProjectScriptIdeaTab";
import ProjectFinalContentTab from "./ProjectFinalContentTab";

interface Project {
  id: string;
  title: string;
  client_id: string;
  agency_id: string;
  idea_id: string | null;
  script_id: string | null;
  thumbnail_url: string | null;
  notes: string | null;
  editor_comments: string | null;
  status: string;
  final_asset_id: string | null;
  platforms: string[];
  scheduled_time: string | null;
  platform_captions: Record<string, string>;
  hashtags: string | null;
  published_urls: Record<string, string> | null;
  error_message: string | null;
}

interface ProjectEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onUpdate: () => void;
}

export default function ProjectEditor({
  open,
  onOpenChange,
  projectId,
  onUpdate,
}: ProjectEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (projectId && open) {
      fetchProject();
    }
  }, [projectId, open]);

  const fetchProject = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      const projectData = data as any;
      setProject({
        ...projectData,
        platform_captions: (projectData.platform_captions as Record<string, string>) || {},
        published_urls: (projectData.published_urls as Record<string, string>) || null,
        error_message: projectData.error_message || null,
      });
      setTitle(data.title);
    } catch (error) {
      console.error("Error fetching project:", error);
      toast({
        title: "Error",
        description: "Failed to load project",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTitleUpdate = async () => {
    if (!projectId || !title.trim()) return;

    try {
      const { error } = await supabase
        .from("projects")
        .update({ title: title.trim() })
        .eq("id", projectId);

      if (error) throw error;

      toast({
        title: "Updated",
        description: "Project title updated successfully",
      });

      onUpdate();
    } catch (error) {
      console.error("Error updating title:", error);
      toast({
        title: "Error",
        description: "Failed to update title",
        variant: "destructive",
      });
    }
  };

  if (loading || !project) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Folder className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 flex items-center gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleUpdate}
                className="text-lg font-semibold border-none shadow-none px-0 focus-visible:ring-0"
              />
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="assets" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="script-idea">Script & Idea</TabsTrigger>
            <TabsTrigger value="final">Final Content</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="assets" className="mt-0 h-full">
              <ProjectAssetsTab project={project} onUpdate={fetchProject} />
            </TabsContent>

            <TabsContent value="script-idea" className="mt-0 h-full">
              <ProjectScriptIdeaTab project={project} onUpdate={fetchProject} />
            </TabsContent>

            <TabsContent value="final" className="mt-0 h-full">
              <ProjectFinalContentTab project={project} onUpdate={fetchProject} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
