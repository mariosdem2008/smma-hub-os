import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Draggable } from "@hello-pangea/dnd";
import ProjectCard from "./ProjectCard";

interface Project {
  id: string;
  title: string;
  client_id: string;
  agency_id: string;
  pipeline_stage: string;
  thumbnail_url: string | null;
  idea_id: string | null;
  script_id: string | null;
  created_at: string;
  asset_count?: number;
}

interface StageDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: { key: string; label: string; color: string } | null;
  projects: Project[];
  onProjectClick: (projectId: string) => void;
}

export default function StageDetailModal({
  open,
  onOpenChange,
  stage,
  projects,
  onProjectClick,
}: StageDetailModalProps) {
  if (!stage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
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
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          {projects.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No projects in this stage
            </div>
          ) : (
            projects.map((project, index) => (
              <div key={project.id} onClick={() => onProjectClick(project.id)}>
                <ProjectCard project={project} onClick={() => {}} isDragging={false} />
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
