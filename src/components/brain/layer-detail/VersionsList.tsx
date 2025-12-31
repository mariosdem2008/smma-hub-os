import {
  Clock,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Eye,
  Upload,
  Settings,
  Sparkles,
  FileText,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { BrainDocument } from "@/lib/ai/brainDocuments";

interface VersionsListProps {
  documents: BrainDocument[];
  activeDocumentId: string | null;
  selectedVersionId: string | null;
  onSelectVersion: (id: string | null) => void;
  onSetActive: (id: string) => Promise<void>;
  compareVersionId?: string | null;
  onCompareSelect?: (id: string | null) => void;
  onDelete?: (id: string) => void;
  expanded: boolean;
  onToggle?: () => void;
  embedded?: boolean;
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  upload_ai: Upload,
  manual: Settings,
  ai_proposed: Sparkles,
  onboarding: FileText,
  chat: Sparkles,
};

const SOURCE_LABELS: Record<string, string> = {
  upload_ai: "Upload + AI",
  manual: "Manual",
  ai_proposed: "AI Proposed",
  onboarding: "Onboarding",
  chat: "Chat",
};

export function VersionsList({
  documents,
  activeDocumentId,
  selectedVersionId,
  onSelectVersion,
  onSetActive,
  compareVersionId,
  onCompareSelect,
  onDelete,
  expanded,
  onToggle,
  embedded = false,
}: VersionsListProps) {
  // Sort documents by version descending
  const sortedDocs = [...documents].sort((a, b) => b.version - a.version);

  if (embedded) {
    // Full list for mobile sheets
    return (
      <div className="space-y-2">
        {sortedDocs.map((doc) => (
          <VersionItem
            key={doc.id}
            document={doc}
            isActive={doc.id === activeDocumentId}
            isSelected={doc.id === selectedVersionId}
            isCompared={doc.id === compareVersionId}
            onSelect={() => onSelectVersion(doc.id)}
            onSetActive={() => onSetActive(doc.id)}
            onCompare={onCompareSelect ? () => onCompareSelect(doc.id) : undefined}
            onDelete={onDelete ? () => onDelete(doc.id) : undefined}
          />
        ))}
      </div>
    );
  }

  if (expanded) {
    // Expanded panel view
    return (
      <Card className="w-80 shadow-lg border-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">
              Version History ({documents.length})
            </CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {sortedDocs.map((doc) => (
                <VersionItem
                  key={doc.id}
                  document={doc}
                  isActive={doc.id === activeDocumentId}
                  isSelected={doc.id === selectedVersionId}
                  isCompared={doc.id === compareVersionId}
                  onSelect={() => onSelectVersion(doc.id)}
                  onSetActive={() => onSetActive(doc.id)}
                  onCompare={onCompareSelect ? () => onCompareSelect(doc.id) : undefined}
                  onDelete={onDelete ? () => onDelete(doc.id) : undefined}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  // Minimized card view
  const activeDoc = documents.find((d) => d.id === activeDocumentId);

  return (
    <Card
      className="w-64 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onToggle}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">
            {documents.length} Version{documents.length !== 1 ? "s" : ""}
          </CardTitle>
        </div>
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-0">
        {activeDoc && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="default" className="text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              v{activeDoc.version} Active
            </Badge>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Click to view all versions
        </p>
      </CardContent>
    </Card>
  );
}

interface VersionItemProps {
  document: BrainDocument;
  isActive: boolean;
  isSelected: boolean;
  isCompared: boolean;
  onSelect: () => void;
  onSetActive: () => void;
  onCompare?: () => void;
  onDelete?: () => void;
}

function VersionItem({
  document,
  isActive,
  isSelected,
  isCompared,
  onSelect,
  onSetActive,
  onCompare,
  onDelete,
}: VersionItemProps) {
  const SourceIcon = SOURCE_ICONS[document.source] ?? FileText;
  const sourceLabel = SOURCE_LABELS[document.source] ?? document.source;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-colors",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/50",
        isActive && "ring-2 ring-primary/20",
        isCompared && "border-emerald-500/60 bg-emerald-500/5"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">v{document.version}</span>
            {isActive && (
              <Badge variant="default" className="text-xs h-5">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
            {isCompared && (
              <Badge variant="secondary" className="text-xs h-5">
                Comparing
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs h-5">
              <SourceIcon className="h-3 w-3 mr-1" />
              {sourceLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(document.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            title="Preview"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {onCompare && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onCompare();
              }}
            >
              Compare
            </Button>
          )}
          {!isActive && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete version"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {!isActive && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onSetActive();
              }}
              title="Set as Active"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
