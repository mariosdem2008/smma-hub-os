import { Button } from "@/components/ui/button";

export function MethodStep({
  onPick,
}: {
  onPick: (method: "template" | "upload" | "write") => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-card/40 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-foreground font-medium">Use our template</div>
            <div className="text-sm text-muted-foreground">Recommended starting point</div>
          </div>
          <Button onClick={() => onPick("template")}>Start with Template →</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          className="rounded-lg border border-border/60 bg-card/40 p-4 text-left hover:bg-card/60 transition"
          onClick={() => onPick("upload")}
        >
          <div className="text-foreground font-medium">Upload a document</div>
          <div className="text-sm text-muted-foreground mt-1">PDF, DOCX, MD, or TXT</div>
        </button>
        <button
          type="button"
          className="rounded-lg border border-border/60 bg-card/40 p-4 text-left hover:bg-card/60 transition"
          onClick={() => onPick("write")}
        >
          <div className="text-foreground font-medium">Write from scratch</div>
          <div className="text-sm text-muted-foreground mt-1">Paste or type your content</div>
        </button>
      </div>
    </div>
  );
}

