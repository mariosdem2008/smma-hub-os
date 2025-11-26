import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Image as ImageIcon, Video, File, Star } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  created_at: string;
}

interface ProjectAsset {
  id: string;
  asset_id: string;
  is_final_content: boolean;
  display_order: number;
  assets: Asset;
}

interface Project {
  id: string;
  client_id: string;
  final_asset_id: string | null;
}

interface ProjectAssetsTabProps {
  project: Project;
  onUpdate: () => void;
}

export default function ProjectAssetsTab({ project, onUpdate }: ProjectAssetsTabProps) {
  const { toast } = useToast();
  const [projectAssets, setProjectAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssets();
  }, [project.id]);

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from("project_assets")
        .select(`
          id,
          asset_id,
          is_final_content,
          display_order,
          assets (
            id,
            filename,
            file_url,
            file_type,
            created_at
          )
        `)
        .eq("project_id", project.id)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setProjectAssets(data as any);
    } catch (error) {
      console.error("Error fetching assets:", error);
      toast({
        title: "Error",
        description: "Failed to load assets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsFinal = async (assetId: string) => {
    try {
      // Unmark all others
      await supabase
        .from("project_assets")
        .update({ is_final_content: false })
        .eq("project_id", project.id);

      // Mark this one as final
      await supabase
        .from("project_assets")
        .update({ is_final_content: true })
        .eq("project_id", project.id)
        .eq("asset_id", assetId);

      // Update project final_asset_id
      await supabase
        .from("projects")
        .update({ final_asset_id: assetId })
        .eq("id", project.id);

      toast({
        title: "Updated",
        description: "Final content asset marked successfully",
      });

      fetchAssets();
      onUpdate();
    } catch (error) {
      console.error("Error marking as final:", error);
      toast({
        title: "Error",
        description: "Failed to mark as final content",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAsset = async (projectAssetId: string) => {
    try {
      const { error } = await supabase
        .from("project_assets")
        .delete()
        .eq("id", projectAssetId);

      if (error) throw error;

      toast({
        title: "Removed",
        description: "Asset removed from project",
      });

      fetchAssets();
      onUpdate();
    } catch (error) {
      console.error("Error removing asset:", error);
      toast({
        title: "Error",
        description: "Failed to remove asset",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === "image") return <ImageIcon className="h-5 w-5" />;
    if (fileType === "video") return <Video className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading assets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Project Assets</h3>
          <p className="text-sm text-muted-foreground">
            Manage all files attached to this project
          </p>
        </div>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Add Assets
        </Button>
      </div>

      {projectAssets.length === 0 ? (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="text-lg font-semibold mb-2">No Assets Yet</h4>
          <p className="text-muted-foreground mb-4">
            Upload files to add them to this project
          </p>
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload First Asset
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {projectAssets.map((projectAsset) => {
            const asset = projectAsset.assets;
            return (
              <Card key={projectAsset.id} className="relative p-3">
                {projectAsset.is_final_content && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <div className="bg-primary text-primary-foreground rounded-full p-1.5">
                      <Star className="h-3 w-3 fill-current" />
                    </div>
                  </div>
                )}

                <div className="aspect-video rounded overflow-hidden bg-muted mb-2 flex items-center justify-center">
                  {asset.file_type === "image" ? (
                    <img src={asset.file_url} alt={asset.filename} className="w-full h-full object-cover" />
                  ) : asset.file_type === "video" ? (
                    <video src={asset.file_url} className="w-full h-full object-cover" />
                  ) : (
                    getFileIcon(asset.file_type)
                  )}
                </div>

                <p className="text-xs font-medium truncate mb-3">{asset.filename}</p>

                <div className="flex gap-2">
                  {!projectAsset.is_final_content && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => handleMarkAsFinal(asset.id)}
                    >
                      Mark Final
                    </Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className={projectAsset.is_final_content ? "flex-1" : ""}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Asset</AlertDialogTitle>
                        <AlertDialogDescription>
                          Remove this asset from the project? The file will remain in your asset library.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemoveAsset(projectAsset.id)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
