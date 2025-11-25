import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  EyeOff,
  Trash2,
  MessageSquare,
  ImagePlus
} from "lucide-react";
import { format } from "date-fns";
import { AssetVersionHistory } from "./AssetVersionHistory";
import { AssetComments } from "./AssetComments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  client_id: string;
  title: string | null;
  content_type: string | null;
  final_caption: string | null;
  custom_category: string | null;
  visible_to_client: boolean | null;
  created_at: string;
  current_version: number;
  thumbnail_url: string | null;
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(asset.title || "");
  const [editContentType, setEditContentType] = useState(asset.content_type || "");
  const [editDescription, setEditDescription] = useState(asset.final_caption || "");
  const [editNotes, setEditNotes] = useState(asset.custom_category || "");

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
          const updated = payload.new as Asset;
          setCurrentAsset(updated);
          setEditTitle(updated.title || "");
          setEditContentType(updated.content_type || "");
          setEditDescription(updated.final_caption || "");
          setEditNotes(updated.custom_category || "");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [asset.id]);

  const handleSaveMetadata = async () => {
    if (!canEditSettings) return;

    try {
      const { error } = await supabase
        .from('assets')
        .update({
          title: editTitle || null,
          content_type: editContentType || null,
          final_caption: editDescription || null,
          custom_category: editNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentAsset.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Asset metadata updated successfully",
      });

      setIsEditing(false);
      onAssetUpdated();
    } catch (error) {
      console.error('Error updating metadata:', error);
      toast({
        title: "Error",
        description: "Failed to update asset metadata",
        variant: "destructive",
      });
    }
  };

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

  const handleUploadThumbnail = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !canEditSettings) {
      return;
    }

    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const thumbnailPath = `${currentAsset.client_id}/thumbnails/${currentAsset.id}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(thumbnailPath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(thumbnailPath);

      const { error: updateError } = await supabase
        .from('assets')
        .update({ thumbnail_url: publicUrl })
        .eq('id', currentAsset.id);

      if (updateError) throw updateError;

      setCurrentAsset({ ...currentAsset, thumbnail_url: publicUrl });
      toast({
        title: "Success",
        description: "Thumbnail uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      toast({
        title: "Error",
        description: "Failed to upload thumbnail",
        variant: "destructive",
      });
    } finally {
      event.target.value = '';
    }
  };

  const handleDeleteAsset = async () => {
    setDeleting(true);
    try {
      console.log('Starting asset deletion for:', currentAsset.id);
      
      // Extract file path from URL
      // URL format: https://[project].supabase.co/storage/v1/object/public/assets/[client_id]/[filename]
      const url = new URL(currentAsset.file_url);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.indexOf('assets');
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        console.log('Deleting file from storage:', filePath);
        const { error: storageError } = await supabase.storage
          .from('assets')
          .remove([filePath]);
        
        if (storageError) {
          console.error('Storage deletion error:', storageError);
        }
      }

      // Delete thumbnail if exists
      if (currentAsset.thumbnail_url) {
        const thumbUrl = new URL(currentAsset.thumbnail_url);
        const thumbPathParts = thumbUrl.pathname.split('/');
        const thumbBucketIndex = thumbPathParts.indexOf('assets');
        if (thumbBucketIndex !== -1 && thumbBucketIndex < thumbPathParts.length - 1) {
          const thumbPath = thumbPathParts.slice(thumbBucketIndex + 1).join('/');
          console.log('Deleting thumbnail from storage:', thumbPath);
          const { error: thumbError } = await supabase.storage
            .from('assets')
            .remove([thumbPath]);
          
          if (thumbError) {
            console.error('Thumbnail deletion error:', thumbError);
          }
        }
      }

      // Delete from database (cascade will handle versions and comments)
      console.log('Deleting asset from database');
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', currentAsset.id);

      if (error) {
        console.error('Database deletion error:', error);
        throw error;
      }

      console.log('Asset deleted successfully');
      toast({
        title: "Success",
        description: "Asset deleted successfully",
      });

      onAssetUpdated();
      onClose();
    } catch (error: any) {
      console.error('Error deleting asset:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete asset",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="info">Details</TabsTrigger>
            <TabsTrigger value="versions">
              <History className="h-4 w-4 mr-1" />
              Versions
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="h-4 w-4 mr-1" />
              Comments
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
                <div className="space-y-4">
                  <video
                    src={currentAsset.file_url}
                    poster={currentAsset.thumbnail_url || undefined}
                    controls
                    className="max-w-full max-h-[600px] rounded-lg shadow-lg"
                  >
                    Your browser does not support the video tag.
                  </video>
                  {canEditSettings && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => document.getElementById('thumbnail-upload')?.click()}
                      >
                        <ImagePlus className="mr-2 h-4 w-4" />
                        Upload Thumbnail
                      </Button>
                      <input
                        id="thumbnail-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadThumbnail}
                      />
                    </div>
                  )}
                </div>
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
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Asset
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <div className="space-y-4">
              {!isEditing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Title</Label>
                      <p className="text-sm mt-1">{currentAsset.title || 'No title'}</p>
                    </div>
                    <div>
                      <Label>Content Type</Label>
                      <p className="text-sm mt-1 capitalize">{currentAsset.content_type?.replace(/_/g, ' ') || 'Not specified'}</p>
                    </div>
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
                    <div className="col-span-2">
                      <Label>Description</Label>
                      <p className="text-sm mt-1">{currentAsset.final_caption || 'No description'}</p>
                    </div>
                    <div className="col-span-2">
                      <Label>Notes</Label>
                      <p className="text-sm mt-1">{currentAsset.custom_category || 'No notes'}</p>
                    </div>
                  </div>

                  {canEditSettings && (
                    <Button onClick={() => setIsEditing(true)} variant="outline">
                      Edit Metadata
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-title">Title</Label>
                      <Input
                        id="edit-title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Enter title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-content-type">Content Type</Label>
                      <select
                        id="edit-content-type"
                        value={editContentType}
                        onChange={(e) => setEditContentType(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Select type</option>
                        <option value="educational">Educational</option>
                        <option value="promotional">Promotional</option>
                        <option value="ugc">UGC</option>
                        <option value="reel">Reel</option>
                        <option value="story">Story</option>
                        <option value="tutorial">Tutorial</option>
                        <option value="behind_the_scenes">Behind the Scenes</option>
                        <option value="testimonial">Testimonial</option>
                        <option value="product_showcase">Product Showcase</option>
                        <option value="announcement">Announcement</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Brief description"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-notes">Notes</Label>
                      <Textarea
                        id="edit-notes"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Additional notes"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveMetadata}>Save Changes</Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditing(false);
                      setEditTitle(currentAsset.title || "");
                      setEditContentType(currentAsset.content_type || "");
                      setEditDescription(currentAsset.final_caption || "");
                      setEditNotes(currentAsset.custom_category || "");
                    }}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}

              {canEditSettings && !isEditing && (
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

          <TabsContent value="comments">
            <AssetComments assetId={currentAsset.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this asset? This action cannot be undone and will delete all versions and comments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAsset}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
