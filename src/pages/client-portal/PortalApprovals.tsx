import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import ApprovalInterface from "@/components/approval/ApprovalInterface";

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
}

export default function PortalApprovals() {
  const { clientId } = useOutletContext<OutletContext>();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get assets in approval stage with pending tasks for this user
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          asset_versions!inner(
            id,
            approval_tasks!inner(
              status,
              approver_id
            )
          )
        `)
        .eq('client_id', clientId)
        .eq('pipeline_stage', 'approval')
        .eq('asset_versions.approval_tasks.approver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAssets(data || []);
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

  const getStatusCounts = () => {
    return {
      pending: assets.filter(a => 
        (a as any).asset_versions?.some((v: any) => 
          v.approval_tasks?.some((t: any) => t.status === 'pending')
        )
      ).length,
      approved: assets.filter(a => 
        (a as any).asset_versions?.some((v: any) => 
          v.approval_tasks?.some((t: any) => t.status === 'approved')
        )
      ).length,
      rejected: assets.filter(a => 
        (a as any).asset_versions?.some((v: any) => 
          v.approval_tasks?.some((t: any) => t.status === 'changes_requested')
        )
      ).length,
    };
  };

  const filteredAssets = assets.filter(asset => {
    if (filter === 'all') return true;
    
    const versions = (asset as any).asset_versions || [];
    return versions.some((v: any) => 
      v.approval_tasks?.some((t: any) => {
        if (filter === 'pending') return t.status === 'pending';
        if (filter === 'approved') return t.status === 'approved';
        if (filter === 'rejected') return t.status === 'changes_requested';
        return false;
      })
    );
  });

  const statusCounts = getStatusCounts();

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
        
        <ApprovalInterface
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

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending <Badge variant="secondary" className="ml-2">{statusCounts.pending}</Badge>
          </TabsTrigger>
          <TabsTrigger value="approved">
            <CheckCircle className="h-4 w-4 mr-2" />
            Approved <Badge variant="secondary" className="ml-2">{statusCounts.approved}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <XCircle className="h-4 w-4 mr-2" />
            Changes Requested <Badge variant="secondary" className="ml-2">{statusCounts.rejected}</Badge>
          </TabsTrigger>
          <TabsTrigger value="all">
            All <Badge variant="secondary" className="ml-2">{assets.length}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredAssets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No assets {filter !== 'all' ? `with ${filter} status` : 'for approval'}
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
                  <video
                    src={asset.file_url}
                    className="w-full h-48 object-cover rounded"
                  />
                ) : (
                  <img
                    src={asset.file_url}
                    alt={asset.filename}
                    className="w-full h-48 object-cover rounded"
                  />
                )}

                <div className="space-y-2">
                  <h3 className="font-semibold line-clamp-2">{asset.filename}</h3>
                  
                  {asset.content_type && (
                    <Badge variant="secondary" className="text-xs">
                      {asset.content_type.replace('_', ' ')}
                    </Badge>
                  )}

                  <div className="flex items-center gap-2">
                    <Badge>Version {asset.current_version}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
