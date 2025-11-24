import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { format } from "date-fns";
import { ArrowLeftRight } from "lucide-react";

interface AssetVersion {
  id: string;
  version_number: number;
  file_url: string;
  file_size: number | null;
  created_at: string;
}

interface AssetVersionCompareProps {
  version1: AssetVersion;
  version2: AssetVersion;
  onClose: () => void;
}

export function AssetVersionCompare({ version1, version2, onClose }: AssetVersionCompareProps) {
  const [sliderValue, setSliderValue] = useState([50]);
  
  const fileType1 = version1.file_url.split('.').pop()?.toLowerCase() || '';
  const fileType2 = version2.file_url.split('.').pop()?.toLowerCase() || '';
  const isImage1 = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileType1);
  const isImage2 = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileType2);
  const bothImages = isImage1 && isImage2;

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Compare Versions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Version Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <Badge className="mb-2">Version {version1.version_number}</Badge>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Size:</span>{' '}
                  {formatFileSize(version1.file_size)}
                </p>
                <p>
                  <span className="text-muted-foreground">Date:</span>{' '}
                  {format(new Date(version1.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <Badge className="mb-2">Version {version2.version_number}</Badge>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Size:</span>{' '}
                  {formatFileSize(version2.file_size)}
                </p>
                <p>
                  <span className="text-muted-foreground">Date:</span>{' '}
                  {format(new Date(version2.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>

          {/* Comparison View */}
          {bothImages ? (
            <div className="space-y-4">
              <div className="relative bg-muted/50 rounded-lg overflow-hidden" style={{ height: '500px' }}>
                {/* Base Image (Version 2) */}
                <div className="absolute inset-0">
                  <img
                    src={version2.file_url}
                    alt={`Version ${version2.version_number}`}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Overlay Image (Version 1) with clip-path */}
                <div 
                  className="absolute inset-0"
                  style={{ clipPath: `inset(0 ${100 - sliderValue[0]}% 0 0)` }}
                >
                  <img
                    src={version1.file_url}
                    alt={`Version ${version1.version_number}`}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Divider Line */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-primary shadow-lg"
                  style={{ left: `${sliderValue[0]}%` }}
                >
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-primary rounded-full p-2">
                    <ArrowLeftRight className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              </div>

              {/* Slider Control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>v{version1.version_number}</span>
                  <span>Drag to compare</span>
                  <span>v{version2.version_number}</span>
                </div>
                <Slider
                  value={sliderValue}
                  onValueChange={setSliderValue}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          ) : (
            /* Side by Side for Non-Images */
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-8 flex items-center justify-center min-h-[400px]">
                {isImage1 ? (
                  <img
                    src={version1.file_url}
                    alt={`Version ${version1.version_number}`}
                    className="max-w-full max-h-[400px] object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <p className="mb-2">Preview not available</p>
                    <a
                      href={version1.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Download file
                    </a>
                  </div>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-8 flex items-center justify-center min-h-[400px]">
                {isImage2 ? (
                  <img
                    src={version2.file_url}
                    alt={`Version ${version2.version_number}`}
                    className="max-w-full max-h-[400px] object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <p className="mb-2">Preview not available</p>
                    <a
                      href={version2.file_url}
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
