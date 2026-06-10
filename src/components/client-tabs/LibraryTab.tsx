import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { 
  FolderOpen, 
  Upload, 
  FileText, 
  Image as ImageIcon,
  Video,
  File,
  Download,
  Trash2,
  MoreVertical,
  Eye,
  FolderPlus,
  Folder
} from "lucide-react";
import { format } from "date-fns";
import ClientTabEmptyState from "./shared/ClientTabEmptyState";

interface LibraryTabProps {
  clientId: string;
  agencyId: string;
}

interface LibraryAsset {
  id: string;
  client_id: string;
  file_url: string;
  filename: string;
  file_type: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  custom_category: string | null;
  thumbnail_url: string | null;
  title: string | null;
}

export default function LibraryTab({ clientId, agencyId }: LibraryTabProps) {
  const { toast } = useToast();
  const { canCreateContent, canDeleteContent, isViewer } = useRole();
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<string>("");
  const [previewAsset, setPreviewAsset] = useState<LibraryAsset | null>(null);
  const [deleteAsset, setDeleteAsset] = useState<LibraryAsset | null>(null);

  useEffect(() => {
    fetchAssets();
  }, [clientId]);

  const fetchAssets = async () => {
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("client_id", clientId)
      .is("pipeline_stage", null) // Only library assets (not in pipeline)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch library",
        variant: "destructive",
      });
    } else {
      setAssets(data || []);
      // Extract unique folders
      const uniqueFolders = [...new Set(data?.map(a => a.custom_category).filter(Boolean) as string[])];
      setFolders(uniqueFolders);
    }
    setLoading(false);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || folders.includes(newFolderName.trim())) return;
    
    setFolders([...folders, newFolderName.trim()]);
    setNewFolderName("");
    setShowFolderDialog(false);
    toast({
      title: "Success",
      description: "Folder created",
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      for (const file of Array.from(files)) {
        // Upload to storage
        const fileExt = file.name.split(".").pop();
        const fileName = `${clientId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("client-assets")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("client-assets")
          .getPublicUrl(fileName);

        // Generate thumbnail for images/videos
        let thumbnailUrl = null;
        if (file.type.startsWith("image/")) {
          thumbnailUrl = publicUrl; // Use image itself as thumbnail
        }

        // Save metadata to database with pipeline_stage as null for library assets
        const { data: assetData, error: dbError } = await supabase
          .from("assets")
          .insert({
            client_id: clientId,
            file_url: publicUrl,
            filename: file.name,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user?.id || null,
            custom_category: uploadFolder || null,
            thumbnail_url: thumbnailUrl,
            title: file.name,
            current_version: 1,
            pipeline_stage: null, // Explicitly set to null for library assets
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Create initial version
        await supabase
          .from('asset_versions')
          .insert({
            agency_id: agencyId,
            asset_id: assetData.id,
            version_number: 1,
            file_url: publicUrl,
            file_size: file.size,
            uploaded_by: user?.id || null,
          });

        setAssets([assetData, ...assets]);
      }

      toast({
        title: "Success",
        description: `${files.length} file(s) uploaded successfully`,
      });
      
      setShowUploadDialog(false);
      setUploadFolder("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDeleteAsset = async () => {
    if (!deleteAsset) return;

    try {
      // Delete from storage
      const url = new URL(deleteAsset.file_url);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.indexOf('client-assets');
      
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        await supabase.storage.from("client-assets").remove([filePath]);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("assets")
        .delete()
        .eq("id", deleteAsset.id);

      if (dbError) throw dbError;

      setAssets(assets.filter((a) => a.id !== deleteAsset.id));
      setDeleteAsset(null);
      setPreviewAsset(null);

      toast({
        title: "Success",
        description: "Asset deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete asset",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (asset: LibraryAsset) => {
    try {
      const response = await fetch(asset.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = asset.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-12 w-12 text-muted-foreground" />;
    
    if (fileType.startsWith("image/")) return <ImageIcon className="h-12 w-12 text-primary" />;
    if (fileType.startsWith("video/")) return <Video className="h-12 w-12 text-primary" />;
    return <FileText className="h-12 w-12 text-warning" />;
  };

  const filteredAssets = selectedFolder 
    ? assets.filter(a => a.custom_category === selectedFolder)
    : assets.filter(a => !a.custom_category);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading library...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Library</h2>
        </div>
        {canCreateContent && !isViewer && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFolderDialog(true)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New Folder
            </Button>
            <Button onClick={() => setShowUploadDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Files
            </Button>
          </div>
        )}
      </div>

      {/* Folders */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedFolder === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedFolder(null)}
        >
          <Folder className="mr-2 h-4 w-4" />
          Unsorted ({assets.filter(a => !a.custom_category).length})
        </Button>
        {folders.map(folder => (
          <Button
            key={folder}
            variant={selectedFolder === folder ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedFolder(folder)}
          >
            <Folder className="mr-2 h-4 w-4" />
            {folder} ({assets.filter(a => a.custom_category === folder).length})
          </Button>
        ))}
      </div>

      {/* Assets Grid */}
      {filteredAssets.length === 0 ? (
        <ClientTabEmptyState
          icon={<FolderOpen className="h-12 w-12" />}
          title={selectedFolder ? `No files in ${selectedFolder}` : "No files yet"}
          description={
            selectedFolder
              ? "Upload files to this folder to get started."
              : "Upload files to your library to organize and manage your client's assets."
          }
          primaryAction={
            canCreateContent && !isViewer
              ? {
                  label: "Upload Files",
                  onClick: () => setShowUploadDialog(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="group hover:shadow-lg transition-shadow">
              <CardContent className="p-4 space-y-3">
                {/* Thumbnail/Icon */}
                <div 
                  className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => setPreviewAsset(asset)}
                >
                  {asset.thumbnail_url || asset.file_type?.startsWith("image/") ? (
                    <img 
                      src={asset.file_url} 
                      alt={asset.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getFileIcon(asset.file_type)
                  )}
                </div>

                {/* File Info */}
                <div className="space-y-1">
                  <p className="text-sm font-medium truncate" title={asset.filename}>
                    {asset.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(asset.file_size)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDownload(asset)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDeleteContent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteAsset(asset)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Folder (Optional)</Label>
              <select
                className="w-full px-3 py-2 rounded-md border bg-background"
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
              >
                <option value="">Unsorted</option>
                {folders.map(folder => (
                  <option key={folder} value={folder}>{folder}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Select Files</Label>
              <input
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.csv,.txt"
                onChange={handleFileUpload}
                className="w-full"
                disabled={uploading}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {previewAsset && (
        <Dialog open={!!previewAsset} onOpenChange={() => setPreviewAsset(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{previewAsset.filename}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Preview */}
              <div className="bg-muted rounded-lg flex items-center justify-center p-4">
                {previewAsset.file_type?.startsWith("image/") ? (
                  <img 
                    src={previewAsset.file_url} 
                    alt={previewAsset.filename}
                    className="max-h-[60vh] rounded"
                  />
                ) : previewAsset.file_type?.startsWith("video/") ? (
                  <video 
                    src={previewAsset.file_url} 
                    controls
                    className="max-h-[60vh] rounded"
                  />
                ) : (
                  <div className="text-center py-12">
                    {getFileIcon(previewAsset.file_type)}
                    <p className="mt-4 text-muted-foreground">Preview not available</p>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Size</p>
                  <p className="font-medium">{formatFileSize(previewAsset.file_size)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Uploaded</p>
                  <p className="font-medium">{format(new Date(previewAsset.created_at), 'MMM d, yyyy')}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={() => handleDownload(previewAsset)} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                {canDeleteContent && (
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      setDeleteAsset(previewAsset);
                      setPreviewAsset(null);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAsset} onOpenChange={() => setDeleteAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteAsset?.filename}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAsset}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
