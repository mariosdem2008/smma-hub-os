import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { hapticSelection } from "@/lib/haptics";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import ProjectApprovalInterface from "@/components/approval/ProjectApprovalInterface";

interface OutletContext {
  clientId: string;
}

interface FinalAsset {
  id: string;
  file_url: string;
  file_type: string;
  filename: string;
  final_caption: string | null;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  thumbnail_url: string | null;
  platforms: string[] | null;
  scheduled_for: string | null;
  platform_captions: Record<string, string> | null;
  hashtags: string | null;
  notes: string | null;
  client_id: string;
  agency_id: string;
  final_assets?: FinalAsset[];
}

export default function PortalApprovals() {
  const { clientId } = useOutletContext<OutletContext>();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const fetchProjectsForApproval = async () => {
    try {
      // Get projects in Client Review stage
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          thumbnail_url,
          platforms,
          scheduled_for,
          platform_captions,
          hashtags,
          notes,
          client_id,
          agency_id
        `)
        .eq('client_id', clientId)
        .eq('status', 'client_review')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // For each project, get the final assets
      const projectsWithFinalAssets = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { data: finalAssetsData, error: assetsError } = await supabase
            .from('project_assets')
            .select(`
              asset_id,
              assets:asset_id (
                id,
                file_url,
                file_type,
                filename,
                final_caption
              )
            `)
            .eq('project_id', project.id)
            .eq('is_final_content', true);

          if (assetsError) throw assetsError;

          const finalAssets = (finalAssetsData || [])
            .map((pa: any) => pa.assets)
            .filter(Boolean)
            .map((asset: any) => ({
              id: asset.id,
              file_url: asset.file_url,
              file_type: asset.file_type,
              filename: asset.filename,
              final_caption: asset.final_caption,
            }));

          return {
            ...project,
            platform_captions: project.platform_captions || {},
            final_assets: finalAssets,
          };
        })
      );

      setProjects(projectsWithFinalAssets as Project[]);
    } catch (error: any) {
      toast({
        title: "Error loading projects",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Pull-to-refresh
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await fetchProjectsForApproval();
    },
  });

  useEffect(() => {
    fetchProjectsForApproval();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('portal-approvals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          fetchProjectsForApproval();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedProject) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedProject(null)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Approvals
        </button>
        
        <ProjectApprovalInterface
          project={selectedProject}
          finalAssets={selectedProject.final_assets || []}
          onApprovalComplete={() => {
            setSelectedProject(null);
            fetchProjectsForApproval();
          }}
        />
      </div>
    );
  }

  return (
    <div 
      className="space-y-4 md:space-y-6 px-2 md:px-4"
      style={{
        transform: isMobile ? `translateY(${pullDistance}px)` : undefined,
        transition: isRefreshing ? "transform 0.3s ease-out" : "none",
      }}
    >
      {/* Pull-to-refresh indicator */}
      {isMobile && pullDistance > 0 && (
        <div className="flex justify-center">
          <div className={`text-sm text-muted-foreground transition-opacity ${pullDistance > 60 ? "opacity-100" : "opacity-50"}`}>
            {isRefreshing ? "Refreshing..." : pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      )}
      
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Content Approvals</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Review and approve content awaiting your feedback
        </p>
      </div>


      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-8 md:py-12 text-center">
            <p className="text-sm md:text-base text-muted-foreground">
              No content awaiting your approval
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {projects.map(project => (
            <Card 
              key={project.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedProject(project)}
            >
              <CardContent className="p-3 md:p-4 space-y-3">
                {project.final_assets && project.final_assets.length > 0 ? (
                  project.final_assets[0].file_type?.startsWith("video") ? (
                    <video
                      src={project.final_assets[0].file_url}
                      className="w-full h-40 md:h-48 object-cover rounded"
                      controls
                    />
                  ) : project.final_assets[0].file_type?.startsWith("image") ? (
                    <img
                      src={project.final_assets[0].file_url}
                      alt={project.final_assets[0].filename}
                      className="w-full h-40 md:h-48 object-cover rounded"
                    />
                  ) : (
                    <img
                      src={project.final_assets[0].file_url}
                      alt={project.final_assets[0].filename}
                      className="w-full h-40 md:h-48 object-cover rounded"
                    />
                  )
                ) : project.thumbnail_url ? (
                  <img
                    src={project.thumbnail_url}
                    alt={project.title}
                    className="w-full h-40 md:h-48 object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-40 md:h-48 bg-muted rounded flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">No preview</p>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm md:text-base font-semibold line-clamp-2">{project.title}</h3>
                  
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="text-xs">Client Review</Badge>
                    {project.platforms && project.platforms.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {project.platforms.length} platform{project.platforms.length > 1 ? 's' : ''}
                      </Badge>
                    )}
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
