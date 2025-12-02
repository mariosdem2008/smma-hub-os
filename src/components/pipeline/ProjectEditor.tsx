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
import ProjectCommentsTab from "./ProjectCommentsTab";
import ProjectActivityLog from "./ProjectActivityLog";
import ProjectOverviewTab from "./ProjectOverviewTab";
import ProjectSchedulingTab from "./ProjectSchedulingTab";
import ProjectMessagesTab from "./ProjectMessagesTab";
import { AIAssistant } from "./AIAssistant";

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
  rejection_reason: string | null;
  rejection_category: string | null;
  assigned_user?: {
    full_name: string | null;
    email: string;
  } | null;
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
        .select("*, assigned_to")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      const projectData = data as any;
      
      // Fetch assigned user info if assigned
      let assignedUser = null;
      if (projectData.assigned_to) {
        const { data: member } = await supabase
          .from("agency_members")
          .select("user_id")
          .eq("id", projectData.assigned_to)
          .single();
        
        if (member) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", member.user_id)
            .single();
          
          if (profile) {
            assignedUser = {
              full_name: profile.full_name,
              email: profile.email
            };
          }
        }
      }

      setProject({
        ...projectData,
        platform_captions: (projectData.platform_captions as Record<string, string>) || {},
        published_urls: (projectData.published_urls as Record<string, string>) || null,
        error_message: projectData.error_message || null,
        rejection_reason: projectData.rejection_reason || null,
        rejection_category: projectData.rejection_category || null,
        assigned_user: assignedUser
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
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
            <AIAssistant
              projectId={project.id}
              clientId={project.client_id}
              onGenerateIdea={(idea) => {
                toast({
                  title: "Idea Added",
                  description: "Navigate to Script & Idea tab to view and edit",
                });
              }}
              onGenerateHook={(hook) => {
                toast({
                  title: "Hook Generated",
                  description: "Copy and paste into your script editor",
                });
              }}
              onGenerateScript={(script) => {
                toast({
                  title: "Script Generated",
                  description: "Navigate to Script & Idea tab to view and edit",
                });
              }}
              onImproveScript={(script) => {
                toast({
                  title: "Script Improved",
                  description: "Copy and paste into your script editor",
                });
              }}
              onGenerateCaption={(captions) => {
                toast({
                  title: "Captions Generated",
                  description: "Navigate to Final Content tab to apply captions",
                });
              }}
              onImproveCaption={(captions) => {
                toast({
                  title: "Captions Improved",
                  description: "Navigate to Final Content tab to apply captions",
                });
              }}
            />
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="overview" className="flex-shrink-0">Overview</TabsTrigger>
            <TabsTrigger value="assets" className="flex-shrink-0">Assets</TabsTrigger>
            <TabsTrigger value="script-idea" className="flex-shrink-0">Script & Idea</TabsTrigger>
            <TabsTrigger value="final" className="flex-shrink-0">Final Content</TabsTrigger>
            <TabsTrigger value="comments" className="flex-shrink-0">Comments</TabsTrigger>
            <TabsTrigger value="scheduling" className="flex-shrink-0">Scheduling</TabsTrigger>
            <TabsTrigger value="messages" className="flex-shrink-0">Messages</TabsTrigger>
            <TabsTrigger value="activity" className="flex-shrink-0">Activity</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="overview" className="mt-0 h-full">
              <ProjectOverviewTab project={project} />
            </TabsContent>

            <TabsContent value="assets" className="mt-0 h-full">
              <ProjectAssetsTab project={project} onUpdate={fetchProject} />
            </TabsContent>

            <TabsContent value="script-idea" className="mt-0 h-full">
              <ProjectScriptIdeaTab project={project} onUpdate={fetchProject} />
            </TabsContent>

            <TabsContent value="final" className="mt-0 h-full">
              <ProjectFinalContentTab project={project} onUpdate={fetchProject} />
            </TabsContent>

            <TabsContent value="comments" className="mt-0 h-full">
              <ProjectCommentsTab projectId={project.id} clientId={project.client_id} />
            </TabsContent>

            <TabsContent value="scheduling" className="mt-0 h-full">
              <ProjectSchedulingTab projectId={project.id} />
            </TabsContent>

            <TabsContent value="messages" className="mt-0 h-full">
              <ProjectMessagesTab projectId={project.id} clientId={project.client_id} />
            </TabsContent>

            <TabsContent value="activity" className="mt-0 h-full p-4">
              <ProjectActivityLog projectId={project.id} />
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
