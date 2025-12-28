import { useBrainDocumentHistory } from "@/hooks/useBrainDocuments";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Clock, User, FileText } from "lucide-react";

interface BrainVersionHistoryProps {
  documentId: string;
}

export function BrainVersionHistory({ documentId }: BrainVersionHistoryProps) {
  const { data: versions = [], isLoading, error } = useBrainDocumentHistory(documentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Failed to load version history
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No version history available
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4">
        {versions.map((version, index) => (
          <div key={version.id}>
            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
              <div className="flex-shrink-0">
                <Badge variant={index === 0 ? "default" : "secondary"}>
                  v{version.version}
                </Badge>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                {/* Change summary */}
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {version.change_summary || "No description"}
                  </span>
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {new Date(version.created_at).toLocaleDateString()} at{" "}
                    {new Date(version.created_at).toLocaleTimeString()}
                  </span>
                </div>

                {/* Changes preview */}
                {version.diff_json && Object.keys(version.diff_json).length > 0 && (
                  <div className="mt-2 p-2 bg-background rounded border text-xs font-mono">
                    <span className="text-muted-foreground">
                      {Object.keys(version.diff_json).length} field(s) changed
                    </span>
                  </div>
                )}
              </div>
            </div>

            {index < versions.length - 1 && <Separator className="my-2" />}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
