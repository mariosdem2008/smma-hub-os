import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Eye, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { AssetVersionPreview } from "./AssetVersionPreview";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AssetVersion {
  id: string;
  version_number: number;
  file_url: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface ClientPortalAssetVersionsProps {
  assetId: string;
  currentVersion: number;
}

export function ClientPortalAssetVersions({
  assetId,
  currentVersion,
}: ClientPortalAssetVersionsProps) {
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewVersion, setPreviewVersion] = useState<AssetVersion | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchVersions();
  }, [assetId]);

  const fetchVersions = async () => {
    const { data, error } = await supabase
      .from('asset_versions')
      .select('*')
      .eq('asset_id', assetId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('Error fetching versions:', error);
    } else {
      setVersions(data || []);
    }
    setLoading(false);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Only show if there are previous versions
  if (versions.length <= 1) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Previous Versions ({versions.length - 1})
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            <div className="space-y-3">
              {versions.map((version) => {
                const isCurrentVersion = version.version_number === currentVersion;

                // Skip current version
                if (isCurrentVersion) return null;

                return (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-background"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">v{version.version_number}</Badge>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {format(new Date(version.created_at), 'MMM d, yyyy • h:mm a')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Size: {formatFileSize(version.file_size)}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewVersion(version)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              You're viewing read-only version history. Contact your agency to restore a previous version.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>

      {/* Preview Modal */}
      {previewVersion && (
        <AssetVersionPreview
          version={previewVersion}
          onClose={() => setPreviewVersion(null)}
        />
      )}
    </Collapsible>
  );
}
