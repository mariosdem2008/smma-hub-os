import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Folder, 
  Lightbulb, 
  FileText, 
  Image as ImageIcon, 
  AlertCircle, 
  Trash2,
  MoreVertical,
  ArrowRight,
  ArrowLeft,
  User
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";

interface AssignedUser {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
}

interface Project {
  id: string;
  title: string;
  thumbnail_url: string | null;
  status: string;
  idea_id: string | null;
  script_id: string | null;
  created_at: string;
  asset_count?: number;
  error_message?: string | null;
  assigned_to?: string | null;
  assigned_user?: AssignedUser | null;
  rejection_reason?: string | null;
}

interface Stage {
  key: string;
  label: string;
  color: string;
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  isDragging?: boolean;
  onDelete?: () => void;
  onSchedule?: () => void;
  onMoveStage?: (projectId: string, newStage: string, rejectionReason?: string) => void;
  stages?: Stage[];
}

export default function ProjectCard({ 
  project, 
  onClick, 
  isDragging, 
  onDelete, 
  onSchedule,
  onMoveStage,
  stages = []
}: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { canDeleteContent, canApproveContent, isOwner, isAdmin, isManager, isCreator } = useRole();

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

  // Get current stage index
  const currentStageIndex = stages.findIndex(s => s.key === project.status);
  const canMoveForward = currentStageIndex < stages.length - 1 && currentStageIndex >= 0;
  const canMoveBack = currentStageIndex > 0;

  // Role-based move permissions
  const canMove = isOwner || isAdmin || isManager || isCreator;
  const canMoveToClientReview = isOwner || isAdmin || isManager;
  const canMoveFromClientReview = isOwner || isAdmin || isManager;

  const getNextStage = () => {
    if (currentStageIndex < stages.length - 1) {
      return stages[currentStageIndex + 1];
    }
    return null;
  };

  const getPrevStage = () => {
    if (currentStageIndex > 0) {
      return stages[currentStageIndex - 1];
    }
    return null;
  };

  const handleMoveToStage = (stageKey: string) => {
    if (onMoveStage) {
      onMoveStage(project.id, stageKey);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
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
          {/* Action Menu */}
          {(canDeleteContent || (canMove && onMoveStage)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {/* Move Forward */}
                {canMove && onMoveStage && canMoveForward && (
                  <DropdownMenuItem
                    onClick={() => {
                      const nextStage = getNextStage();
                      if (nextStage) {
                        // Check if moving to client_review requires permission
                        if (nextStage.key === 'client_review' && !canMoveToClientReview) {
                          toast({
                            title: "Permission denied",
                            description: "Only managers can send to client review",
                            variant: "destructive"
                          });
                          return;
                        }
                        handleMoveToStage(nextStage.key);
                      }
                    }}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Move to {getNextStage()?.label}
                  </DropdownMenuItem>
                )}

                {/* Move Back */}
                {canMove && onMoveStage && canMoveBack && (
                  <DropdownMenuItem
                    onClick={() => {
                      const prevStage = getPrevStage();
                      if (prevStage) {
                        // Check if moving from client_review requires permission
                        if (project.status === 'client_review' && !canMoveFromClientReview) {
                          toast({
                            title: "Permission denied",
                            description: "Only managers can move from client review",
                            variant: "destructive"
                          });
                          return;
                        }
                        handleMoveToStage(prevStage.key);
                      }
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Send back to {getPrevStage()?.label}
                  </DropdownMenuItem>
                )}

                {/* Move to specific stage */}
                {canMove && onMoveStage && stages.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      Move to stage...
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {stages.map(stage => (
                        <DropdownMenuItem
                          key={stage.key}
                          disabled={stage.key === project.status}
                          onClick={() => handleMoveToStage(stage.key)}
                        >
                          <div 
                            className="w-2 h-2 rounded-full mr-2"
                            style={{ backgroundColor: `hsl(${stage.color})` }}
                          />
                          {stage.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}

                {(canMove && onMoveStage && canDeleteContent) && <DropdownMenuSeparator />}

                {/* Delete */}
                {canDeleteContent && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Project
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="space-y-3">
            {/* Thumbnail */}
            <div className="aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center relative">
              {project.thumbnail_url ? (
                <img
                  src={project.thumbnail_url}
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Folder className="h-8 w-8 text-muted-foreground" />
              )}
              
              {/* Assigned User Avatar */}
              {project.assigned_user && (
                <div className="absolute bottom-2 left-2">
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {getInitials(project.assigned_user.full_name, project.assigned_user.email)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>

            {/* Title & Assigned */}
            <div>
              <h4 className="font-medium text-sm line-clamp-2">{project.title}</h4>
              {project.assigned_user && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <User className="h-3 w-3" />
                  {project.assigned_user.full_name || project.assigned_user.email}
                </p>
              )}
            </div>

            {/* Rejection Reason */}
            {project.status === 'client_review' && project.rejection_reason && (
              <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs line-clamp-2">{project.rejection_reason}</p>
              </div>
            )}

            {/* Error Message */}
            {project.status === 'failed' && project.error_message && (
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

            {/* Schedule Button for Approved Projects */}
            {project.status === 'approved' && onSchedule && (
              <Button
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onSchedule();
                }}
              >
                Schedule Post
              </Button>
            )}
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
