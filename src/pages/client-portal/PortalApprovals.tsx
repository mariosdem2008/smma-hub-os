import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import ClientApprovalInterface from "@/components/approval/ClientApprovalInterface";

interface OutletContext {
  clientId: string;
}

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  content_type: string | null;
  final_caption: string | null;
  hashtags: string | null;
  scheduled_time: string | null;
  platforms: string[] | null;
  current_version: number;
  created_at: string;
  pipeline_stage: string;
  thumbnail_url: string | null;
}

export default function PortalApprovals() {
  const { clientId } = useOutletContext<OutletContext>();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    fetchAssetsForApproval();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('portal-approvals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assets',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          fetchAssetsForApproval();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const fetchAssetsForApproval = async () => {
    try {
      // Get assets in review stage
      const { data: assets, error: assetsError } = await supabase
        .from('assets')
        .select('*')
        .eq('client_id', clientId)
        .eq('pipeline_stage', 'review')
        .order('created_at', { ascending: false });

      if (assetsError) throw assetsError;
      setAssets(assets || []);
    } catch (error: any) {
      console.error("Error fetching assets:", error);
      toast({
        title: "Error",
        description: "Failed to load assets for approval",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Simplified: all assets in review are "pending"
  const filteredAssets = assets;

  

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedAsset) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedAsset(null)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Approvals
        </button>
        
        <ClientApprovalInterface
          asset={selectedAsset}
          clientId={clientId}
          onApprovalComplete={() => {
            setSelectedAsset(null);
            fetchAssetsForApproval();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content Approvals</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve content awaiting your feedback
        </p>
      </div>

      {filteredAssets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No assets awaiting approval
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map(asset => (
            <Card 
              key={asset.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedAsset(asset)}
            >
              <CardContent className="p-4 space-y-3">
                {asset.file_type.startsWith('video/') ? (
                  asset.thumbnail_url ? (
                    <img
                      src={asset.thumbnail_url}
                      alt={asset.filename}
                      className="w-full h-48 object-cover rounded"
                    />
                  ) : (
                    <video
                      src={asset.file_url}
                      className="w-full h-48 object-cover rounded"
                    />
                  )
                ) : (
                  <img
                    src={asset.file_url}
                    alt={asset.filename}
                    className="w-full h-48 object-cover rounded"
                  />
                )}

                <div className="space-y-2">
                  <h3 className="font-semibold line-clamp-2">{asset.filename}</h3>
                  
                  {asset.platforms && asset.platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {asset.platforms.map(platform => (
                        <Badge key={platform} variant="secondary" className="text-xs">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {asset.final_caption && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {asset.final_caption}
                    </p>
                  )}

                  {asset.scheduled_time && (
                    <p className="text-xs text-muted-foreground">
                      📅 {new Date(asset.scheduled_time).toLocaleString()}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
