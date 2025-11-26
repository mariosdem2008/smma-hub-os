import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import ClientApprovalInterface from "@/components/approval/ClientApprovalInterface";

interface OutletContext {
  clientId: string;
}

interface Project {
  id: string;
  title: string;
  pipeline_stage: string;
  created_at: string;
  thumbnail_url: string | null;
  platforms: string[] | null;
  scheduled_time: string | null;
  final_asset?: {
    id: string;
    file_url: string;
    file_type: string;
    filename: string;
    content_type: string | null;
  };
}

export default function PortalApprovals() {
  const { clientId } = useOutletContext<OutletContext>();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

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

  const fetchProjectsForApproval = async () => {
    try {
      // Get projects in Client Review stage (stage key is 'review')
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          pipeline_stage,
          created_at,
          thumbnail_url,
          platforms,
          scheduled_time
        `)
        .eq('client_id', clientId)
        .eq('pipeline_stage', 'review')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // For each project, get the final asset
      const projectsWithFinalAssets = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { data: finalAssets } = await supabase
            .from('project_assets')
            .select(`
              assets:asset_id (
                id,
                file_url,
                file_type,
                filename,
                content_type
              )
            `)
            .eq('project_id', project.id)
            .eq('is_final_content', true)
            .limit(1)
            .single();

          return {
            ...project,
            final_asset: finalAssets?.assets as any
          };
        })
      );

      setProjects(projectsWithFinalAssets);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      toast({
        title: "Error",
        description: "Failed to load projects for approval",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedProject && selectedProject.final_asset) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedProject(null)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Approvals
        </button>
        
        <ClientApprovalInterface
          asset={selectedProject.final_asset as any}
          clientId={clientId}
          onApprovalComplete={() => {
            setSelectedProject(null);
            fetchProjectsForApproval();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-4">
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
                {project.final_asset ? (
                  project.final_asset.file_type.startsWith('video/') ? (
                    <video
                      src={project.final_asset.file_url}
                      className="w-full h-40 md:h-48 object-cover rounded"
                    />
                  ) : (
                    <img
                      src={project.final_asset.file_url}
                      alt={project.final_asset.filename}
                      className="w-full h-40 md:h-48 object-cover rounded"
                    />
                  )
                ) : (
                  <div className="w-full h-40 md:h-48 bg-muted rounded flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">No preview</p>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm md:text-base font-semibold line-clamp-2">{project.title}</h3>
                  
                  {project.final_asset?.content_type && (
                    <Badge variant="secondary" className="text-xs">
                      {project.final_asset.content_type.replace('_', ' ')}
                    </Badge>
                  )}

                  <div className="flex items-center gap-2">
                    <Badge className="text-xs">Client Review</Badge>
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
