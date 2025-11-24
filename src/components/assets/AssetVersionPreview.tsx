import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Image as ImageIcon, Video, File } from "lucide-react";

interface AssetVersion {
  id: string;
  version_number: number;
  file_url: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface AssetVersionPreviewProps {
  version: AssetVersion;
  onClose: () => void;
}

export function AssetVersionPreview({ version, onClose }: AssetVersionPreviewProps) {
  const fileType = version.file_url.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileType);
  const isVideo = ['mp4', 'mov', 'avi', 'webm'].includes(fileType);
  const isPdf = fileType === 'pdf';

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              Version {version.version_number} Preview
              <Badge variant="outline">
                {format(new Date(version.created_at), 'MMM d, yyyy')}
              </Badge>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Info */}
          <div className="bg-muted p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Version:</span>
                <span className="ml-2 font-medium">v{version.version_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Size:</span>
                <span className="ml-2 font-medium">{formatFileSize(version.file_size)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 font-medium uppercase">{fileType}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Uploaded:</span>
                <span className="ml-2 font-medium">
                  {format(new Date(version.created_at), 'MMM d, yyyy • h:mm a')}
                </span>
              </div>
            </div>
          </div>

          {/* File Preview */}
          <div className="bg-muted/50 rounded-lg p-8 flex items-center justify-center min-h-[400px]">
            {isImage ? (
              <img
                src={version.file_url}
                alt={`Version ${version.version_number}`}
                className="max-w-full max-h-[600px] object-contain rounded-lg shadow-lg"
              />
            ) : isVideo ? (
              <video
                src={version.file_url}
                controls
                className="max-w-full max-h-[600px] rounded-lg shadow-lg"
              >
                Your browser does not support the video tag.
              </video>
            ) : isPdf ? (
              <div className="text-center space-y-4">
                <FileText className="h-24 w-24 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">PDF Preview</p>
                <a
                  href={version.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Open PDF in new tab
                </a>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <File className="h-24 w-24 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">Preview not available</p>
                <a
                  href={version.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Download file
                </a>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
