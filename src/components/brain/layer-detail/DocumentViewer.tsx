import { useMemo } from "react";
import { FileText, AlertTriangle, Calendar, User, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BrainDocument, BrainDocumentContent } from "@/lib/ai/brainDocuments";
import { BRAIN_MODULE_LABELS } from "@/lib/ai/brainModules";

interface DocumentViewerProps {
  document: BrainDocument | null;
  contentMode: "transformed" | "original";
  searchQuery?: string;
}

export function DocumentViewer({ document, contentMode, searchQuery }: DocumentViewerProps) {
  const label = document ? BRAIN_MODULE_LABELS[document.module] : "";
  const hasWarnings = false; // TODO: Add warnings from AI analysis
  const outlineItems = useMemo(
    () => (document ? buildOutline(document.content_json) : []),
    [document?.content_json],
  );
  const normalizedQuery = searchQuery?.trim() ?? "";

  if (!document) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No content selected</h3>
          <p className="text-muted-foreground text-center">
            Select a version from the list to preview its content.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {document.title || label}
            </CardTitle>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                v{document.version}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(document.updated_at).toLocaleDateString()}
              </span>
              {document.created_by && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {document.created_by.slice(0, 8)}...
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                document.status === "approved"
                  ? "default"
                  : document.status === "pending_approval"
                    ? "secondary"
                    : "outline"
              }
            >
              {document.status === "approved"
                ? "Active"
                : document.status === "pending_approval"
                  ? "Pending"
                  : "Draft"}
            </Badge>
            <Badge variant="secondary">
              {contentMode === "transformed" ? "Transformed" : "Original"}
            </Badge>
            <Badge variant="outline">{document.source}</Badge>
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4">
        {hasWarnings && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              AI analysis generated warnings for this content.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          {outlineItems.length > 0 && (
            <div className="hidden lg:block">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Sections
              </div>
              <ScrollArea className="h-[60vh] pr-3">
                <div className="space-y-1">
                  {outlineItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const target = globalThis.document?.getElementById(item.id);
                        target?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
                      style={{ paddingLeft: `${(item.depth - 1) * 12}px` }}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <ScrollArea className="h-[60vh]">
            <ContentRenderer content={document.content_json} searchQuery={normalizedQuery} />
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

interface ContentRendererProps {
  content: BrainDocumentContent;
  searchQuery: string;
}

function ContentRenderer({ content, searchQuery }: ContentRendererProps) {
  // Check if content looks like markdown/text
  if (typeof content === "string") {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <pre className="whitespace-pre-wrap">
          {renderHighlightedText(content, searchQuery)}
        </pre>
      </div>
    );
  }

  // Render structured JSON content as cards/sections
  return (
    <div className="space-y-6">
      {Object.entries(content).map(([key, value]) => (
        <ContentSection
          key={key}
          title={formatKey(key)}
          content={value}
          path={[key]}
          searchQuery={searchQuery}
        />
      ))}
    </div>
  );
}

interface ContentSectionProps {
  title: string;
  content: unknown;
  path: string[];
  searchQuery: string;
}

function ContentSection({ title, content, path, searchQuery }: ContentSectionProps) {
  if (content === null || content === undefined) {
    return null;
  }

  const sectionId = buildSectionId(path);

  // Handle arrays
  if (Array.isArray(content)) {
    if (content.length === 0) {
      return (
        <div className="space-y-2" id={sectionId}>
          <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
          <p className="text-sm text-muted-foreground italic">No items</p>
        </div>
      );
    }

    // Array of objects (e.g., FAQs, tiers)
    if (typeof content[0] === "object" && content[0] !== null) {
      return (
        <div className="space-y-3" id={sectionId}>
          <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
          <div className="space-y-2">
            {content.map((item, index) => (
              <Card key={index} className="bg-muted/30">
                <CardContent className="py-3 px-4">
                  <div className="space-y-2">
                    {Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                      <div key={k} className="flex flex-col">
                        <span className="text-xs text-muted-foreground">{formatKey(k)}</span>
                        <span className="text-sm">
                          {renderHighlightedText(String(v), searchQuery)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    // Array of strings
    return (
      <div className="space-y-2" id={sectionId}>
        <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
        <div className="flex flex-wrap gap-2">
          {content.map((item, index) => (
            <Badge key={index} variant="secondary">
              {renderHighlightedText(String(item), searchQuery)}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  // Handle nested objects
  if (typeof content === "object") {
    return (
      <div className="space-y-3" id={sectionId}>
        <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4">
            <div className="space-y-3">
              {Object.entries(content as Record<string, unknown>).map(([k, v]) => (
                <ContentSection
                  key={k}
                  title={formatKey(k)}
                  content={v}
                  path={[...path, k]}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle primitives
  return (
    <div className="space-y-1" id={sectionId}>
      <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
      <p className="text-sm">{renderHighlightedText(String(content), searchQuery)}</p>
    </div>
  );
}

interface OutlineItem {
  id: string;
  title: string;
  depth: number;
}

function buildOutline(content: BrainDocumentContent, depth = 1, path: string[] = []): OutlineItem[] {
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    return [];
  }

  const entries = Object.entries(content as Record<string, unknown>);
  return entries.flatMap(([key, value]) => {
    const nextPath = [...path, key];
    const item: OutlineItem = {
      id: buildSectionId(nextPath),
      title: formatKey(key),
      depth,
    };
    if (depth >= 2 || typeof value !== "object" || value === null || Array.isArray(value)) {
      return [item];
    }
    return [item, ...buildOutline(value as BrainDocumentContent, depth + 1, nextPath)];
  });
}

function buildSectionId(path: string[]): string {
  return `section-${path
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function renderHighlightedText(text: string, query: string) {
  if (!query) {
    return text;
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return (
        <mark key={`${part}-${index}`} className="bg-yellow-200/70 text-foreground rounded px-0.5">
          {part}
        </mark>
      );
    }
    return part;
  });
}

/**
 * Format a key into human-readable title
 */
function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (str) => str.toUpperCase());
}
