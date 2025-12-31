import { useId, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  files?: File[];
  onFilesSelected: (files: File[]) => void;
  onClearFiles?: () => void;
  accept?: string;
  acceptLabel?: string;
  multiple?: boolean;
  uploading?: boolean;
  disabled?: boolean;
  helperText?: string;
  browseLabel?: string;
  description?: string;
  className?: string;
}

const getFilesLabel = (files: File[]) => {
  if (files.length === 1) return files[0].name;
  return `${files.length} files selected`;
};

const getFilesList = (files: File[]) => {
  const names = files.slice(0, 3).map((file) => file.name);
  if (files.length > 3) return `${names.join(", ")} +${files.length - 3} more`;
  return names.join(", ");
};

export function UploadDropzone({
  files = [],
  onFilesSelected,
  onClearFiles,
  accept,
  acceptLabel,
  multiple = false,
  uploading = false,
  disabled = false,
  helperText,
  browseLabel = "Select file",
  description = "Drag & drop your file here, or click to browse",
  className,
}: UploadDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const hasFiles = files.length > 0;
  const isDisabled = disabled || uploading;

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (!isDisabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (isDisabled) return;

    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length === 0) return;
    onFilesSelected(multiple ? droppedFiles : [droppedFiles[0]]);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;
    onFilesSelected(multiple ? selectedFiles : [selectedFiles[0]]);
    event.target.value = "";
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        isDisabled && "opacity-60 pointer-events-none",
        className,
      )}
    >
      {hasFiles ? (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <span className="font-medium">{getFilesLabel(files)}</span>
            {onClearFiles && (
              <Button variant="ghost" size="sm" onClick={onClearFiles} aria-label="Clear selected files">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{getFilesList(files)}</p>
          {uploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{description}</p>
          <Input
            type="file"
            id={inputId}
            ref={inputRef}
            onChange={handleInputChange}
            className="hidden"
            accept={accept}
            multiple={multiple}
            disabled={isDisabled}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isDisabled}
          >
            {uploading ? "Uploading..." : browseLabel}
          </Button>
        </div>
      )}
      {(helperText || acceptLabel) && (
        <p className="text-xs text-muted-foreground mt-2">
          {[helperText, acceptLabel].filter(Boolean).join(" ")}
        </p>
      )}
    </div>
  );
}
