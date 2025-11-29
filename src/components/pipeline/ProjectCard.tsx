import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Folder, Lightbulb, FileText, Image as ImageIcon, AlertCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";

interface Project {
  id: string;
  title: string;
  thumbnail_url: string | null;
  pipeline_stage: string;
  idea_id: string | null;
  script_id: string | null;
  created_at: string;
  asset_count?: number;
  error_message?: string | null;
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  isDragging?: boolean;
  onDelete?: () => void;
}

export default function ProjectCard({ project, onClick, isDragging, onDelete }: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { canDeleteContent } = useRole();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);

    try {
      const { error } = await supabase.rpc('delete_project_cascade', {
        p_project_id: project.id
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project deleted successfully",
      });

      setShowDeleteDialog(false);
      if (onDelete) onDelete();
    } catch (error: any) {
      console.error("Error deleting project:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card
        className={`cursor-pointer hover:shadow-lg transition-all group relative ${
          isDragging ? "opacity-50" : ""
        }`}
        onClick={onClick}
      >
        <CardContent className="p-3">
          {canDeleteContent && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground z-10"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}

          <div className="space-y-3">
            {/* Thumbnail */}
            <div className="aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              {project.thumbnail_url ? (
                <img
                  src={project.thumbnail_url}
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Folder className="h-8 w-8 text-muted-foreground" />
              )}
            </div>

            {/* Title */}
            <div>
              <h4 className="font-medium text-sm line-clamp-2">{project.title}</h4>
            </div>

            {/* Error Message */}
            {project.pipeline_stage === 'failed' && project.error_message && (
              <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs line-clamp-2">{project.error_message}</p>
              </div>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {project.idea_id && (
                <Badge variant="outline" className="text-xs">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  Idea
                </Badge>
              )}
              {project.script_id && (
                <Badge variant="outline" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Script
                </Badge>
              )}
              {project.asset_count !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  <ImageIcon className="h-3 w-3 mr-1" />
                  {project.asset_count}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project.title}"? This will permanently delete the project and all assets that are not used by other projects or stored in the library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
