import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, User, Clock, Folder, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: string;
  title: string;
  client_id: string;
  agency_id: string;
  status: string;
  thumbnail_url: string | null;
  notes: string | null;
  editor_comments: string | null;
  platforms: string[];
  scheduled_time: string | null;
  rejection_reason: string | null;
  rejection_category: string | null;
  created_at?: string;
  assigned_user?: {
    full_name: string | null;
    email: string;
  } | null;
}

const REJECTION_CATEGORY_LABELS: Record<string, string> = {
  wrong_tone: "Wrong Tone",
  wrong_branding: "Wrong Branding",
  incorrect_dimensions: "Incorrect Dimensions",
  typo_or_mistake: "Typo or Mistake",
  request_change: "Request Change",
  want_different_style: "Want Different Style",
  need_different_clip: "Need Different Clip",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idea: { label: "Idea", color: "220 70% 50%" },
  script_copy: { label: "Script/Copy", color: "250 70% 50%" },
  raw_assets: { label: "Raw Assets", color: "280 70% 50%" },
  editing: { label: "Editing", color: "310 70% 50%" },
  internal_review: { label: "Internal Review", color: "30 70% 50%" },
  client_review: { label: "Client Review", color: "35 70% 50%" },
  approved: { label: "Approved", color: "150 70% 50%" },
  scheduled: { label: "Scheduled", color: "200 70% 50%" },
  published: { label: "Published", color: "120 70% 50%" },
};

interface ProjectOverviewTabProps {
  project: Project;
}

export default function ProjectOverviewTab({ project }: ProjectOverviewTabProps) {
  const statusInfo = STATUS_LABELS[project.status] || { label: project.status, color: "0 0% 50%" };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="p-4 space-y-4">
      {/* Status & Thumbnail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              style={{
                backgroundColor: `hsl(${statusInfo.color} / 0.15)`,
                color: `hsl(${statusInfo.color})`,
              }}
              className="text-sm"
            >
              {statusInfo.label}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Thumbnail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full max-w-[200px] rounded-lg overflow-hidden bg-muted flex items-center justify-center">
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
          </CardContent>
        </Card>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Assigned To
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.assigned_user ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {getInitials(project.assigned_user.full_name, project.assigned_user.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {project.assigned_user.full_name || project.assigned_user.email}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Unassigned</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Platforms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {project.platforms && project.platforms.length > 0 ? (
                project.platforms.map(p => (
                  <Badge key={p} variant="outline" className="text-xs">
                    {p}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No platforms</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.scheduled_time ? (
              <span className="text-sm">
                {format(new Date(project.scheduled_time), "MMM d, yyyy 'at' h:mm a")}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Not scheduled</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rejection Alert */}
      {(project.rejection_reason || project.rejection_category) && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Client Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.rejection_category && (
              <Badge variant="outline" className="text-xs mb-2 border-amber-500/50">
                {REJECTION_CATEGORY_LABELS[project.rejection_category] || project.rejection_category}
              </Badge>
            )}
            {project.rejection_reason && (
              <p className="text-sm text-muted-foreground">{project.rejection_reason}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes & Editor Comments */}
      {(project.notes || project.editor_comments) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {project.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.notes}</p>
              </CardContent>
            </Card>
          )}
          {project.editor_comments && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Editor Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.editor_comments}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
