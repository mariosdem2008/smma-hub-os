import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { 
  FolderOpen, 
  Upload, 
  X, 
  FileText, 
  Image as ImageIcon,
  Video,
  File,
  Download,
  Trash2
} from "lucide-react";
import { format } from "date-fns";

interface AssetsTabProps {
  clientId: string;
}

interface Asset {
  id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

type FilterType = "all" | "images" | "videos" | "documents";

export default function AssetsTab({ clientId }: AssetsTabProps) {
  const { toast } = useToast();
  const { canCreateContent, canDeleteContent, isViewer } = useRole();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [deleteAsset, setDeleteAsset] = useState<Asset | null>(null);

  useEffect(() => {
    fetchAssets();
  }, [clientId]);

  const fetchAssets = async () => {
    const { data, error } = await supabase
      .from("client_assets")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching assets:", error);
      toast({
        title: "Error",
        description: "Failed to fetch assets",
        variant: "destructive",
      });
    } else {
      setAssets(data || []);
    }
    setLoading(false);
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
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("client-assets")
          .upload(fileName, file);

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("client-assets")
          .getPublicUrl(fileName);

        // Save metadata to database
        const { data: assetData, error: dbError } = await supabase
          .from("client_assets")
          .insert({
            client_id: clientId,
            file_url: publicUrl,
            file_name: file.name,
            file_type: file.type,
            uploaded_by: user?.id || null,
          })
          .select()
          .single();

        if (dbError) {
          throw dbError;
        }

        setAssets([assetData, ...assets]);
      }

      toast({
        title: "Success",
        description: `${files.length} file(s) uploaded successfully`,
      });
    } catch (error) {
      console.error("Upload error:", error);
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
      // Extract file path from URL
      const url = new URL(deleteAsset.file_url);
      const filePath = url.pathname.split("/client-assets/")[1];

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("client-assets")
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("client_assets")
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
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete asset",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-8 w-8" />;
    
    if (fileType.startsWith("image/")) return <ImageIcon className="h-8 w-8" />;
    if (fileType.startsWith("video/")) return <Video className="h-8 w-8" />;
    return <FileText className="h-8 w-8" />;
  };

  const getFileCategory = (fileType: string | null): FilterType => {
    if (!fileType) return "all";
    if (fileType.startsWith("image/")) return "images";
    if (fileType.startsWith("video/")) return "videos";
    return "documents";
  };

  const filteredAssets = assets.filter((asset) => {
    if (filter === "all") return true;
    return getFileCategory(asset.file_type) === filter;
  });

  const filterCounts = {
    all: assets.length,
    images: assets.filter((a) => a.file_type?.startsWith("image/")).length,
    videos: assets.filter((a) => a.file_type?.startsWith("video/")).length,
    documents: assets.filter((a) => !a.file_type?.startsWith("image/") && !a.file_type?.startsWith("video/")).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading assets...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Upload */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Assets Library</h2>
        </div>
        {canCreateContent && !isViewer && (
          <div>
            <input
              type="file"
              id="file-upload"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => document.getElementById("file-upload")?.click()}
              disabled={uploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload Files"}
            </Button>
          </div>
        )}
      </div>

      {/* Viewer Notice */}
      {isViewer && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              You have read-only access to assets.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All
          <Badge variant="secondary" className="ml-2">
            {filterCounts.all}
          </Badge>
        </Button>
        <Button
          variant={filter === "images" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("images")}
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          Images
          <Badge variant="secondary" className="ml-2">
            {filterCounts.images}
          </Badge>
        </Button>
        <Button
          variant={filter === "videos" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("videos")}
        >
          <Video className="mr-2 h-4 w-4" />
          Videos
          <Badge variant="secondary" className="ml-2">
            {filterCounts.videos}
          </Badge>
        </Button>
        <Button
          variant={filter === "documents" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("documents")}
        >
          <FileText className="mr-2 h-4 w-4" />
          Documents
          <Badge variant="secondary" className="ml-2">
            {filterCounts.documents}
          </Badge>
        </Button>
      </div>

      {/* Assets Grid */}
      {filteredAssets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredAssets.map((asset) => (
            <Card
              key={asset.id}
              className="cursor-pointer transition-shadow hover:shadow-md group"
              onClick={() => setPreviewAsset(asset)}
            >
              <CardContent className="p-4">
                <div className="aspect-square rounded-md bg-muted flex items-center justify-center mb-3 overflow-hidden">
                  {asset.file_type?.startsWith("image/") ? (
                    <img
                      src={asset.file_url}
                      alt={asset.file_name || "Asset"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground">
                      {getFileIcon(asset.file_type)}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium truncate">
                    {asset.file_name || "Untitled"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(asset.created_at), "MMM d, yyyy")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              {filter === "all" ? "No assets yet" : `No ${filter} found`}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Upload your first asset to get started
            </p>
            <Button
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Files
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewAsset} onOpenChange={() => setPreviewAsset(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewAsset?.file_name || "Asset Preview"}</DialogTitle>
          </DialogHeader>
          {previewAsset && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="rounded-md bg-muted flex items-center justify-center overflow-hidden min-h-[300px]">
                {previewAsset.file_type?.startsWith("image/") ? (
                  <img
                    src={previewAsset.file_url}
                    alt={previewAsset.file_name || "Asset"}
                    className="max-w-full max-h-[500px] object-contain"
                  />
                ) : previewAsset.file_type?.startsWith("video/") ? (
                  <video
                    src={previewAsset.file_url}
                    controls
                    className="max-w-full max-h-[500px]"
                  />
                ) : (
                  <div className="text-center p-8">
                    {getFileIcon(previewAsset.file_type)}
                    <p className="mt-4 text-sm text-muted-foreground">
                      Preview not available for this file type
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Uploaded {format(new Date(previewAsset.created_at), "PPP")}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(previewAsset.file_url, "_blank");
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  {canDeleteContent && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteAsset(previewAsset);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAsset} onOpenChange={() => setDeleteAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteAsset?.file_name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAsset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
