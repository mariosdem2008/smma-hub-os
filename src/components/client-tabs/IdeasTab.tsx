import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import ApprovalReviewModal from "@/components/ApprovalReviewModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";
import { 
  Lightbulb, 
  Plus, 
  Calendar as CalendarIcon, 
  Check, 
  X, 
  CheckCircle2, 
  MoreVertical,
  Undo2,
  Trash2,
  Search,
  Filter,
  XCircle,
  Send
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { format } from "date-fns";

interface IdeasTabProps {
  clientId: string;
}

interface Idea {
  id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  status: string;
  review_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

type IdeaStatus = "draft" | "idea" | "in_review" | "approved" | "rejected" | "used";

interface StatusHistory {
  ideaId: string;
  previousStatus: IdeaStatus;
  newStatus: IdeaStatus;
  timestamp: number;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const STATUS_COLUMNS: { id: IdeaStatus; label: string; color: string }[] = [
  { id: "draft", label: "Draft", color: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20" },
  { id: "idea", label: "Ideas", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  { id: "in_review", label: "In Review", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" },
  { id: "approved", label: "Approved", color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" },
  { id: "rejected", label: "Rejected", color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" },
  { id: "used", label: "Used", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" },
];

export default function IdeasTab({ clientId }: IdeasTabProps) {
  const { toast } = useToast();
  const { canCreateContent, canEditContent, isViewer, role } = useRole();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewIdeaOpen, setIsNewIdeaOpen] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [newIdea, setNewIdea] = useState({
    title: "",
    description: "",
    tag: "",
  });
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    ideaId: string;
    ideaTitle: string;
    action: 'approve' | 'reject';
  }>({ open: false, ideaId: '', ideaTitle: '', action: 'approve' });

  const canApprove = role === 'owner' || role === 'admin' || role === 'manager';

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchIdeas();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`ideas-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ideas',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          fetchIdeas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const fetchIdeas = async () => {
    const { data, error } = await supabase
      .from("ideas")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching ideas:", error);
      toast({
        title: "Error",
        description: "Failed to fetch ideas",
        variant: "destructive",
      });
    } else {
      setIdeas(data || []);
    }
    setLoading(false);
  };

  // Get unique tags from all ideas
  const uniqueTags = useMemo(() => {
    const tags = ideas
      .flatMap((idea) => idea.tags || [])
      .filter((tag): tag is string => tag !== null && tag !== "");
    return Array.from(new Set(tags));
  }, [ideas]);

  // Filter ideas based on search, tag, and date range
  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      // Search filter
      const matchesSearch = searchQuery === "" || 
        idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (idea.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      // Tag filter
      const matchesTag = selectedTag === "all" || idea.tags?.includes(selectedTag);

      // Date range filter
      const ideaDate = new Date(idea.created_at);
      const matchesDateRange = 
        (!dateRange.from || ideaDate >= dateRange.from) &&
        (!dateRange.to || ideaDate <= dateRange.to);

      return matchesSearch && matchesTag && matchesDateRange;
    });
  }, [ideas, searchQuery, selectedTag, dateRange]);

  const handleAddIdea = async () => {
    if (!newIdea.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("ideas")
      .insert({
        client_id: clientId,
        title: newIdea.title.trim(),
        description: newIdea.description.trim() || null,
        tags: newIdea.tag.trim() ? [newIdea.tag.trim()] : null,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create idea",
        variant: "destructive",
      });
    } else {
      setIdeas([data, ...ideas]);
      setNewIdea({ title: "", description: "", tag: "" });
      setIsNewIdeaOpen(false);
      toast({
        title: "Success",
        description: "Idea created successfully",
      });
    }
  };

  const updateIdeaStatus = async (ideaId: string, newStatus: IdeaStatus) => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return;

    const previousStatus = idea.status as IdeaStatus;

    // Add to history for undo
    setStatusHistory([
      {
        ideaId,
        previousStatus,
        newStatus,
        timestamp: Date.now(),
      },
      ...statusHistory,
    ]);

    // Optimistic update
    setIdeas((prevIdeas) =>
      prevIdeas.map((i) =>
        i.id === ideaId ? { ...i, status: newStatus } : i
      )
    );

    // Update in database
    const { error } = await supabase
      .from("ideas")
      .update({ status: newStatus })
      .eq("id", ideaId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update idea status",
        variant: "destructive",
      });
      // Revert on error
      setIdeas((prevIdeas) =>
        prevIdeas.map((i) =>
          i.id === ideaId ? { ...i, status: previousStatus } : i
        )
      );
      // Remove from history
      setStatusHistory((prev) => prev.slice(1));
    } else {
      const statusMessages: Record<IdeaStatus, string> = {
        draft: "saved as draft",
        idea: "moved to ideas",
        in_review: "submitted for review",
        approved: "approved",
        rejected: "rejected",
        used: "marked as used",
      };
      
      toast({
        title: "Success",
        description: `Idea ${statusMessages[newStatus]}`,
        action: (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleUndo(ideaId, previousStatus, newStatus)}
          >
            <Undo2 className="h-3 w-3 mr-1" />
            Undo
          </Button>
        ),
      });
    }
  };

  const handleUndo = async (ideaId: string, previousStatus: IdeaStatus, currentStatus: IdeaStatus) => {
    // Remove from history
    setStatusHistory((prev) => 
      prev.filter(h => !(h.ideaId === ideaId && h.newStatus === currentStatus))
    );

    // Optimistic update back to previous status
    setIdeas((prevIdeas) =>
      prevIdeas.map((i) =>
        i.id === ideaId ? { ...i, status: previousStatus } : i
      )
    );

    // Update in database
    const { error } = await supabase
      .from("client_ideas")
      .update({ status: previousStatus })
      .eq("id", ideaId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to undo action",
        variant: "destructive",
      });
      // Revert back
      setIdeas((prevIdeas) =>
        prevIdeas.map((i) =>
          i.id === ideaId ? { ...i, status: currentStatus } : i
        )
      );
    } else {
      toast({
        title: "Undone",
        description: "Action reversed successfully",
      });
    }
  };

  const handleDeleteIdea = async (ideaId: string) => {
    const { error } = await supabase
      .from("ideas")
      .delete()
      .eq("id", ideaId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete idea",
        variant: "destructive",
      });
    } else {
      setIdeas((prevIdeas) => prevIdeas.filter((i) => i.id !== ideaId));
      toast({
        title: "Success",
        description: "Idea deleted",
      });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const newStatus = destination.droppableId as IdeaStatus;
    await updateIdeaStatus(draggableId, newStatus);
  };

  const getIdeasByStatus = (status: IdeaStatus) => {
    return filteredIdeas.filter((idea) => idea.status === status);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTag("all");
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters = searchQuery !== "" || selectedTag !== "all" || dateRange.from || dateRange.to;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading ideas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Content Ideas Board</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {[searchQuery !== "", selectedTag !== "all", dateRange.from || dateRange.to]
                    .filter(Boolean).length}
                </Badge>
              )}
            </Button>
            {canCreateContent && !isViewer && (
              <Dialog open={isNewIdeaOpen} onOpenChange={setIsNewIdeaOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Idea
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Idea</DialogTitle>
                    <DialogDescription>
                      Create a new content idea for this client
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={newIdea.title}
                        onChange={(e) =>
                          setNewIdea({ ...newIdea, title: e.target.value })
                        }
                        placeholder="Enter idea title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newIdea.description}
                        onChange={(e) =>
                          setNewIdea({ ...newIdea, description: e.target.value })
                        }
                        placeholder="Describe the idea..."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tag">Tag</Label>
                      <Input
                        id="tag"
                        value={newIdea.tag}
                        onChange={(e) =>
                          setNewIdea({ ...newIdea, tag: e.target.value })
                        }
                        placeholder="e.g., Educational, Promotional, Behind-the-scenes"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsNewIdeaOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAddIdea}>Create Idea</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search title or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Tag Filter */}
                <div className="space-y-2">
                  <Label>Filter by Tag</Label>
                  <Select value={selectedTag} onValueChange={setSelectedTag}>
                    <SelectTrigger>
                      <SelectValue placeholder="All tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tags</SelectItem>
                      {uniqueTags.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange.from && !dateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                            </>
                          ) : (
                            format(dateRange.from, "MMM d, yyyy")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={{ from: dateRange.from, to: dateRange.to }}
                        onSelect={(range) =>
                          setDateRange({ from: range?.from, to: range?.to })
                        }
                        numberOfMonths={2}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredIdeas.length} of {ideas.length} ideas
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Clear filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Kanban Board */}
      {isViewer && (
        <Card className="border-yellow-500/50 bg-yellow-500/10 mb-4">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              You have read-only access. You cannot move or create ideas.
            </p>
          </CardContent>
        </Card>
      )}
      
      <DragDropContext onDragEnd={canEditContent && !isViewer ? handleDragEnd : () => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((column) => {
            const columnIdeas = getIdeasByStatus(column.id);
            return (
              <Card key={column.id} className={`flex flex-col border-2 ${column.color}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    <span>{column.label}</span>
                    <Badge variant="secondary" className="ml-2">
                      {columnIdeas.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 px-3">
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-3 min-h-[300px] rounded-lg p-2 transition-colors ${
                          snapshot.isDraggingOver
                            ? "bg-muted/50 border-2 border-dashed border-primary"
                            : ""
                        }`}
                      >
                        {columnIdeas.map((idea, index) => (
                          <Draggable
                            key={idea.id}
                            draggableId={idea.id}
                            index={index}
                            isDragDisabled={isViewer || !canEditContent}
                          >
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`transition-all duration-200 ${
                                  snapshot.isDragging
                                    ? "shadow-xl scale-105 rotate-2"
                                    : "hover:shadow-md"
                                } ${!isViewer && canEditContent ? "cursor-move" : ""}`}
                              >
                                <CardContent className="p-3 space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-semibold text-sm line-clamp-2 flex-1">
                                      {idea.title}
                                    </h4>
                                    {canEditContent && !isViewer && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 flex-shrink-0"
                                          >
                                            <MoreVertical className="h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() => handleDeleteIdea(idea.id)}
                                            className="text-destructive"
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                  
                                  {idea.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {idea.description}
                                    </p>
                                  )}
                                  
                                  <div className="flex items-center justify-between">
                                    {idea.tags && idea.tags.length > 0 ? (
                                      <Badge variant="outline" className="text-xs truncate max-w-[120px]">
                                        {idea.tags[0]}
                                      </Badge>
                                    ) : (
                                      <div />
                                    )}
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                                      <CalendarIcon className="h-3 w-3" />
                                      {format(new Date(idea.created_at), "MMM d")}
                                    </div>
                                  </div>

                                  {/* Action Buttons - Compact Layout */}
                                  {canEditContent && !isViewer && (
                                    <div className="pt-2 border-t space-y-1.5">
                                      {column.id === "idea" && (
                                        <div className="grid grid-cols-2 gap-1.5">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                                            onClick={() => updateIdeaStatus(idea.id, "approved")}
                                          >
                                            <Check className="h-3 w-3 mr-1" />
                                            Approve
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                            onClick={() => updateIdeaStatus(idea.id, "rejected")}
                                          >
                                            <X className="h-3 w-3 mr-1" />
                                            Reject
                                          </Button>
                                        </div>
                                      )}
                                      
                                      {column.id === "approved" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="w-full h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950"
                                          onClick={() => updateIdeaStatus(idea.id, "used")}
                                        >
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Mark Used
                                        </Button>
                                      )}

                                      {(column.id === "rejected" || column.id === "used") && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="w-full h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                                          onClick={() => updateIdeaStatus(idea.id, "idea")}
                                        >
                                          <Undo2 className="h-3 w-3 mr-1" />
                                          Back to Ideas
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {columnIdeas.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground rounded-lg border-2 border-dashed">
                            <Lightbulb className="h-8 w-8 mb-2 opacity-50" />
                            <p>No ideas</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
