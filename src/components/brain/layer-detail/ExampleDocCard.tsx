import { useState } from "react";
import { FileText, ChevronDown, X, ExternalLink, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAgencyData } from "@/hooks/useAgencyData";
import type { BrainModule } from "@/lib/ai/brainModules";
import { BRAIN_MODULE_LABELS } from "@/lib/ai/brainModules";
import { getExampleContent, getExamplePreview } from "@/lib/brain/examples";
import { renderTemplate } from "@/brain/defaultPackV1";

interface ExampleDocCardProps {
  module: BrainModule;
  expanded: boolean;
  onToggle?: () => void;
  embedded?: boolean;
}

/**
 * Markdown renderer component with proper styling
 */
function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Style tables nicely
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted/50">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-border px-3 py-2 text-left font-medium">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-3 py-2">{children}</td>
        ),
        // Style code blocks
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className={`block bg-muted p-3 rounded-lg text-sm font-mono overflow-x-auto ${className}`} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-4">{children}</pre>
        ),
        // Style headings with proper hierarchy
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mt-6 mb-4 pb-2 border-b">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold mt-5 mb-3 text-primary">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold mt-4 mb-2">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-semibold mt-3 mb-2">{children}</h4>
        ),
        // Style lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm">{children}</li>
        ),
        // Style blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-3 italic bg-muted/30 rounded-r">
            {children}
          </blockquote>
        ),
        // Style horizontal rules
        hr: () => (
          <hr className="my-6 border-border" />
        ),
        // Style paragraphs
        p: ({ children }) => (
          <p className="text-sm my-2 leading-relaxed">{children}</p>
        ),
        // Style strong/bold
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
      }}
    >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ExampleDocCard({ module, expanded, onToggle, embedded = false }: ExampleDocCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { agency } = useAgencyData();

  const exampleContent = getExampleContent(module);
  const previewContent = getExamplePreview(module, 15);
  const label = BRAIN_MODULE_LABELS[module];

  const agencyFields = {
    agency_name: agency?.name ?? "{{agency_name}}",
    agency_website: agency?.website ?? "{{agency_website}}",
    agency_niche: agency?.niche ?? "{{agency_niche}}",
  };

  const renderedExampleContent = renderTemplate(exampleContent, agencyFields);
  const renderedPreviewContent = renderTemplate(previewContent, agencyFields);

  const handleCopy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(renderedExampleContent);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Example structure copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (embedded) {
    // Full view for mobile sheets
    return (
      <div className="relative rounded-lg border bg-background">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Example Structure</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Example
              </>
            )}
          </Button>
        </div>
        <div className="p-4">
          <MarkdownContent content={renderedExampleContent} />
        </div>
      </div>
    );
  }

  if (expanded) {
    // Expanded inspector view
    return (
      <Card className="w-[420px] shadow-lg border-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Example Structure</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Badge variant="secondary" className="mb-3">{label}</Badge>
          <ScrollArea className="h-[500px] pr-4">
            <MarkdownContent content={renderedExampleContent} />
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  // Minimized card view
  return (
    <Card
      className="w-72 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onToggle}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Example structure</CardTitle>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded max-h-24 overflow-hidden">
          <MarkdownContent content={renderedPreviewContent} className="prose-xs [&_h1]:text-sm [&_h2]:text-xs [&_p]:text-xs [&_li]:text-xs" />
        </div>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Click to expand
        </p>
      </CardContent>
    </Card>
  );
}
