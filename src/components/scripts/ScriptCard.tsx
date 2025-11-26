import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Edit, Trash2, Link as LinkIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Script {
  id: string;
  title: string;
  hook: string | null;
  script_body: string | null;
  cta: string | null;
  editor_notes: string | null;
  idea_id: string | null;
  status: string;
  created_at: string;
}

interface Idea {
  id: string;
  title: string;
}

interface ScriptCardProps {
  script: Script;
  linkedIdea?: Idea;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ScriptCard({ script, linkedIdea, onEdit, onDelete }: ScriptCardProps) {
  const truncate = (text: string | null, length: number) => {
    if (!text) return "";
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  return (
    <Card className="hover:shadow-lg transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg mb-1">{script.title}</CardTitle>
              {linkedIdea && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span className="truncate">{linkedIdea.title}</span>
                </div>
              )}
            </div>
          </div>
          <Badge variant="secondary">{script.status}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {script.hook && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Hook</p>
            <p className="text-sm">{truncate(script.hook, 120)}</p>
          </div>
        )}

        {script.script_body && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Script</p>
            <p className="text-sm text-muted-foreground">{truncate(script.script_body, 150)}</p>
          </div>
        )}

        {script.cta && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">CTA</p>
            <p className="text-sm">{truncate(script.cta, 80)}</p>
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onEdit}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Script</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{script.title}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
