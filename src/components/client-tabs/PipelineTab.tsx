import { useState, useEffect } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RawUploadZone from "@/components/pipeline/RawUploadZone";
import PipelineStageColumn from "@/components/pipeline/PipelineStageColumn";
import AssetPipelineCard from "@/components/pipeline/AssetPipelineCard";
import { AssetDetailModal } from "@/components/assets/AssetDetailModal";
import { FinalStageEditor } from "@/components/pipeline/FinalStageEditor";
import ContentLibraryTab from "@/components/client-tabs/ContentLibraryTab";
import { Loader2 } from "lucide-react";

interface PipelineTabProps {
  clientId: string;
  agencyId: string;
}

interface Asset {
  id: string;
  client_id: string;
  title: string | null;
  filename: string;
  file_url: string;
  file_type: string;
  content_type: string | null;
  custom_category: string | null;
  uploaded_by: string | null;
  created_at: string;
  pipeline_stage: string;
  status: string;
  visible_to_client: boolean;
  thumbnail_url: string | null;
  file_size: number | null;
  updated_at: string;
  is_client_upload: boolean;
  current_version: number;
  final_caption: string | null;
  hashtags: string | null;
  platforms: string[] | null;
  scheduled_time: string | null;
}

interface Profile {
  email: string;
}

const PIPELINE_STAGES = [
  { key: 'idea', label: 'Idea', color: '220 70% 50%' },
  { key: 'in_production', label: 'In Production', color: '270 70% 50%' },
  { key: 'review', label: 'Review', color: '30 70% 50%' },
  { key: 'approved', label: 'Approved', color: '150 70% 50%' },
  { key: 'scheduled', label: 'Scheduled', color: '200 70% 50%' },
  { key: 'published', label: 'Published', color: '120 70% 50%' }
];

export default function PipelineTab({ clientId, agencyId }: PipelineTabProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editingFinalAsset, setEditingFinalAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState("board");
  const { toast } = useToast();

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAssets(data || []);

      // Fetch uploader profiles
      const uploaderIds = [...new Set(data?.map(a => a.uploaded_by).filter(Boolean))];
      if (uploaderIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', uploaderIds);

        const profileMap: Record<string, Profile> = {};
        profileData?.forEach(p => {
          profileMap[p.id] = { email: p.email };
        });
        setProfiles(profileMap);
      }
    } catch (error: any) {
      console.error("Error fetching assets:", error);
      toast({
        title: "Error loading pipeline",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('pipeline-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assets',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          fetchAssets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const handleMoveStage = async (assetId: string, newStage: 'idea' | 'in_production' | 'review' | 'approved' | 'scheduled' | 'published') => {
    try {
      // Validate scheduling requirements before moving to scheduled stage
      if (newStage === 'scheduled') {
        const asset = assets.find(a => a.id === assetId);
        
        if (!asset?.platforms || asset.platforms.length === 0) {
          toast({
            title: "Platforms required",
            description: "Please select at least one platform before scheduling",
            variant: "destructive"
          });
          return;
        }

        if (!asset?.scheduled_time) {
          toast({
            title: "Schedule time required",
            description: "Please set a scheduled date and time before scheduling",
            variant: "destructive"
          });
          return;
        }
      }

      const { data, error } = await supabase
        .from('assets')
        .update({ pipeline_stage: newStage })
        .eq('id', assetId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Stage updated",
        description: `Asset moved to ${newStage}`
      });

      // Optimistically update local state
      setAssets(assets.map(a => a.id === assetId ? { ...a, pipeline_stage: newStage } : a));
    } catch (error: any) {
      console.error('Stage transition error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to move asset. Invalid stage transition.",
        variant: "destructive"
      });
      // Revert optimistic update by refetching
      fetchAssets();
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Dropped outside the list
    if (!destination) {
      return;
    }

    // Dropped in the same position
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const assetId = draggableId;
    const newStage = destination.droppableId as 'idea' | 'in_production' | 'review' | 'approved' | 'scheduled' | 'published';

    // Validate scheduling requirements before moving to scheduled stage
    if (newStage === 'scheduled') {
      const asset = assets.find(a => a.id === assetId);
      
      if (!asset?.platforms || asset.platforms.length === 0) {
        toast({
          title: "Platforms required",
          description: "Please select at least one platform before scheduling",
          variant: "destructive"
        });
        return;
      }

      if (!asset?.scheduled_time) {
        toast({
          title: "Schedule time required",
          description: "Please set a scheduled date and time before scheduling",
          variant: "destructive"
        });
        return;
      }
    }

    // Optimistically update UI
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      setAssets(assets.map(a => a.id === assetId ? { ...a, pipeline_stage: newStage } : a));
    }

    // Update in database
    await handleMoveStage(assetId, newStage);
  };

  const getAssetsByStage = (stage: string) => {
    return assets.filter(a => a.pipeline_stage === stage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="board">Pipeline Board</TabsTrigger>
          <TabsTrigger value="library">Asset Library</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="space-y-6 mt-6">
          {/* Raw Upload Zone */}
          <RawUploadZone
            clientId={clientId}
            agencyId={agencyId}
            onUploadComplete={fetchAssets}
          />

          {/* Pipeline Board */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {PIPELINE_STAGES.map(stage => {
                const stageAssets = getAssetsByStage(stage.key);
                return (
                  <PipelineStageColumn
                    key={stage.key}
                    stageId={stage.key}
                    title={stage.label}
                    count={stageAssets.length}
                    color={stage.color}
                  >
                    {stageAssets.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No assets in {stage.label.toLowerCase()}
                      </p>
                    ) : (
                      stageAssets.map((asset, index) => (
                        <AssetPipelineCard
                          key={asset.id}
                          asset={asset}
                          index={index}
                          uploaderEmail={asset.uploaded_by ? profiles[asset.uploaded_by]?.email : undefined}
                          onMoveStage={handleMoveStage}
                          onView={(id) => {
                            const foundAsset = assets.find(a => a.id === id);
                            if (foundAsset?.pipeline_stage === 'approved') {
                              setEditingFinalAsset(foundAsset);
                            } else {
                              setSelectedAsset(foundAsset || null);
                            }
                          }}
                        />
                      ))
                    )}
                  </PipelineStageColumn>
                );
              })}
            </div>
          </DragDropContext>
        </TabsContent>

        <TabsContent value="library" className="mt-6">
          <ContentLibraryTab clientId={clientId} agencyId={agencyId} />
        </TabsContent>
      </Tabs>

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onAssetUpdated={fetchAssets}
          agencyId={agencyId}
        />
      )}

      {/* Final Stage Editor */}
      {editingFinalAsset && (
        <FinalStageEditor
          asset={editingFinalAsset}
          clientId={clientId}
          onClose={() => setEditingFinalAsset(null)}
          onSuccess={fetchAssets}
        />
      )}
    </div>
  );
}
