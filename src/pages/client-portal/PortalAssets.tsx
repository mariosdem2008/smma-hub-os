import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileText, Image, Film, FolderOpen, CheckCircle, Clock, Rocket } from "lucide-react";

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  created_at: string;
  status: string;
  uploaded_by: string | null;
  visible_to_client: boolean | null;
  is_client_upload: boolean | null;
}

interface OutletContext {
  clientId: string;
}

export function PortalAssets() {
  const { clientId } = useOutletContext<OutletContext>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewFilter, setViewFilter] = useState<"agency" | "my_uploads">("agency");

  useEffect(() => {
    fetchAssets();
  }, [clientId]);

  const fetchAssets = async () => {
    const { data } = await supabase
      .from("assets")
      .select("*")
      .eq("client_id", clientId)
      .or("visible_to_client.eq.true,is_client_upload.eq.true")
      .order("created_at", { ascending: false });

    setAssets(data || []);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${clientId}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("client-assets")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("client-assets")
          .getPublicUrl(filePath);

        // Save to database
        const { error: dbError } = await supabase.from("assets").insert({
          client_id: clientId,
          filename: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id,
          is_client_upload: true,
          visible_to_client: true,
          status: 'draft',
        });

        if (dbError) throw dbError;
      }

      toast({
        title: "Upload Successful",
        description: `${files.length} file(s) uploaded successfully.`,
      });

      fetchAssets();
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (asset: Asset) => {
    try {
      const response = await fetch(asset.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = asset.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: `Downloading ${asset.filename}`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download the file.",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return Image;
    if (fileType.startsWith("video/")) return Film;
    return FileText;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const filteredAssets = assets.filter((asset) => {
    // First filter by view type
    const matchesView = viewFilter === "my_uploads" 
      ? asset.uploaded_by === user?.id 
      : !asset.uploaded_by || asset.uploaded_by !== user?.id || asset.visible_to_client;
    
    if (!matchesView) return false;
    
    // Then filter by status
    if (statusFilter === "all") return true;
    return asset.status === statusFilter;
  });

  const agencyAssets = assets.filter(a => !a.uploaded_by || a.uploaded_by !== user?.id || a.visible_to_client);
  const myUploads = assets.filter(a => a.uploaded_by === user?.id);

  const statusCounts = {
    all: filteredAssets.length,
    ready: filteredAssets.filter(a => a.status === 'ready').length,
    published: filteredAssets.filter(a => a.status === 'published').length,
  };

  if (loading) {
    return <div>Loading assets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Assets</h1>
          <p className="text-muted-foreground">
            Your brand assets and content
          </p>
        </div>
        <Button disabled={uploading} asChild>
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Upload Files"}
          </label>
        </Button>
      </div>

      {/* View Filter */}
      <Tabs value={viewFilter} onValueChange={(v) => setViewFilter(v as "agency" | "my_uploads")}>
        <TabsList>
          <TabsTrigger value="agency">
            <FolderOpen className="h-4 w-4 mr-2" />
            Agency Assets <Badge variant="secondary" className="ml-2">{agencyAssets.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="my_uploads">
            <Upload className="h-4 w-4 mr-2" />
            My Uploads <Badge variant="secondary" className="ml-2">{myUploads.length}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">
            All <Badge variant="secondary" className="ml-2">{statusCounts.all}</Badge>
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

      {filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => {
            const Icon = getFileIcon(asset.file_type);
            return (
              <Card key={asset.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">
                      {asset.filename}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(asset.file_size)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(asset.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-1">
                      {asset.status === 'ready' && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      )}
                      {asset.status === 'published' && (
                        <Badge variant="default" className="text-xs">
                          <Rocket className="h-3 w-3 mr-1" />
                          Published
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {asset.file_type.startsWith("image/") && (
                  <img
                    src={asset.file_url}
                    alt={asset.filename}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDownload(asset)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Assets Yet</h3>
          <p className="text-muted-foreground mb-4">
            Upload your first asset to get started.
          </p>
          <Button asChild>
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </label>
          </Button>
        </Card>
      )}
    </div>
  );
}
