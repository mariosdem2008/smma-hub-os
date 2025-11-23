import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  Trash2,
  MoreVertical,
  Eye,
  EyeOff,
  CheckCircle,
  Clock,
  Rocket,
  Tag,
  FolderPlus
} from "lucide-react";
import { format } from "date-fns";

interface AssetsTabProps {
  clientId: string;
}

interface Asset {
  id: string;
  file_url: string;
  filename: string;
  file_type: string;
  uploaded_by: string | null;
  created_at: string;
  status: string;
  visible_to_client: boolean;
  custom_category: string | null;
}

type FilterType = "all" | "images" | "videos" | "documents";
type StatusFilter = "all" | "draft" | "ready" | "published";

export default function AssetsTab({ clientId }: AssetsTabProps) {
  const { toast } = useToast();
  const { canCreateContent, canDeleteContent, isViewer } = useRole();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [deleteAsset, setDeleteAsset] = useState<Asset | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    fetchAssets();
  }, [clientId]);

  const fetchAssets = async () => {
    const { data, error } = await supabase
      .from("assets")
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
      // Extract unique categories
      const uniqueCategories = [...new Set(data?.map(a => a.custom_category).filter(Boolean) as string[])];
      setCategories(uniqueCategories);
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
          .from("assets")
          .insert({
            client_id: clientId,
            file_url: publicUrl,
            filename: file.name,
            file_type: file.type,
            uploaded_by: user?.id || null,
            status: 'draft',
            visible_to_client: false,
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

  const handleStatusChange = async (assetId: string, newStatus: string) => {
    const { error } = await supabase
      .from("assets")
      .update({ status: newStatus })
      .eq("id", assetId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    } else {
      setAssets(assets.map(a => a.id === assetId ? { ...a, status: newStatus } : a));
      toast({
        title: "Success",
        description: `Asset marked as ${newStatus}`,
      });
    }
  };

  const handleVisibilityToggle = async (assetId: string, visible: boolean) => {
    const { error } = await supabase
      .from("assets")
      .update({ visible_to_client: visible })
      .eq("id", assetId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update visibility",
        variant: "destructive",
      });
    } else {
      setAssets(assets.map(a => a.id === assetId ? { ...a, visible_to_client: visible } : a));
      toast({
        title: "Success",
        description: visible ? "Asset is now visible to client" : "Asset hidden from client",
      });
    }
  };

  const handleCategoryChange = async (assetId: string, category: string | null) => {
    const { error } = await supabase
      .from("assets")
      .update({ custom_category: category })
      .eq("id", assetId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    } else {
      setAssets(assets.map(a => a.id === assetId ? { ...a, custom_category: category } : a));
      if (category && !categories.includes(category)) {
        setCategories([...categories, category]);
      }
      toast({
        title: "Success",
        description: category ? `Moved to ${category}` : "Category removed",
      });
    }
  };

  const handleCreateCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory("");
      setShowCategoryDialog(false);
      toast({
        title: "Success",
        description: "Category created",
      });
    }
  };

  const filteredAssets = assets.filter((asset) => {
    // Filter by file type
    if (filter !== "all" && getFileCategory(asset.file_type) !== filter) return false;
    
    // Filter by status
    if (statusFilter !== "all" && asset.status !== statusFilter) return false;
    
    // Filter by category
    if (categoryFilter && asset.custom_category !== categoryFilter) return false;
    
    return true;
  });

  const filterCounts = {
    all: assets.length,
    images: assets.filter((a) => a.file_type?.startsWith("image/")).length,
    videos: assets.filter((a) => a.file_type?.startsWith("video/")).length,
    documents: assets.filter((a) => !a.file_type?.startsWith("image/") && !a.file_type?.startsWith("video/")).length,
  };

  const statusCounts = {
    all: assets.length,
    draft: assets.filter(a => a.status === 'draft').length,
    ready: assets.filter(a => a.status === 'ready').length,
    published: assets.filter(a => a.status === 'published').length,
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

      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">
            All <Badge variant="secondary" className="ml-2">{statusCounts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="draft">
            <Clock className="h-4 w-4 mr-2" />
            Draft <Badge variant="secondary" className="ml-2">{statusCounts.draft}</Badge>
          </TabsTrigger>
          <TabsTrigger value="ready">
            <CheckCircle className="h-4 w-4 mr-2" />
            Ready <Badge variant="secondary" className="ml-2">{statusCounts.ready}</Badge>
          </TabsTrigger>
          <TabsTrigger value="published">
            <Rocket className="h-4 w-4 mr-2" />
            Published <Badge variant="secondary" className="ml-2">{statusCounts.published}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All Types
        </Button>
        <Button
          variant={filter === "images" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("images")}
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          Images
        </Button>
        <Button
          variant={filter === "videos" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("videos")}
        >
          <Video className="mr-2 h-4 w-4" />
          Videos
        </Button>
        <Button
          variant={filter === "documents" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("documents")}
        >
          <FileText className="mr-2 h-4 w-4" />
          Documents
        </Button>

        {/* Category filters */}
        {categories.length > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              >
                <Tag className="mr-2 h-4 w-4" />
                {cat}
              </Button>
            ))}
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCategoryDialog(true)}
        >
          <FolderPlus className="mr-2 h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Assets Grid */}
      {filteredAssets.length > 0 ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredAssets.map((asset) => (
            <Card
              key={asset.id}
              className="cursor-pointer transition-shadow hover:shadow-md group"
              onClick={() => setPreviewAsset(asset)}
            >
              <CardContent className="p-4">
                <div className="relative aspect-square rounded-md bg-muted flex items-center justify-center mb-3 overflow-hidden">
                  {asset.file_type?.startsWith("image/") ? (
                    <img
                      src={asset.file_url}
                      alt={asset.filename || "Asset"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground">
                      {getFileIcon(asset.file_type)}
                    </div>
                  )}
                  
                  {/* Visibility badge */}
                  <div className="absolute top-2 right-2">
                    {asset.visible_to_client ? (
                      <Badge variant="default" className="gap-1">
                        <Eye className="h-3 w-3" /> Visible
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <EyeOff className="h-3 w-3" /> Hidden
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {asset.filename || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(asset.created_at), "MMM d, yyyy")}
                      </p>
                      {asset.custom_category && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {asset.custom_category}
                        </Badge>
                      )}
                    </div>
                    {!isViewer && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(asset.id, 'draft');
                          }}>
                            <Clock className="h-4 w-4 mr-2" />
                            Mark as Draft
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(asset.id, 'ready');
                          }}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark as Ready
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(asset.id, 'published');
                          }}>
                            <Rocket className="h-4 w-4 mr-2" />
                            Mark as Published
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleVisibilityToggle(asset.id, !asset.visible_to_client);
                          }}>
                            {asset.visible_to_client ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Hide from Client
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Show to Client
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {categories.map((cat) => (
                            <DropdownMenuItem key={cat} onClick={(e) => {
                              e.stopPropagation();
                              handleCategoryChange(asset.id, cat);
                            }}>
                              <Tag className="h-4 w-4 mr-2" />
                              Move to {cat}
                            </DropdownMenuItem>
                          ))}
                          {asset.custom_category && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleCategoryChange(asset.id, null);
                            }}>
                              <X className="h-4 w-4 mr-2" />
                              Remove from Category
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
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

      {/* Create Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter category name..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory();
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowCategoryDialog(false);
                setNewCategory("");
              }}>
                Cancel
              </Button>
              <Button onClick={handleCreateCategory} disabled={!newCategory.trim()}>
                Create Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!previewAsset} onOpenChange={() => setPreviewAsset(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewAsset?.filename || "Asset Preview"}</DialogTitle>
          </DialogHeader>
          {previewAsset && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="rounded-md bg-muted flex items-center justify-center overflow-hidden min-h-[300px]">
                {previewAsset.file_type?.startsWith("image/") ? (
                  <img
                    src={previewAsset.file_url}
                    alt={previewAsset.filename || "Asset"}
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

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {previewAsset.status === 'draft' && <Clock className="h-4 w-4" />}
                    {previewAsset.status === 'ready' && <CheckCircle className="h-4 w-4" />}
                    {previewAsset.status === 'published' && <Rocket className="h-4 w-4" />}
                    <span className="capitalize">{previewAsset.status}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Visibility</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {previewAsset.visible_to_client ? (
                      <>
                        <Eye className="h-4 w-4" />
                        <span>Visible to client</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4" />
                        <span>Hidden from client</span>
                      </>
                    )}
                  </div>
                </div>
                {previewAsset.custom_category && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Category</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Tag className="h-4 w-4" />
                      <span>{previewAsset.custom_category}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
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
              Are you sure you want to delete "{deleteAsset?.filename}"? This action
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
