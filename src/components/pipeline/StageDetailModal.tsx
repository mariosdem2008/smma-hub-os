import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";
import ProjectCard from "./ProjectCard";
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
  client_id: string;
  agency_id: string;
  status: string;
  thumbnail_url: string | null;
  idea_id: string | null;
  script_id: string | null;
  created_at: string;
  asset_count?: number;
  assigned_to?: string | null;
  assigned_user?: AssignedUser | null;
  rejection_reason?: string | null;
}

interface Stage {
  key: string;
  label: string;
  color: string;
}

interface StageDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: Stage | null;
  projects: Project[];
  onProjectClick: (projectId: string) => void;
  onScheduleClick?: (projectId: string) => void;
  onMoveStage?: (projectId: string, newStage: string, rejectionReason?: string) => void;
  onBulkApprove?: () => void;
  stages?: Stage[];
}

export default function StageDetailModal({
  open,
  onOpenChange,
  stage,
  projects,
  onProjectClick,
  onScheduleClick,
  onMoveStage,
  onBulkApprove,
  stages = [],
}: StageDetailModalProps) {
  const { isOwner, isAdmin, isManager } = useRole();
  
  if (!stage) return null;

  const canBulkApprove = (isOwner || isAdmin || isManager) && 
    stage.key === 'client_review' && 
    projects.length > 0 &&
    onBulkApprove;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-2xl">{stage.label}</DialogTitle>
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: `hsl(${stage.color} / 0.1)`,
                  color: `hsl(${stage.color})`,
                }}
              >
                {projects.length} {projects.length === 1 ? "project" : "projects"}
              </Badge>
            </div>
            
            {canBulkApprove && (
              <Button onClick={onBulkApprove} variant="default">
                <CheckCheck className="h-4 w-4 mr-2" />
                Approve All ({projects.length})
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          {projects.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No projects in this stage
            </div>
          ) : (
            projects.map((project) => (
              <div key={project.id} onClick={() => onProjectClick(project.id)}>
                <ProjectCard 
                  project={project} 
                  onClick={() => {}} 
                  isDragging={false}
                  onDelete={() => {
                    onOpenChange(false);
                  }}
                  onSchedule={
                    project.status === 'approved' && onScheduleClick
                      ? () => onScheduleClick(project.id)
                      : undefined
                  }
                  onMoveStage={onMoveStage}
                  stages={stages}
                />
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
