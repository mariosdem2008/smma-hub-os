import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { BrainDocument, BrainDocumentContent } from "@/lib/ai/brainDocuments";
import type { BrainModule } from "@/lib/ai/brainModules";
import { BRAIN_MODULE_LABELS } from "@/lib/ai/brainModules";

interface LayerInsightsProps {
  module: BrainModule;
  activeDocument: BrainDocument | null;
  documents: BrainDocument[];
}

export function LayerInsights({ module, activeDocument, documents }: LayerInsightsProps) {
  if (!activeDocument) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Insights</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Add a document to see quality and completeness insights.
        </CardContent>
      </Card>
    );
  }

  const label = BRAIN_MODULE_LABELS[module];
  const stats = getContentStats(activeDocument.content_json);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Live Layer</p>
          <p className="font-medium">{label}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">v{activeDocument.version} Active</Badge>
            <Badge variant="outline">{activeDocument.source}</Badge>
          </div>
        </div>

        <Separator />

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Versions</span>
            <span className="font-medium">{documents.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Sections</span>
            <span className="font-medium">{stats.sections}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Fields</span>
            <span className="font-medium">{stats.fields}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Words</span>
            <span className="font-medium">{stats.words}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last Updated</span>
            <span className="font-medium">
              {new Date(activeDocument.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getContentStats(content: BrainDocumentContent) {
  if (typeof content === "string") {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    return { sections: 1, fields: 0, words };
  }

  const keys = countKeys(content);
  const sections = Object.keys(content).length;
  const words = estimateWords(content);
  return { sections, fields: keys, words };
}

function countKeys(content: BrainDocumentContent): number {
  if (typeof content !== "object" || content === null) {
    return 0;
  }
  if (Array.isArray(content)) {
    return content.reduce((sum, item) => sum + countKeys(item as BrainDocumentContent), 0);
  }
  return Object.entries(content).reduce((sum, [_, value]) => sum + 1 + countKeys(value as BrainDocumentContent), 0);
}

function estimateWords(content: BrainDocumentContent): number {
  if (typeof content === "string") {
    return content.trim().split(/\s+/).filter(Boolean).length;
  }
  if (Array.isArray(content)) {
    return content.reduce((sum, item) => sum + estimateWords(item as BrainDocumentContent), 0);
  }
  if (typeof content === "object" && content !== null) {
    return Object.values(content).reduce((sum, value) => sum + estimateWords(value as BrainDocumentContent), 0);
  }
  if (content === null || content === undefined) {
    return 0;
  }
  return String(content).trim().split(/\s+/).filter(Boolean).length;
}
