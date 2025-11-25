import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { History, Eye, RotateCcw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { AssetVersionPreview } from "./AssetVersionPreview";
import { useRole } from "@/hooks/useRole";

interface AssetVersion {
  id: string;
  version_number: number;
  file_url: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface AssetVersionHistoryProps {
  assetId: string;
  currentVersion: number;
  currentFileUrl: string;
  clientId: string;
  agencyId: string;
  onVersionRestored: () => void;
}

export function AssetVersionHistory({
  assetId,
  currentVersion,
  currentFileUrl,
  clientId,
  agencyId,
  onVersionRestored,
}: AssetVersionHistoryProps) {
  const { toast } = useToast();
  const { canEditSettings } = useRole();
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewVersion, setPreviewVersion] = useState<AssetVersion | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    fetchVersions();
    
    const channel = supabase
      .channel('asset-versions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asset_versions',
          filter: `asset_id=eq.${assetId}`,
        },
        () => {
          fetchVersions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleRestore = async (version: AssetVersion) => {
    if (!canEditSettings) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to restore versions",
        variant: "destructive",
      });
      return;
    }

    setRestoring(version.id);
    try {
      const { error: updateError } = await supabase
        .from('assets')
        .update({
          file_url: version.file_url,
          current_version: version.version_number,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assetId);

      if (updateError) throw updateError;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('content_activities').insert({
          content_type: 'asset',
          content_id: assetId,
          client_id: clientId,
          action: 'updated',
          actor_id: user.id,
          comment: `Restored asset to version ${version.version_number}`,
        });
      }

      toast({
        title: "Version Restored",
        description: `Asset restored to version ${version.version_number}`,
      });

      onVersionRestored();
    } catch (error) {
      console.error('Error restoring version:', error);
      toast({
        title: "Error",
        description: "Failed to restore version",
        variant: "destructive",
      });
    } finally {
      setRestoring(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No version history available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => {
                const isCurrentVersion = version.version_number === currentVersion;

                return (
                  <div
                    key={version.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      isCurrentVersion ? 'bg-primary/5 border-primary' : 'bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant={isCurrentVersion ? "default" : "outline"}>
                          v{version.version_number}
                        </Badge>
                        {isCurrentVersion && (
                          <span className="text-xs text-primary font-medium">Current</span>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {format(new Date(version.created_at), 'MMM d, yyyy • h:mm a')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Size: {formatFileSize(version.file_size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewVersion(version)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      
                      {!isCurrentVersion && canEditSettings && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(version)}
                          disabled={restoring === version.id}
                        >
                          {restoring === version.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4 mr-1" />
                          )}
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {previewVersion && (
        <AssetVersionPreview
          version={previewVersion}
          onClose={() => setPreviewVersion(null)}
        />
      )}
    </div>
  );
}
