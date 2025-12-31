import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  File,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { BrainModule } from "@/lib/ai/brainModules";
import { BRAIN_MODULE_LABELS } from "@/lib/ai/brainModules";
import { getExampleContent } from "@/lib/brain/examples";
import { useBrainDocumentUpload } from "@/hooks/useBrainDocumentUpload";

interface DocumentUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: BrainModule;
}

type UploadState = "idle" | "uploading" | "analyzing" | "complete" | "error";

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/markdown": [".md"],
  "text/plain": [".txt"],
};

const FILE_TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  docx: File,
  md: FileText,
  txt: FileText,
};

export function DocumentUploadModal({
  open,
  onOpenChange,
  module,
}: DocumentUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [outputMode, setOutputMode] = useState<"transformed" | "original">("transformed");
  const [error, setError] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [fileNotice, setFileNotice] = useState<string | null>(null);

  const { uploadAndAnalyze } = useBrainDocumentUpload();

  const label = BRAIN_MODULE_LABELS[module];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      void handleFileSelected(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
    onDropRejected: (rejections) => {
      const rejection = rejections[0];
      if (rejection.errors[0]?.code === "file-too-large") {
        setError("File is too large. Maximum size is 20MB.");
      } else if (rejection.errors[0]?.code === "file-invalid-type") {
        setError("Invalid file type. Please upload PDF, DOCX, MD, or TXT.");
      } else {
        setError("Could not accept this file.");
      }
    },
  });

  const handleUpload = async () => {
    const trimmedContent = editorContent.trim();
    const fileToUpload =
      trimmedContent.length > 0
        ? new File([trimmedContent], file?.name ?? `${label}.txt`, { type: "text/plain" })
        : file;

    if (!fileToUpload) {
      setError("Add content or upload a document to continue.");
      return;
    }

    try {
      setUploadState("uploading");
      setProgress(20);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 50));
      }, 200);

      setUploadState("analyzing");
      setProgress(60);

      // Call the upload and analyze function
      await uploadAndAnalyze({
        file: fileToUpload,
        module,
        mode: outputMode,
        onProgress: (p) => setProgress(60 + p * 0.4),
      });

      clearInterval(progressInterval);
      setProgress(100);
      setUploadState("complete");

      toast.success("Document uploaded and analyzed successfully!");

      // Close after brief delay
      setTimeout(() => {
        onOpenChange(false);
        resetState();
      }, 1500);
    } catch (err) {
      setUploadState("error");
      setError(err instanceof Error ? err.message : "Failed to process document");
      toast.error("Failed to process document");
    }
  };

  const resetState = () => {
    setFile(null);
    setUploadState("idle");
    setProgress(0);
    setError(null);
    setOutputMode("transformed");
    setEditorContent("");
    setFileNotice(null);
  };

  const handleClose = () => {
    if (uploadState === "uploading" || uploadState === "analyzing") {
      toast.info("Please wait for the upload to complete");
      return;
    }
    onOpenChange(false);
    resetState();
  };

  const getFileExtension = (filename: string): string => {
    return filename.split(".").pop()?.toLowerCase() ?? "";
  };

  const FileIcon = file ? FILE_TYPE_ICONS[getFileExtension(file.name)] ?? File : File;

  const handleFileSelected = async (nextFile: File) => {
    setFile(nextFile);
    setError(null);
    setFileNotice(null);

    try {
      const text = await readFileAsText(nextFile);
      setEditorContent(text);
      if (!isPlainTextFile(nextFile)) {
        setFileNotice("Preview is best effort for this file type. Review before uploading.");
      }
    } catch {
      setFileNotice("Could not preview this file. You can still upload it.");
    }
  };

  const handleInsertExample = () => {
    setEditorContent(getExampleContent(module));
    setFile(null);
    setFileNotice(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload or Write Document for {label}</DialogTitle>
          <DialogDescription>
            Paste, write, or import a document. You can edit everything before uploading.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {uploadState === "idle" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">PDF</Badge>
                  <Badge variant="outline">DOCX</Badge>
                  <Badge variant="outline">MD</Badge>
                  <Badge variant="outline">TXT</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleInsertExample}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Insert Example
                  </Button>
                  <div {...getRootProps()}>
                    <input {...getInputProps()} />
                    <Button variant="outline" size="sm" type="button">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </Button>
                  </div>
                </div>
              </div>

              {file && (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setFileNotice(null);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Document Editor</p>
                  <p className="text-xs text-muted-foreground">
                    {editorContent.trim().length} characters
                  </p>
                </div>
                <Textarea
                  value={editorContent}
                  onChange={(event) => setEditorContent(event.target.value)}
                  placeholder="Paste or write your document here..."
                  className="min-h-[220px]"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {fileNotice && (
                <Alert>
                  <AlertDescription>{fileNotice}</AlertDescription>
                </Alert>
              )}

              {/* Output mode selection */}
              {(file || editorContent.trim().length > 0) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Output Format</p>
                  <Tabs value={outputMode} onValueChange={(v) => setOutputMode(v as typeof outputMode)}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="transformed">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Transform to Structure
                      </TabsTrigger>
                      <TabsTrigger value="original">
                        <FileText className="h-4 w-4 mr-2" />
                        Keep Original
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="text-xs text-muted-foreground">
                    {outputMode === "transformed"
                      ? "AI will restructure your content to match our recommended format."
                      : "Your document will be stored as-is without transformation."}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Upload progress */}
          {(uploadState === "uploading" || uploadState === "analyzing") && (
            <div className="space-y-4 py-8">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <div className="text-center">
                  <p className="font-medium">
                    {uploadState === "uploading" ? "Uploading document..." : "Analyzing content..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {uploadState === "analyzing" && "AI is extracting and transforming content"}
                  </p>
                </div>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Complete state */}
          {uploadState === "complete" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="font-medium text-green-600">Upload Complete!</p>
              <p className="text-sm text-muted-foreground">
                Your document has been processed and saved.
              </p>
            </div>
          )}

          {/* Error state */}
          {uploadState === "error" && (
            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button variant="outline" onClick={resetState} className="w-full">
                Try Again
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          {uploadState === "idle" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!file && editorContent.trim().length === 0}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isPlainTextFile(file: File) {
  return file.type.startsWith("text/");
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
