import { useState, useEffect } from "react";
import { DragDropContext, DropResult, Draggable, Droppable } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Globe, CheckCheck } from "lucide-react";
import PipelineStageColumn from "@/components/pipeline/PipelineStageColumn";
import ProjectCard from "@/components/pipeline/ProjectCard";
import ProjectEditor from "@/components/pipeline/ProjectEditor";
import BulkUploadModal from "@/components/pipeline/BulkUploadModal";
import StageDetailModal from "@/components/pipeline/StageDetailModal";
import SchedulingModal from "@/components/pipeline/SchedulingModal";
import { useRole } from "@/hooks/useRole";

interface PipelineTabProps {
  clientId: string;
  agencyId: string;
}

interface AssignedUser {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
}

interface Project {
  id: string;
  title: string;
  client_id: string;
  agency_id: string;
  status: string;
  thumbnail_url: string | null;
  idea_id: string | null;
  script_id: string | null;
  created_at: string;
  asset_count?: number;
  assigned_to: string | null;
  assigned_user?: AssignedUser | null;
  rejection_reason: string | null;
  last_moved_at: string | null;
}

// Canonical 8-stage pipeline
const PIPELINE_STAGES = [
  { key: 'idea', label: 'Idea', color: '220 70% 50%' },
  { key: 'script_copy', label: 'Script/Copy', color: '250 70% 50%' },
  { key: 'raw_assets', label: 'Raw Assets', color: '280 70% 50%' },
  { key: 'editing', label: 'Editing', color: '310 70% 50%' },
  { key: 'internal_review', label: 'Internal Review', color: '30 70% 50%' },
  { key: 'client_review', label: 'Client Review', color: '35 70% 50%' },
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
  const [isDragging, setIsDragging] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string>("UTC");
  const [schedulingProjectId, setSchedulingProjectId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const { toast } = useToast();
  const { isOwner, isAdmin, isManager } = useRole();

  const fetchProjects = async () => {
    try {
      // Fetch projects with assigned user info via a join
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          client_id,
          agency_id,
          status,
          thumbnail_url,
          idea_id,
          script_id,
          created_at,
          assigned_to,
          rejection_reason,
          last_moved_at
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch asset counts in a single query
      const projectIds = (projectsData || []).map(p => p.id);
      let assetCounts: Record<string, number> = {};
      
      if (projectIds.length > 0) {
        const { data: assetData } = await supabase
          .from('project_assets')
          .select('project_id')
          .in('project_id', projectIds);
        
        if (assetData) {
          assetCounts = assetData.reduce((acc, item) => {
            acc[item.project_id] = (acc[item.project_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // Fetch assigned user profiles
      const assignedIds = (projectsData || [])
        .map(p => p.assigned_to)
        .filter(Boolean) as string[];
      
      let assignedUsers: Record<string, AssignedUser> = {};
      if (assignedIds.length > 0) {
        const { data: membersData } = await supabase
          .from('agency_members')
          .select('id, user_id')
          .in('id', assignedIds);
        
        if (membersData) {
          const userIds = membersData.map(m => m.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
          
          if (profilesData) {
            membersData.forEach(member => {
              const profile = profilesData.find(p => p.id === member.user_id);
              if (profile) {
                assignedUsers[member.id] = {
                  id: member.id,
                  user_id: member.user_id,
                  full_name: profile.full_name,
                  email: profile.email
                };
              }
            });
          }
        }
      }

      const projectsWithData = (projectsData || []).map(project => ({
        ...project,
        asset_count: assetCounts[project.id] || 0,
        assigned_user: project.assigned_to ? assignedUsers[project.assigned_to] : null
      }));

      setProjects(projectsWithData);
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

  const fetchUserTimezone = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      if (data?.timezone) {
        setUserTimezone(data.timezone);
      }
    } catch (error) {
      console.error("Error fetching timezone:", error);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchUserTimezone();

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

  const handleMoveStage = async (projectId: string, newStage: string, rejectionReason?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updatePayload: any = { 
        status: newStage,
        last_moved_by: user?.id || null
      };
      
      // Clear rejection reason when moving forward, set it when rejecting
      if (rejectionReason) {
        updatePayload.rejection_reason = rejectionReason;
      } else if (newStage !== 'client_review') {
        updatePayload.rejection_reason = null;
      }

      const { error } = await supabase
        .from('projects')
        .update(updatePayload)
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Stage updated",
        description: `Project moved to ${PIPELINE_STAGES.find(s => s.key === newStage)?.label || newStage}`
      });

      // Optimistically update local state
      setProjects(projects.map(p => p.id === projectId ? { ...p, status: newStage, rejection_reason: rejectionReason || null } : p));
    } catch (error: any) {
      console.error('Stage transition error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to move project",
        variant: "destructive"
      });
      fetchProjects();
    }
  };

  const handleBulkApprove = async () => {
    const clientReviewProjects = projects.filter(p => p.status === 'client_review');
    if (clientReviewProjects.length === 0) {
      toast({
        title: "No projects to approve",
        description: "There are no projects in client review",
        variant: "destructive"
      });
      return;
    }

    setBulkApproving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('projects')
        .update({ 
          status: 'approved',
          last_moved_by: user?.id || null,
          rejection_reason: null
        })
        .in('id', clientReviewProjects.map(p => p.id));

      if (error) throw error;

      toast({
        title: "Bulk approve complete",
        description: `${clientReviewProjects.length} projects approved`
      });

      fetchProjects();
    } catch (error: any) {
      console.error('Bulk approve error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to bulk approve",
        variant: "destructive"
      });
    } finally {
      setBulkApproving(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false);
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const projectId = draggableId;
    const newStage = destination.droppableId;

    // Optimistically update UI
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setProjects(projects.map(p => p.id === projectId ? { ...p, status: newStage } : p));
    }

    await handleMoveStage(projectId, newStage);
  };

  const getProjectsByStage = (stage: string) => {
    return projects.filter(p => p.status === stage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const clientReviewCount = getProjectsByStage('client_review').length;
  const canBulkApprove = (isOwner || isAdmin || isManager) && clientReviewCount > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Content Pipeline</h2>
            <Badge variant="outline" className="text-xs">
              <Globe className="h-3 w-3 mr-1" />
              {userTimezone}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Manage projects through the 8-stage production workflow</p>
        </div>
        <div className="flex items-center gap-2">
          {canBulkApprove && (
            <Button 
              variant="outline" 
              onClick={handleBulkApprove}
              disabled={bulkApproving}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              {bulkApproving ? "Approving..." : `Bulk Approve (${clientReviewCount})`}
            </Button>
          )}
          <Button onClick={() => setShowBulkUpload(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </div>
      </div>

      {/* Pipeline Board */}
      <DragDropContext 
        onDragEnd={handleDragEnd}
        onDragStart={() => setIsDragging(true)}
      >
        <div className="flex gap-2 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map(stage => {
            const stageProjects = getProjectsByStage(stage.key);
            const isHovered = !isDragging && hoveredStage === stage.key;
            
            return (
              <Droppable droppableId={stage.key} key={stage.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`transition-all duration-1000 ease-in-out ${
                      isHovered ? 'flex-[2]' : 'flex-[0.5]'
                    } min-w-[80px]`}
                    style={{ 
                      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onMouseEnter={() => !isDragging && setHoveredStage(stage.key)}
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
                                      onDelete={() => fetchProjects()}
                                      onSchedule={
                                        project.status === 'approved'
                                          ? () => setSchedulingProjectId(project.id)
                                          : undefined
                                      }
                                      onMoveStage={handleMoveStage}
                                      stages={PIPELINE_STAGES}
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

      {/* Modals */}
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

      <StageDetailModal
        open={!!selectedStage}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStage(null);
            fetchProjects();
          }
        }}
        stage={selectedStage}
        projects={selectedStage ? getProjectsByStage(selectedStage.key) : []}
        onProjectClick={(projectId) => {
          setSelectedStage(null);
          setSelectedProjectId(projectId);
        }}
        onScheduleClick={(projectId) => {
          setSelectedStage(null);
          setSchedulingProjectId(projectId);
        }}
        onMoveStage={handleMoveStage}
        onBulkApprove={handleBulkApprove}
        stages={PIPELINE_STAGES}
      />

      {selectedProjectId && (
        <ProjectEditor
          open={!!selectedProjectId}
          onOpenChange={(open) => !open && setSelectedProjectId(null)}
          projectId={selectedProjectId}
          onUpdate={fetchProjects}
        />
      )}

      {schedulingProjectId && (
        <SchedulingModal
          open={!!schedulingProjectId}
          onOpenChange={(open) => !open && setSchedulingProjectId(null)}
          projectId={schedulingProjectId}
          clientId={clientId}
          agencyId={agencyId}
          onSuccess={() => {
            setSchedulingProjectId(null);
            fetchProjects();
          }}
        />
      )}
    </div>
  );
}
