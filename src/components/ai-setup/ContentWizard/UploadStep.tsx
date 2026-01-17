import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useBrainDocumentUpload } from "@/hooks/useBrainDocumentUpload";
import type { BrainModule } from "@/lib/ai/brainModules";
import { toast } from "sonner";

const ACCEPTED = [".pdf", ".docx", ".md", ".txt"];

function isPreviewable(file: File) {
  const type = file.type;
  return (
    type === "text/plain" ||
    type === "text/markdown" ||
    file.name.toLowerCase().endsWith(".md") ||
    file.name.toLowerCase().endsWith(".txt")
  );
}

export function UploadStep({
  module,
  onDone,
}: {
  module: BrainModule;
  onDone: () => void;
}) {
  const { uploadAndAnalyze, isUploading } = useBrainDocumentUpload();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [previewNote, setPreviewNote] = useState<string | null>(null);

  const acceptAttr = useMemo(() => ACCEPTED.join(","), []);

  const onPickFile = async (next: File | null) => {
    setFile(next);
    setPreview("");
    setPreviewNote(null);
    if (!next) return;

    if (!isPreviewable(next)) {
      setPreviewNote("Preview isn’t available for this file type, but you can still upload it.");
      return;
    }

    try {
      const text = await next.text();
      setPreview(text.slice(0, 12000));
      if (text.length > 12000) setPreviewNote("Preview truncated. Full content will be processed.");
    } catch {
      setPreviewNote("Couldn’t preview this file, but you can still upload it.");
    }
  };

  const onUpload = async () => {
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    try {
      await uploadAndAnalyze({ file, module, mode: "transformed" });
      toast.success("Draft saved");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
        <div className="text-sm text-muted-foreground">
          Accepted: {ACCEPTED.join(", ").toUpperCase()}
        </div>
        <input
          type="file"
          accept={acceptAttr}
          onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
          disabled={isUploading}
        />
      </div>

      {(previewNote || preview) && (
        <div className="rounded-lg border border-border/60 bg-card/40 p-4">
          {previewNote && <div className="text-sm text-muted-foreground mb-2">{previewNote}</div>}
          {preview && <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{preview}</pre>}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={isUploading}>
          Cancel
        </Button>
        <Button onClick={onUpload} disabled={isUploading || !file}>
          Upload & Save Draft →
        </Button>
      </div>
    </div>
  );
}

