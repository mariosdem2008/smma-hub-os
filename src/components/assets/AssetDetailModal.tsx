import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  File, 
  Upload, 
  Info,
  History,
  Loader2,
  Eye,
  EyeOff
} from "lucide-react";
import { format } from "date-fns";
import { AssetVersionHistory } from "./AssetVersionHistory";

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  client_id: string;
  custom_category: string | null;
  visible_to_client: boolean | null;
  created_at: string;
  current_version: number;
}

interface AssetDetailModalProps {
  asset: Asset;
  agencyId: string;
  onClose: () => void;
  onAssetUpdated: () => void;
}

export function AssetDetailModal({ asset, agencyId, onClose, onAssetUpdated }: AssetDetailModalProps) {
  const { toast } = useToast();
  const { canEditSettings } = useRole();
  const [uploading, setUploading] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const [currentAsset, setCurrentAsset] = useState(asset);

  useEffect(() => {
    // Subscribe to realtime updates for this asset
    const channel = supabase
      .channel('asset-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assets',
          filter: `id=eq.${asset.id}`,
        },
        (payload) => {
          setCurrentAsset(payload.new as Asset);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [asset.id]);

  const handleUploadNewVersion = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !canEditSettings) {
      return;
    }

    const file = event.target.files[0];
    setUploading(true);

    try {
      // Get latest version number
      const { data: versions } = await supabase
        .from('asset_versions')
        .select('version_number')
        .eq('asset_id', currentAsset.id)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = versions && versions.length > 0 
        ? versions[0].version_number + 1 
        : 1;

      // Upload new file
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentAsset.id}-v${nextVersion}.${fileExt}`;
      const filePath = `${currentAsset.client_id}/${fileName}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('assets')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      // Create version record
      const { data: { user } } = await supabase.auth.getUser();
      const { error: versionError } = await supabase
        .from('asset_versions')
        .insert({
          agency_id: agencyId,
          asset_id: currentAsset.id,
          version_number: nextVersion,
          file_url: publicUrl,
          file_size: file.size,
          uploaded_by: user?.id || null,
        });

      if (versionError) throw versionError;

      // Update main asset
      const { error: updateError } = await supabase
        .from('assets')
        .update({
          file_url: publicUrl,
          current_version: nextVersion,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentAsset.id);

      if (updateError) throw updateError;

      // Log activity
      if (user) {
        await supabase.from('content_activities').insert({
          content_type: 'asset',
          content_id: currentAsset.id,
          client_id: currentAsset.client_id,
          action: 'updated',
          actor_id: user.id,
          comment: `New version ${nextVersion} uploaded`,
        });
      }

      toast({
        title: "Success",
        description: `Version ${nextVersion} uploaded successfully`,
      });

      onAssetUpdated();
    } catch (error) {
      console.error('Error uploading new version:', error);
      toast({
        title: "Error",
        description: "Failed to upload new version",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleToggleVisibility = async () => {
    if (!canEditSettings) return;

    setUpdatingVisibility(true);
    try {
      const newVisibility = !currentAsset.visible_to_client;
      const { error } = await supabase
        .from('assets')
        .update({ visible_to_client: newVisibility })
        .eq('id', currentAsset.id);

      if (error) throw error;

      setCurrentAsset({ ...currentAsset, visible_to_client: newVisibility });
      toast({
        title: "Success",
        description: `Asset is now ${newVisibility ? 'visible' : 'hidden'} to client`,
      });
    } catch (error) {
      console.error('Error updating visibility:', error);
      toast({
        title: "Error",
        description: "Failed to update visibility",
        variant: "destructive",
      });
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'].includes(currentAsset.file_type);
  const isVideo = currentAsset.file_type.startsWith('video/');
  const isPdf = currentAsset.file_type === 'application/pdf';

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <File className="h-5 w-5" />
            {currentAsset.filename}
            <Badge variant="outline">v{currentAsset.current_version}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="info">Details</TabsTrigger>
            <TabsTrigger value="versions">
              <History className="h-4 w-4 mr-1" />
              Versions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-8 flex items-center justify-center min-h-[400px]">
              {isImage ? (
                <img
                  src={currentAsset.file_url}
                  alt={currentAsset.filename}
                  className="max-w-full max-h-[600px] object-contain rounded-lg shadow-lg"
                />
              ) : isVideo ? (
                <video
                  src={currentAsset.file_url}
                  controls
                  className="max-w-full max-h-[600px] rounded-lg shadow-lg"
                >
                  Your browser does not support the video tag.
                </video>
              ) : isPdf ? (
                <div className="text-center space-y-4">
                  <FileText className="h-24 w-24 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">PDF Document</p>
                  <a
                    href={currentAsset.file_url}
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
                    href={currentAsset.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Download file
                  </a>
                </div>
              )}
            </div>

            {canEditSettings && (
              <div className="flex gap-2">
                <Button
                  onClick={() => document.getElementById('version-upload')?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload New Version
                </Button>
                <input
                  id="version-upload"
                  type="file"
                  className="hidden"
                  onChange={handleUploadNewVersion}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Filename</Label>
                  <p className="text-sm mt-1">{currentAsset.filename}</p>
                </div>
                <div>
                  <Label>File Type</Label>
                  <p className="text-sm mt-1">{currentAsset.file_type}</p>
                </div>
                <div>
                  <Label>Size</Label>
                  <p className="text-sm mt-1">{formatFileSize(currentAsset.file_size)}</p>
                </div>
                <div>
                  <Label>Current Version</Label>
                  <p className="text-sm mt-1">v{currentAsset.current_version}</p>
                </div>
                <div>
                  <Label>Uploaded</Label>
                  <p className="text-sm mt-1">
                    {format(new Date(currentAsset.created_at), 'MMM d, yyyy • h:mm a')}
                  </p>
                </div>
                <div>
                  <Label>Category</Label>
                  <p className="text-sm mt-1">{currentAsset.custom_category || 'Uncategorized'}</p>
                </div>
              </div>

              {canEditSettings && (
                <div className="pt-4 border-t">
                  <Label className="mb-2 block">Client Portal Visibility</Label>
                  <Button
                    variant={currentAsset.visible_to_client ? "default" : "outline"}
                    onClick={handleToggleVisibility}
                    disabled={updatingVisibility}
                  >
                    {updatingVisibility ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : currentAsset.visible_to_client ? (
                      <Eye className="mr-2 h-4 w-4" />
                    ) : (
                      <EyeOff className="mr-2 h-4 w-4" />
                    )}
                    {currentAsset.visible_to_client ? 'Visible to Client' : 'Hidden from Client'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    {currentAsset.visible_to_client 
                      ? 'Client can see this asset in their portal' 
                      : 'Client cannot see this asset'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="versions">
            <AssetVersionHistory
              assetId={currentAsset.id}
              currentVersion={currentAsset.current_version}
              currentFileUrl={currentAsset.file_url}
              clientId={currentAsset.client_id}
              agencyId={agencyId}
              onVersionRestored={onAssetUpdated}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
