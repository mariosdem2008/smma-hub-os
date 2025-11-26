import { useState, useEffect } from "react";
import { DragDropContext, DropResult, Draggable, Droppable } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import PipelineStageColumn from "@/components/pipeline/PipelineStageColumn";
import ProjectCard from "@/components/pipeline/ProjectCard";
import ProjectEditor from "@/components/pipeline/ProjectEditor";
import BulkUploadModal from "@/components/pipeline/BulkUploadModal";
import StageDetailModal from "@/components/pipeline/StageDetailModal";

interface PipelineTabProps {
  clientId: string;
  agencyId: string;
}

interface Project {
  id: string;
  title: string;
  client_id: string;
  agency_id: string;
  pipeline_stage: string;
  thumbnail_url: string | null;
  idea_id: string | null;
  script_id: string | null;
  created_at: string;
  asset_count?: number;
}

const PIPELINE_STAGES = [
  { key: 'idea', label: 'Idea', color: '220 70% 50%' },
  { key: 'scripting', label: 'Scripting', color: '250 70% 50%' },
  { key: 'in_production', label: 'In Production', color: '270 70% 50%' },
  { key: 'internal_review', label: 'Internal Review', color: '30 70% 50%' },
  { key: 'review', label: 'Client Review', color: '35 70% 50%' },
  { key: 'approved', label: 'Approved', color: '150 70% 50%' },
  { key: 'scheduled', label: 'Scheduled', color: '200 70% 50%' },
  { key: 'published', label: 'Published', color: '120 70% 50%' }
];

export default function PipelineTab({ clientId, agencyId }: PipelineTabProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [selectedStage, setSelectedStage] = useState<{ key: string; label: string; color: string } | null>(null);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProjects = async () => {
    try {
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          client_id,
          agency_id,
          pipeline_stage,
          thumbnail_url,
          idea_id,
          script_id,
          created_at
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get asset counts for each project
      const projectsWithCounts = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { count } = await supabase
            .from('project_assets')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id);

          return {
            ...project,
            asset_count: count || 0
          };
        })
      );

      setProjects(projectsWithCounts);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
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
    fetchProjects();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('pipeline-projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          fetchProjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const handleMoveStage = async (projectId: string, newStage: string) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({ pipeline_stage: newStage })
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Stage updated",
        description: `Project moved to ${PIPELINE_STAGES.find(s => s.key === newStage)?.label || newStage}`
      });

      // Optimistically update local state
      setProjects(projects.map(p => p.id === projectId ? { ...p, pipeline_stage: newStage } : p));
    } catch (error: any) {
      console.error('Stage transition error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to move project",
        variant: "destructive"
      });
      // Revert optimistic update by refetching
      fetchProjects();
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

    const projectId = draggableId;
    const newStage = destination.droppableId;

    // Optimistically update UI
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setProjects(projects.map(p => p.id === projectId ? { ...p, pipeline_stage: newStage } : p));
    }

    // Update in database
    await handleMoveStage(projectId, newStage);
  };

  const getProjectsByStage = (stage: string) => {
    return projects.filter(p => p.pipeline_stage === stage);
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
      {/* Header with Create Project Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content Pipeline</h2>
          <p className="text-sm text-muted-foreground">Manage projects through the production workflow</p>
        </div>
        <Button onClick={() => setShowBulkUpload(true)} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </div>

      {/* Pipeline Board - Compact Tabs with Drag & Drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-2 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map(stage => {
            const stageProjects = getProjectsByStage(stage.key);
            const isHovered = hoveredStage === stage.key;
            
            return (
              <Droppable droppableId={stage.key} key={stage.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`transition-all duration-300 ease-in-out ${
                      isHovered ? 'flex-[2]' : 'flex-[0.5]'
                    } min-w-[80px]`}
                    onMouseEnter={() => setHoveredStage(stage.key)}
                    onMouseLeave={() => setHoveredStage(null)}
                  >
                    <div 
                      className={`h-full rounded-lg border bg-card transition-all cursor-pointer ${
                        snapshot.isDraggingOver ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedStage(stage)}
                    >
                      <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold transition-all ${isHovered ? 'text-base' : 'text-sm'}`}>
                            {stage.label}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="text-xs"
                            style={{
                              backgroundColor: `hsl(${stage.color} / 0.1)`,
                              color: `hsl(${stage.color})`,
                            }}
                          >
                            {stageProjects.length}
                          </Badge>
                        </div>
                      </div>
                      
                      {isHovered && (
                        <div className="p-3 space-y-2 overflow-y-auto max-h-[600px]">
                          {stageProjects.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                              No projects
                            </p>
                          ) : (
                            stageProjects.slice(0, 3).map((project, index) => (
                              <Draggable key={project.id} draggableId={project.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProjectId(project.id);
                                    }}
                                  >
                                    <ProjectCard
                                      project={project}
                                      onClick={() => {}}
                                      isDragging={snapshot.isDragging}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {stageProjects.length > 3 && (
                            <p className="text-xs text-muted-foreground text-center pt-2">
                              +{stageProjects.length - 3} more projects
                            </p>
                          )}
                        </div>
                      )}
                      
                      {!isHovered && (
                        <div className="p-3">
                          <p className="text-xs text-muted-foreground text-center">
                            Click to view all
                          </p>
                        </div>
                      )}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <BulkUploadModal
          open={showBulkUpload}
          onOpenChange={setShowBulkUpload}
          clientId={clientId}
          agencyId={agencyId}
          onSuccess={() => {
            setShowBulkUpload(false);
            fetchProjects();
          }}
        />
      )}

      {/* Stage Detail Modal */}
      <StageDetailModal
        open={!!selectedStage}
        onOpenChange={(open) => !open && setSelectedStage(null)}
        stage={selectedStage}
        projects={selectedStage ? getProjectsByStage(selectedStage.key) : []}
        onProjectClick={(projectId) => {
          setSelectedStage(null);
          setSelectedProjectId(projectId);
        }}
      />

      {/* Project Editor */}
      {selectedProjectId && (
        <ProjectEditor
          open={!!selectedProjectId}
          onOpenChange={(open) => !open && setSelectedProjectId(null)}
          projectId={selectedProjectId}
          onUpdate={fetchProjects}
        />
      )}
    </div>
  );
}
