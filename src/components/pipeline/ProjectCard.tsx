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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  User,
  Check,
  MessageSquare
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { logActivity } from "@/hooks/useActivityLog";

const REJECTION_CATEGORY_LABELS: Record<string, string> = {
  wrong_tone: "Wrong Tone",
  wrong_branding: "Wrong Branding",
  incorrect_dimensions: "Incorrect Dimensions",
  typo_or_mistake: "Typo or Mistake",
  request_change: "Request Change",
  want_different_style: "Want Different Style",
  need_different_clip: "Need Different Clip",
};

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
  comment_count?: number;
  external_comment_count?: number;
  error_message?: string | null;
  assigned_to?: string | null;
  assigned_user?: AssignedUser | null;
  rejection_reason?: string | null;
  rejection_category?: string | null;
  agency_id: string;
}

interface AgencyMember {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
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
  onAssignmentChange?: () => void;
  stages?: Stage[];
}

export default function ProjectCard({ 
  project, 
  onClick, 
  isDragging, 
  onDelete, 
  onSchedule,
  onMoveStage,
  onAssignmentChange,
  stages = []
}: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAssignPopover, setShowAssignPopover] = useState(false);
  const [agencyMembers, setAgencyMembers] = useState<AgencyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();
  const { canDeleteContent, isOwner, isAdmin, isManager, isCreator } = useRole();

  // Fetch agency members when popover opens
  useEffect(() => {
    if (showAssignPopover && agencyMembers.length === 0) {
      fetchAgencyMembers();
    }
  }, [showAssignPopover]);

  const fetchAgencyMembers = async () => {
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from("agency_members")
        .select(`
          id,
          user_id,
          profiles!inner(full_name, email)
        `)
        .eq("agency_id", project.agency_id);

      if (error) throw error;

      const members = (data || []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        full_name: m.profiles?.full_name || null,
        email: m.profiles?.email || "",
      }));
      setAgencyMembers(members);
    } catch (error) {
      console.error("Error fetching agency members:", error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAssignMember = async (memberId: string) => {
    setAssigning(true);
    try {
      const previousAssignee = project.assigned_to;
      
      const { error } = await supabase
        .from("projects")
        .update({ assigned_to: memberId })
        .eq("id", project.id);

      if (error) throw error;

      // Log activity
      await logActivity({
        projectId: project.id,
        actionType: "assigned_to_changed",
        details: {
          previous_assignee: previousAssignee,
          new_assignee: memberId,
        },
      });

      // Create notification for new assignee
      const member = agencyMembers.find(m => m.id === memberId);
      if (member) {
        await supabase.from("notifications").insert({
          agency_id: project.agency_id,
          user_type: "agency_member",
          user_id: member.user_id,
          type: "assignment",
          payload: {
            project_id: project.id,
            project_title: project.title,
            message: `You've been assigned to "${project.title}"`,
          },
        });
      }

      toast({
        title: "Assignment updated",
        description: member ? `Assigned to ${member.full_name || member.email}` : "Assignment updated",
      });

      setShowAssignPopover(false);
      if (onAssignmentChange) onAssignmentChange();
    } catch (error: any) {
      console.error("Error assigning member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign member",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

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
              
              {/* Assigned User Avatar - Clickable */}
              <Popover open={showAssignPopover} onOpenChange={setShowAssignPopover}>
                <PopoverTrigger asChild>
                  <button
                    className="absolute bottom-2 left-2 hover:scale-110 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAssignPopover(true);
                    }}
                  >
                    <Avatar className="h-6 w-6 border-2 border-background cursor-pointer">
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {project.assigned_user
                          ? getInitials(project.assigned_user.full_name, project.assigned_user.email)
                          : "?"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-56 p-2" 
                  align="start"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                    Assign to
                  </div>
                  {loadingMembers ? (
                    <div className="text-xs text-muted-foreground px-2 py-2">Loading...</div>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {agencyMembers.map((member) => (
                        <button
                          key={member.id}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left text-sm disabled:opacity-50"
                          onClick={() => handleAssignMember(member.id)}
                          disabled={assigning}
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-xs">
                              {getInitials(member.full_name, member.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate flex-1">
                            {member.full_name || member.email}
                          </span>
                          {project.assigned_to === member.id && (
                            <Check className="h-3 w-3 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
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
            {(project.rejection_reason || project.rejection_category) && (
              <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  {project.rejection_category && (
                    <Badge variant="outline" className="text-xs mb-1 border-amber-500/50">
                      {REJECTION_CATEGORY_LABELS[project.rejection_category] || project.rejection_category}
                    </Badge>
                  )}
                  {project.rejection_reason && (
                    <p className="line-clamp-2">{project.rejection_reason}</p>
                  )}
                </div>
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
              {project.asset_count !== undefined && project.asset_count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <ImageIcon className="h-3 w-3 mr-1" />
                  {project.asset_count}
                </Badge>
              )}
              {project.comment_count !== undefined && project.comment_count > 0 && (
                <Badge 
                  variant={project.external_comment_count && project.external_comment_count > 0 ? "default" : "outline"} 
                  className={`text-xs ${project.external_comment_count && project.external_comment_count > 0 ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30' : ''}`}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {project.comment_count}
                  {project.external_comment_count && project.external_comment_count > 0 && (
                    <span className="ml-1 text-[10px] font-bold">•</span>
                  )}
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
