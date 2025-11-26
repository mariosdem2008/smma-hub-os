import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Folder, Lightbulb, FileText, Image as ImageIcon } from "lucide-react";

interface Project {
  id: string;
  title: string;
  thumbnail_url: string | null;
  pipeline_stage: string;
  idea_id: string | null;
  script_id: string | null;
  created_at: string;
  asset_count?: number;
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  isDragging?: boolean;
}

export default function ProjectCard({ project, onClick, isDragging }: ProjectCardProps) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-lg transition-all ${
        isDragging ? "opacity-50" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3">
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
  );
}
