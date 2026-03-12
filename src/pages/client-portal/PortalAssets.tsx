import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useHasSupabaseSession } from "@/hooks/useHasSupabaseSession";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Image, Film, FolderOpen, CheckCircle, Rocket } from "lucide-react";
import { AssetDetailModal } from "@/components/assets/AssetDetailModal";
import { ClientPortalAssetVersions } from "@/components/assets/ClientPortalAssetVersions";

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  created_at: string;
  status: string | null;
  visible_to_client: boolean | null;
  title: string | null;
  content_type: string | null;
  final_caption: string | null;
  thumbnail_url: string | null;
  client_id: string;
  custom_category: string | null;
  current_version: number;
}

interface OutletContext {
  clientId: string;
}

export function PortalAssets() {
  const { clientId } = useOutletContext<OutletContext>();
  const { hasSession, loading: sessionLoading } = useHasSupabaseSession();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "published">("all");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!hasSession) {
      setAssets([]);
      setLoading(false);
      return;
    }
    fetchAssets();
  }, [clientId, hasSession, sessionLoading]);

  const fetchAssets = async () => {
    const { data } = await supabase
      .from("assets")
      .select("*")
      .eq("client_id", clientId)
      .eq("visible_to_client", true)
      .order("created_at", { ascending: false });

    setAssets(data || []);
    setLoading(false);
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

  const filteredAssets = useMemo(() => {
    if (statusFilter === "all") {
      return assets;
    }
    return assets.filter(asset => asset.status === statusFilter);
  }, [assets, statusFilter]);

  const statusCounts = useMemo(() => ({
    all: assets.length,
    ready: assets.filter(a => a.status === 'ready').length,
    published: assets.filter(a => a.status === 'published').length,
  }), [assets]);

  if (loading) {
    return <div>Loading assets...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Assets</h2>
        <p className="text-muted-foreground">View and download assets shared by your agency</p>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "ready" | "published")} className="space-y-4">
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

        <TabsContent value="all" className="space-y-4">
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
                    {asset.file_type.startsWith("video/") && (
                      <div className="relative w-full h-32 bg-muted rounded-lg overflow-hidden">
                        {asset.thumbnail_url ? (
                          <img
                            src={asset.thumbnail_url}
                            alt={asset.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <video
                            src={asset.file_url}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Film className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedAsset(asset)}
                      >
                        View & Comment
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(asset)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Assets Yet</h3>
              <p className="text-muted-foreground">
                Your agency hasn't shared any assets with you yet.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ready" className="space-y-4">
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
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ready
                          </Badge>
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
                    {asset.file_type.startsWith("video/") && (
                      <div className="relative w-full h-32 bg-muted rounded-lg overflow-hidden">
                        {asset.thumbnail_url ? (
                          <img
                            src={asset.thumbnail_url}
                            alt={asset.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <video
                            src={asset.file_url}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Film className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedAsset(asset)}
                      >
                        View & Comment
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(asset)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Ready Assets</h3>
              <p className="text-muted-foreground">
                No assets are currently marked as ready.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="published" className="space-y-4">
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
                          <Badge variant="default" className="text-xs">
                            <Rocket className="h-3 w-3 mr-1" />
                            Published
                          </Badge>
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
                    {asset.file_type.startsWith("video/") && (
                      <div className="relative w-full h-32 bg-muted rounded-lg overflow-hidden">
                        {asset.thumbnail_url ? (
                          <img
                            src={asset.thumbnail_url}
                            alt={asset.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <video
                            src={asset.file_url}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Film className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedAsset(asset)}
                      >
                        View & Comment
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(asset)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Published Assets</h3>
              <p className="text-muted-foreground">
                No assets have been published yet.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          agencyId="" 
          onClose={() => setSelectedAsset(null)}
          onAssetUpdated={fetchAssets}
        />
      )}
    </div>
  );
}
