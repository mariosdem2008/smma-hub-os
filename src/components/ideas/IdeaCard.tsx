import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Tag } from "lucide-react";

interface Idea {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  status: string;
  created_at: string;
}

interface IdeaCardProps {
  idea: Idea;
  onClick: () => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-500",
  in_review: "bg-blue-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
};

export default function IdeaCard({ idea, onClick }: IdeaCardProps) {
  const truncate = (text: string | null, length: number) => {
    if (!text) return "";
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg mb-1">{idea.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {new Date(idea.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={statusColors[idea.status] || "bg-gray-500"}
          >
            {idea.status.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {idea.description && (
          <p className="text-sm text-muted-foreground">
            {truncate(idea.description, 150)}
          </p>
        )}

        {idea.tags && idea.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {idea.tags.slice(0, 3).map((tag, index) => (
              <div
                key={index}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs"
              >
                <Tag className="h-3 w-3" />
                {tag}
              </div>
            ))}
            {idea.tags.length > 3 && (
              <div className="px-2 py-1 rounded-md bg-muted text-xs">
                +{idea.tags.length - 3} more
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground pt-2 border-t">
          Click to expand and edit
        </p>
      </CardContent>
    </Card>
  );
}
